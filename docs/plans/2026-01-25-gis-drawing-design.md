# GIS Drawing Tool - Design Document

## Overview

A web application for drawing polygon features (building footprints and agricultural fields) over satellite imagery, saving to a PostGIS database.

## Requirements

- Web interface with Mapbox satellite imagery
- Polygon drawing tools for buildings and agricultural fields
- Small team usage with shared workspace
- Simple shared password authentication
- Flexible key-value attributes on each polygon
- Create-only with soft delete (no editing)
- PostGIS database hosted on Vercel

## Tech Stack

- **Next.js 14** with App Router
- **Mapbox GL JS** + **Mapbox GL Draw**
- **Vercel Postgres** (Neon) with PostGIS extension
- **TypeScript**

## Project Structure

```
/app
  /api
    /polygons      - GET (fetch all) and POST (create new)
    /polygons/[id] - DELETE (soft delete)
    /auth          - POST to verify password, set session cookie
  /(main)
    page.tsx       - map interface (protected)
    layout.tsx
  /login
    page.tsx       - password entry
/components
  Map.tsx          - Mapbox map with draw controls
  AttributeForm.tsx - modal for entering polygon attributes
/lib
  db.ts            - database connection
  auth.ts          - session helpers
```

## Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE polygons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geometry      GEOMETRY(Polygon, 4326) NOT NULL,
  attributes    JSONB DEFAULT '{}',
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at    TIMESTAMP WITH TIME ZONE  -- soft delete
);

CREATE INDEX idx_polygons_geometry ON polygons USING GIST (geometry);
CREATE INDEX idx_polygons_deleted ON polygons (deleted_at) WHERE deleted_at IS NULL;
```

### Schema Notes

- **SRID 4326**: Standard WGS84 coordinates (what Mapbox uses)
- **JSONB attributes**: Flexible key-value storage, queryable if needed
- **Soft delete**: `deleted_at` timestamp instead of actual deletion
- **GiST index**: Fast spatial queries
- **UUID primary key**: No sequential IDs exposed in API

## API Routes

### GET `/api/polygons`

Returns all non-deleted polygons with GeoJSON-formatted geometry.

```sql
SELECT id, ST_AsGeoJSON(geometry) as geometry, attributes, created_at
FROM polygons
WHERE deleted_at IS NULL
```

### POST `/api/polygons`

Creates a new polygon.

**Request:**
```json
{
  "geometry": { "type": "Polygon", "coordinates": [...] },
  "attributes": { "name": "Field A", "type": "agricultural" }
}
```

**Response:** Created polygon with ID.

### DELETE `/api/polygons/[id]`

Soft deletes by setting `deleted_at = NOW()`. Returns 204 on success.

### POST `/api/auth`

- Accepts `{ "password": "..." }`
- Compares against `AUTH_PASSWORD` env var
- Sets HTTP-only session cookie on success
- Returns 401 on failure

## Authentication

1. User visits app → redirected to `/login` if no session
2. Enters shared password → API verifies against env var
3. Session cookie set (7 day expiry) → user can access map
4. Middleware checks cookie on protected routes

## Map Interface

### Map Component

- Full-screen Mapbox GL map with satellite imagery (`mapbox://styles/mapbox/satellite-v9`)
- Mapbox GL Draw plugin with polygon mode only
- Configurable initial view center and zoom

### Drawing Workflow

1. User clicks "Draw" button → enters polygon drawing mode
2. Clicks points on the map to form polygon vertices
3. Double-clicks or clicks first point to complete the shape
4. Modal appears with attribute form
5. User fills in key-value pairs (dynamic "add field" button)
6. Clicks "Save" → POST to API → polygon saved
7. Modal closes, polygon remains visible on map

### Displaying Existing Polygons

- On page load, fetch all polygons from API
- Add as GeoJSON source to the map
- Style with semi-transparent fill, visible border
- Click polygon to view attributes in popup/panel

### Soft Delete

- View polygon details shows "Delete" button
- Confirmation prompt → DELETE endpoint → removes from map

## Error Handling

### Drawing Errors

- Self-intersecting polygons: Server-side validation with clear error message
- Minimum 3 points: Handled by Draw plugin

### API Errors

- Invalid geometry → 400 "Invalid polygon geometry"
- Database failure → 500 "Failed to save" (details logged server-side)
- Unauthorized → 401, redirect to login

### Network Handling

- Loading spinner while saving
- On save failure, keep modal open with error (preserve user's data)
- On fetch failure, error banner with retry button

### Concurrency

- Create-only means no conflicts
- Multiple users can draw simultaneously
- New polygons appear on page refresh (no real-time sync in v1)

## Environment Variables

```
# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx

# Database (Vercel Postgres provides automatically)
POSTGRES_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...

# Auth
AUTH_PASSWORD=your-shared-team-password
AUTH_SECRET=random-string-for-signing-cookies

# Optional
NEXT_PUBLIC_DEFAULT_CENTER=[-122.4, 37.8]
NEXT_PUBLIC_DEFAULT_ZOOM=12
```

## Deployment

1. Create Vercel project, connect to git repo
2. Add Vercel Postgres from Storage tab
3. Enable PostGIS: `CREATE EXTENSION postgis;`
4. Set environment variables
5. Deploy

## Local Development

- `vercel env pull` for database credentials
- Or local Postgres with PostGIS via Docker
- `npm run dev` starts on localhost:3000
