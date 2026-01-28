'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import AttributeForm from '@/components/AttributeForm';
import PolygonDetail from '@/components/PolygonDetail';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

interface PolygonGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

interface Polygon {
  type: 'Feature';
  id: string;
  geometry: PolygonGeometry;
  properties: Record<string, unknown>;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: Polygon[];
}

export default function Home() {
  const [polygons, setPolygons] = useState<FeatureCollection | null>(null);
  const [pendingGeometry, setPendingGeometry] = useState<PolygonGeometry | null>(null);
  const [selectedPolygon, setSelectedPolygon] = useState<Polygon | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchPolygons = useCallback(async () => {
    try {
      const res = await fetch('/api/polygons');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPolygons(data);
      setLoadError(null);
    } catch {
      setLoadError('Failed to load polygons. Click to retry.');
    }
  }, []);

  useEffect(() => {
    fetchPolygons();
  }, [fetchPolygons]);

  const handlePolygonCreated = useCallback((geometry: PolygonGeometry) => {
    setPendingGeometry(geometry);
    setError(null);
  }, []);

  const handlePolygonSelected = useCallback((polygon: Polygon | null) => {
    setSelectedPolygon(polygon);
  }, []);

  async function handleSave(attributes: Record<string, string>) {
    if (!pendingGeometry) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/polygons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geometry: pendingGeometry, attributes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setPendingGeometry(null);
      await fetchPolygons();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save polygon');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setPendingGeometry(null);
    setError(null);
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/polygons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setSelectedPolygon(null);
      await fetchPolygons();
    } catch {
      alert('Failed to delete polygon');
    }
  }

  return (
    <main className="h-screen w-screen relative">
      {loadError && (
        <div
          onClick={fetchPolygons}
          className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded cursor-pointer z-20"
        >
          {loadError}
        </div>
      )}

      <Map
        onPolygonCreated={handlePolygonCreated}
        onPolygonSelected={handlePolygonSelected}
        polygons={polygons}
      />

      {pendingGeometry && (
        <AttributeForm
          onSave={handleSave}
          onCancel={handleCancel}
          loading={saving}
          error={error}
        />
      )}

      {selectedPolygon && (
        <PolygonDetail
          polygon={selectedPolygon}
          onClose={() => setSelectedPolygon(null)}
          onDelete={handleDelete}
        />
      )}
    </main>
  );
}
