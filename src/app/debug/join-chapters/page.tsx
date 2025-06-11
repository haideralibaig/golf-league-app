"use client";

import { useState } from 'react';

export default function JoinChaptersPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const joinAllChapters = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/join-all-chapters', {
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
        <h1 className="text-2xl font-bold mb-4">Join All Chapters</h1>
        <p className="text-gray-600 mb-4">
          This will add the current user to all chapters they're not already a member of.
        </p>
        <button
          onClick={joinAllChapters}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Joining...' : 'Join All Available Chapters'}
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