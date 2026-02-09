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

const PRIMARY_FIELDS = ['poi_name', 'naics_code'] as const;
const AUTO_FIELDS = ['placekey', 'poi_source', 'geometry_type', 'iso_country_code', 'batch_id'] as const;

const FIELD_LABELS: Record<string, string> = {
  poi_name: 'POI Name',
  naics_code: 'NAICS Code',
  placekey: 'Placekey',
  poi_source: 'Source',
  geometry_type: 'Geometry',
  iso_country_code: 'Country',
  batch_id: 'Batch ID',
  created_at: 'Created',
  last_edited_date: 'Last Edited',
};

export default function PolygonDetail({ polygon, onClose, onDelete }: PolygonDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const props = polygon.properties;

  async function handleDelete() {
    setDeleting(true);
    await onDelete(polygon.id);
    setDeleting(false);
  }

  function formatTimestamp(value: unknown): string {
    const num = Number(value);
    if (!isNaN(num)) return new Date(num).toLocaleString();
    return String(value);
  }

  return (
    <div className="absolute top-4 right-16 bg-white rounded-lg shadow-xl p-4 w-72 z-10">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">POI Details</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          x
        </button>
      </div>

      {/* Primary fields */}
      <div className="space-y-2 text-sm mb-3">
        {PRIMARY_FIELDS.map((key) =>
          props[key] != null ? (
            <div key={key} className="flex">
              <span className="font-medium w-24 text-gray-600">{FIELD_LABELS[key]}:</span>
              <span className="flex-1">{String(props[key])}</span>
            </div>
          ) : null
        )}
      </div>

      {/* Auto-populated fields */}
      <div className="border-t pt-2 space-y-1 text-xs text-gray-500 mb-4">
        {AUTO_FIELDS.map((key) =>
          props[key] != null ? (
            <div key={key} className="flex">
              <span className="w-24">{FIELD_LABELS[key]}:</span>
              <span className="flex-1 truncate" title={String(props[key])}>{String(props[key])}</span>
            </div>
          ) : null
        )}
        {props.created_at != null && (
          <div className="flex">
            <span className="w-24">{FIELD_LABELS.created_at}:</span>
            <span>{formatTimestamp(props.created_at)}</span>
          </div>
        )}
        {props.last_edited_date != null && (
          <div className="flex">
            <span className="w-24">{FIELD_LABELS.last_edited_date}:</span>
            <span>{formatTimestamp(props.last_edited_date)}</span>
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
