'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

interface Polygon {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: Record<string, unknown>;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: Polygon[];
}

interface MapProps {
  onPolygonCreated: (geometry: Polygon['geometry']) => void;
  onPolygonSelected: (polygon: Polygon | null) => void;
  polygons: FeatureCollection | null;
}

export default function Map({ onPolygonCreated, onPolygonSelected, polygons }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const defaultCenter = useMemo(() =>
    process.env.NEXT_PUBLIC_DEFAULT_CENTER
      ? JSON.parse(process.env.NEXT_PUBLIC_DEFAULT_CENTER)
      : [-122.4, 37.8],
    []
  );
  const defaultZoom = useMemo(() =>
    process.env.NEXT_PUBLIC_DEFAULT_ZOOM
      ? parseFloat(process.env.NEXT_PUBLIC_DEFAULT_ZOOM)
      : 12,
    []
  );

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: defaultCenter,
      zoom: defaultZoom,
    });

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: 'simple_select',
    });

    map.current.addControl(draw.current);
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
      const feature = e.features[0];
      if (feature.geometry.type === 'Polygon') {
        onPolygonCreated(feature.geometry as Polygon['geometry']);
        draw.current?.deleteAll();
        setIsDrawing(false);
      }
    });

    map.current.on('load', () => {
      map.current!.addSource('polygons', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current!.addLayer({
        id: 'polygons-fill',
        type: 'fill',
        source: 'polygons',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.3,
        },
      });

      map.current!.addLayer({
        id: 'polygons-outline',
        type: 'line',
        source: 'polygons',
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 2,
        },
      });

      map.current!.on('click', 'polygons-fill', (e) => {
        if (e.features && e.features[0]) {
          const feature = e.features[0];
          onPolygonSelected({
            type: 'Feature',
            id: feature.properties?.id,
            geometry: feature.geometry as Polygon['geometry'],
            properties: feature.properties as Record<string, unknown>,
          });
        }
      });

      map.current!.on('mouseenter', 'polygons-fill', () => {
        map.current!.getCanvas().style.cursor = 'pointer';
      });

      map.current!.on('mouseleave', 'polygons-fill', () => {
        map.current!.getCanvas().style.cursor = '';
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [defaultCenter, defaultZoom, onPolygonCreated, onPolygonSelected]);

  useEffect(() => {
    if (!map.current || !polygons) return;
    const source = map.current.getSource('polygons') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(polygons);
    }
  }, [polygons]);

  const startDrawing = useCallback(() => {
    if (draw.current) {
      draw.current.changeMode('draw_polygon');
      setIsDrawing(true);
    }
  }, []);

  const cancelDrawing = useCallback(() => {
    if (draw.current) {
      draw.current.deleteAll();
      draw.current.changeMode('simple_select');
      setIsDrawing(false);
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute top-4 left-4 z-10">
        {!isDrawing ? (
          <button
            onClick={startDrawing}
            className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600"
          >
            Draw Polygon
          </button>
        ) : (
          <button
            onClick={cancelDrawing}
            className="bg-red-500 text-white px-4 py-2 rounded shadow hover:bg-red-600"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
