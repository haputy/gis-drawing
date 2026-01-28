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
        {created_at != null && (
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
