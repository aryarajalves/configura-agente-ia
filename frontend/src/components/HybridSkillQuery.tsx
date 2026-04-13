import React, { useState } from 'react';

export const HybridSkillQuery: React.FC<{ skillId: string }> = ({ skillId }) => {
  const [query, setQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleQuery = async () => {
    try {
      const res = await fetch(`/api/v1/knowledge-bases/${skillId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          context: { product_id: productId }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Query failed");
      setResult(data);
      setError('');
    } catch (e: any) {
      setError(e.message);
      setResult(null);
    }
  };

  return (
    <div className="p-4 border rounded shadow-sm mt-4 bg-white">
      <h3 className="text-lg font-bold">Hybrid Query</h3>
      <div className="flex flex-col gap-2 max-w-sm mt-2">
        <input 
          type="text" 
          placeholder="Product ID (e.g. 123)" 
          value={productId} 
          onChange={e => setProductId(e.target.value)} 
          className="border p-2"
        />
        <textarea 
          placeholder="What is the price?" 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          className="border p-2"
        />
        <button onClick={handleQuery} className="bg-purple-600 text-white p-2 rounded">
          Ask
        </button>
      </div>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      {result && (
        <div className="mt-4 p-3 bg-gray-100 rounded">
          <p><strong>Answer:</strong> {result.answer}</p>
          <div className="mt-2 text-sm text-gray-700">
            <p><strong>Metadata:</strong> Price: ${result.metadata_?.price}, Stock: {result.metadata_?.stock}</p>
          </div>
        </div>
      )}
    </div>
  );
};
