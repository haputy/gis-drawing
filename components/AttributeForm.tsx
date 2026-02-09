'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

let placekeyCounter = 0;
const sessionBatchId = uuidv4();

interface AttributeFormProps {
  onSave: (attributes: Record<string, string>) => void;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}

export default function AttributeForm({ onSave, onCancel, loading, error }: AttributeFormProps) {
  const [poiName, setPoiName] = useState('');
  const [naicsCode, setNaicsCode] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!poiName.trim() || !naicsCode.trim()) return;

    placekeyCounter++;
    const now = Date.now();

    onSave({
      poi_name: poiName.trim(),
      naics_code: naicsCode.trim(),
      placekey: `WAD-${placekeyCounter}`,
      poi_source: 'new',
      geometry_type: 'POLYGON',
      iso_country_code: 'US',
      batch_id: sessionBatchId,
      created_at: String(now),
      last_edited_date: String(now),
    });
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl p-6 w-96 max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">POI Details</h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">POI Name *</label>
            <input
              type="text"
              value={poiName}
              onChange={(e) => setPoiName(e.target.value)}
              placeholder="e.g. Starbucks"
              className="w-full p-2 border rounded text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">NAICS Code *</label>
            <input
              type="text"
              value={naicsCode}
              onChange={(e) => setNaicsCode(e.target.value)}
              placeholder="e.g. 722515"
              className="w-full p-2 border rounded text-sm"
              required
            />
          </div>
        </div>

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
            disabled={loading || !poiName.trim() || !naicsCode.trim()}
            className="flex-1 p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
