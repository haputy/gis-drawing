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
