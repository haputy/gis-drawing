# GIS Drawing Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app for drawing polygons over satellite imagery and saving to PostGIS.

**Architecture:** Next.js 14 App Router with Mapbox GL JS for mapping, Vercel Postgres (Neon) with PostGIS for storage, simple cookie-based auth with shared password.

**Tech Stack:** Next.js 14, TypeScript, Mapbox GL JS, Mapbox GL Draw, Vercel Postgres, PostGIS

---

## Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create Next.js project**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Expected: Project scaffolded with App Router structure

**Step 2: Install dependencies**

Run:
```bash
npm install mapbox-gl @mapbox/mapbox-gl-draw @vercel/postgres jose
npm install -D @types/mapbox-gl @types/mapbox__mapbox-gl-draw
```

Expected: Dependencies installed

**Step 3: Create .env.example**

Create `.env.example`:
```
# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx

# Database (Vercel Postgres provides these)
POSTGRES_URL=postgres://...

# Auth
AUTH_PASSWORD=your-shared-password
AUTH_SECRET=generate-a-random-32-char-string

# Optional
NEXT_PUBLIC_DEFAULT_CENTER=[-122.4,37.8]
NEXT_PUBLIC_DEFAULT_ZOOM=12
```

**Step 4: Update .gitignore**

Add to `.gitignore`:
```
.env
.env.local
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js project with dependencies"
```

---

## Task 2: Set Up Database Schema

**Files:**
- Create: `lib/db.ts`
- Create: `scripts/setup-db.sql`

**Step 1: Create database connection module**

Create `lib/db.ts`:
```typescript
import { sql } from '@vercel/postgres';

export { sql };
```

**Step 2: Create SQL setup script**

Create `scripts/setup-db.sql`:
```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create polygons table
CREATE TABLE IF NOT EXISTS polygons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geometry      GEOMETRY(Polygon, 4326) NOT NULL,
  attributes    JSONB DEFAULT '{}',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at    TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_polygons_geometry ON polygons USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_polygons_deleted ON polygons (deleted_at) WHERE deleted_at IS NULL;
```

**Step 3: Commit**

```bash
git add lib/db.ts scripts/setup-db.sql
git commit -m "feat: add database connection and schema setup script"
```

---

## Task 3: Implement Authentication

**Files:**
- Create: `lib/auth.ts`
- Create: `app/api/auth/route.ts`
- Create: `middleware.ts`
- Create: `app/login/page.tsx`

**Step 1: Create auth utilities**

Create `lib/auth.ts`:
```typescript
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET);
const COOKIE_NAME = 'gis-session';

export async function createSession(): Promise<string> {
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET);
  return token;
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySession(token);
}

export function verifyPassword(password: string): boolean {
  return password === process.env.AUTH_PASSWORD;
}

export { COOKIE_NAME };
```

**Step 2: Create auth API route**

Create `app/api/auth/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSession, verifyPassword, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await createSession();
  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
```

**Step 3: Create middleware**

Create `middleware.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token || !(await verifySession(token))) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/api/polygons/:path*'],
};
```

**Step 4: Create login page**

Create `app/login/page.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/');
    } else {
      setError('Invalid password');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow-md w-80">
        <h1 className="text-xl font-bold mb-4">GIS Drawing Tool</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="w-full p-2 border rounded mb-4"
          autoFocus
        />
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add lib/auth.ts app/api/auth/route.ts middleware.ts app/login/page.tsx
git commit -m "feat: add authentication with shared password"
```

---

## Task 4: Implement Polygons API

**Files:**
- Create: `app/api/polygons/route.ts`
- Create: `app/api/polygons/[id]/route.ts`

**Step 1: Create GET and POST routes**

