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
