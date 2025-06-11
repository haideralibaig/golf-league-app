"use client";

import { useState } from 'react';

export default function CreateChaptersPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const createChapters = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/create-chapters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="text-2xl font-bold mb-4">Create Test Chapters</h1>
        <button
          onClick={createChapters}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Lahore & Karachi Chapters'}
        </button>
        
        {result && (
          <pre className="mt-4 bg-white p-4 rounded border overflow-auto">
            {result}
          </pre>
        )}
      </div>
    </div>
  );
}