Create `app/api/polygons/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const result = await sql`
      SELECT
        id,
        ST_AsGeoJSON(geometry)::json as geometry,
        attributes,
        created_at
      FROM polygons
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `;

    const features = result.rows.map((row) => ({
      type: 'Feature' as const,
      id: row.id,
      geometry: row.geometry,
      properties: {
        id: row.id,
        ...row.attributes,
        created_at: row.created_at,
      },
    }));

    return NextResponse.json({
      type: 'FeatureCollection',
      features,
    });
  } catch (error) {
    console.error('Failed to fetch polygons:', error);
    return NextResponse.json({ error: 'Failed to fetch polygons' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { geometry, attributes } = await request.json();

    if (!geometry || geometry.type !== 'Polygon' || !geometry.coordinates) {
      return NextResponse.json({ error: 'Invalid polygon geometry' }, { status: 400 });
    }

    const geojson = JSON.stringify(geometry);
    const attrs = JSON.stringify(attributes || {});

    const result = await sql`
      INSERT INTO polygons (geometry, attributes)
      VALUES (ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326), ${attrs}::jsonb)
      RETURNING id, ST_AsGeoJSON(geometry)::json as geometry, attributes, created_at
    `;

    const row = result.rows[0];
    return NextResponse.json({
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        id: row.id,
        ...row.attributes,
        created_at: row.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create polygon:', error);
    return NextResponse.json({ error: 'Failed to save polygon' }, { status: 500 });
  }
}
```

**Step 2: Create DELETE route**

