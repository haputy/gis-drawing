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
