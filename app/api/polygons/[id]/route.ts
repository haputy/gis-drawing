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