Create `app/api/polygons/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await sql`
      UPDATE polygons
      SET deleted_at = NOW()
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      RETURNING id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Polygon not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to delete polygon:', error);
    return NextResponse.json({ error: 'Failed to delete polygon' }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add app/api/polygons/route.ts app/api/polygons/[id]/route.ts
git commit -m "feat: add polygons API (GET, POST, DELETE)"
```

---

## Task 5: Create Map Component

**Files:**
- Create: `components/Map.tsx`
- Create: `app/globals.css` (modify)

**Step 1: Add Mapbox CSS to globals**

Modify `app/globals.css` to add at the top:
```css
@import 'mapbox-gl/dist/mapbox-gl.css';
@import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 2: Create Map component**

Create `components/Map.tsx`:
```typescript
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

  const defaultCenter = process.env.NEXT_PUBLIC_DEFAULT_CENTER
    ? JSON.parse(process.env.NEXT_PUBLIC_DEFAULT_CENTER)
    : [-122.4, 37.8];
  const defaultZoom = process.env.NEXT_PUBLIC_DEFAULT_ZOOM
    ? parseFloat(process.env.NEXT_PUBLIC_DEFAULT_ZOOM)
    : 12;

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

    map.current.on('draw.create', (e) => {
      const feature = e.features[0];
      if (feature.geometry.type === 'Polygon') {
        onPolygonCreated(feature.geometry);
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
```

**Step 3: Commit**

```bash
git add components/Map.tsx app/globals.css
git commit -m "feat: add Map component with Mapbox and drawing"
```

---

## Task 6: Create Attribute Form Component

**Files:**
- Create: `components/AttributeForm.tsx`

**Step 1: Create the component**

Create `components/AttributeForm.tsx`:
```typescript
'use client';

import { useState } from 'react';

interface AttributeFormProps {
  onSave: (attributes: Record<string, string>) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}

export default function AttributeForm({ onSave, onCancel, loading, error }: AttributeFormProps) {
  const [fields, setFields] = useState<{ key: string; value: string }[]>([
    { key: 'name', value: '' },
    { key: 'type', value: '' },
  ]);

  function addField() {
    setFields([...fields, { key: '', value: '' }]);
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index));
  }

  function updateField(index: number, field: 'key' | 'value', value: string) {
    const newFields = [...fields];
    newFields[index][field] = value;
    setFields(newFields);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const attributes: Record<string, string> = {};
    fields.forEach(({ key, value }) => {
      if (key.trim()) {
        attributes[key.trim()] = value;
      }
    });
    onSave(attributes);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-6 w-96 max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Polygon Attributes</h2>

        <div className="space-y-3 mb-4">
          {fields.map((field, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                placeholder="Field name"
                value={field.key}
                onChange={(e) => updateField(index, 'key', e.target.value)}
                className="flex-1 p-2 border rounded text-sm"
              />
              <input
                type="text"
                placeholder="Value"
                value={field.value}
                onChange={(e) => updateField(index, 'value', e.target.value)}
                className="flex-1 p-2 border rounded text-sm"
              />
              <button
                type="button"
                onClick={() => removeField(index)}
                className="text-red-500 hover:text-red-700 px-2"
              >
                x
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addField}
          className="text-blue-500 hover:text-blue-700 text-sm mb-4"
        >
          + Add field
        </button>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 p-2 border rounded hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/AttributeForm.tsx
git commit -m "feat: add AttributeForm component for polygon metadata"
```

---

## Task 7: Create Polygon Detail Panel

**Files:**
- Create: `components/PolygonDetail.tsx`

**Step 1: Create the component**

Create `components/PolygonDetail.tsx`:
```typescript
'use client';

import { useState } from 'react';

interface Polygon {
  id: string;
  properties: Record<string, unknown>;
}

interface PolygonDetailProps {
  polygon: Polygon;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export default function PolygonDetail({ polygon, onClose, onDelete }: PolygonDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { id, created_at, ...attributes } = polygon.properties;

  async function handleDelete() {
    setDeleting(true);
    await onDelete(polygon.id);
    setDeleting(false);
  }

  return (
    <div className="absolute top-4 right-16 bg-white rounded-lg shadow-xl p-4 w-72 z-10">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">Polygon Details</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          x
        </button>
      </div>

      <div className="space-y-2 text-sm mb-4">
        {Object.entries(attributes).map(([key, value]) => (
          <div key={key} className="flex">
            <span className="font-medium w-24 text-gray-600">{key}:</span>
            <span className="flex-1">{String(value)}</span>
          </div>
        ))}
        {created_at && (
          <div className="flex text-gray-400 text-xs mt-2">
            <span className="w-24">Created:</span>
            <span>{new Date(created_at as string).toLocaleString()}</span>
          </div>
        )}
      </div>

      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full p-2 text-red-500 border border-red-500 rounded hover:bg-red-50 text-sm"
        >
          Delete Polygon
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-red-600">Are you sure?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="flex-1 p-2 border rounded text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 p-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/PolygonDetail.tsx
git commit -m "feat: add PolygonDetail component with delete confirmation"
```

---

## Task 8: Create Main Page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Replace main page**

Replace `app/page.tsx`:
```typescript
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
```

**Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add main page wiring Map, AttributeForm, and PolygonDetail"
```

---

## Task 9: Clean Up Default Files

**Files:**
- Modify: `app/layout.tsx`
- Delete: default page content if any remains

**Step 1: Simplify layout**

Replace `app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GIS Drawing Tool',
  description: 'Draw and save polygon features over satellite imagery',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

**Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "chore: simplify layout and update metadata"
```

---

## Task 10: Add README

**Files:**
- Modify: `README.md`

**Step 1: Create README**

Replace `README.md`:
```markdown
# GIS Drawing Tool

A web application for drawing polygon features over satellite imagery and saving to a PostGIS database.

## Features

- Draw building footprints and agricultural fields on satellite imagery
- Flexible key-value attributes for each polygon
- Shared workspace for team collaboration
- Simple password authentication

## Tech Stack

- Next.js 14 with App Router
- Mapbox GL JS + Mapbox GL Draw
- Vercel Postgres (Neon) with PostGIS
- TypeScript

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd gis-drawing
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_MAPBOX_TOKEN` - Get from [Mapbox](https://account.mapbox.com/)
- `POSTGRES_URL` - Vercel Postgres connection string
- `AUTH_PASSWORD` - Shared password for team access
- `AUTH_SECRET` - Random 32+ character string for session signing

### 3. Set up database

Connect to your Postgres instance and run:

```bash
psql $POSTGRES_URL -f scripts/setup-db.sql
```

Or via Vercel dashboard SQL editor.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

1. Push to GitHub
2. Import to Vercel
3. Add Vercel Postgres from Storage tab
4. Enable PostGIS: run `CREATE EXTENSION postgis;` in SQL editor
5. Set environment variables
6. Deploy

## Usage

1. Enter the shared password to access the app
2. Click "Draw Polygon" to start drawing
3. Click points on the map to create vertices
4. Double-click to complete the polygon
5. Fill in attributes and save
6. Click existing polygons to view details or delete
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and usage instructions"
```

---

## Summary

After completing all tasks, you'll have:

1. **Next.js project** initialized with all dependencies
2. **Database schema** with PostGIS polygon storage
3. **Authentication** with shared password and session cookies
4. **API routes** for CRUD operations on polygons
5. **Map component** with Mapbox and drawing tools
6. **Attribute form** for flexible metadata entry
7. **Detail panel** for viewing and deleting polygons
8. **Main page** wiring everything together
9. **Documentation** for setup and deployment
