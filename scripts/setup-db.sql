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
