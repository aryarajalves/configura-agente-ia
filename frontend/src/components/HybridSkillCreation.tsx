import React, { useState } from 'react';

export const HybridSkillCreation: React.FC = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [skillId, setSkillId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState('');
  const [uploading, setUploading] = useState(false);

  const createSkill = async () => {
    try {
      const res = await fetch('/api/v1/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, type: 'hibrida' })
      });
      const data = await res.json();
      setSkillId(data.id);
    } catch (e) {
      console.error(e);
      alert("Failed to create skill");
    }
  };

  const uploadSource = async () => {
    if (!skillId || !file) return;
    setUploading(true);
    try {
      // Dummy flow for Phase 1 - US1
      // Assuming a real endpoint handles multipart or presigned URLs
      await fetch(`/api/v1/knowledge-bases/${skillId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'pdf',
          source_uri: `dummy://uploaded/${file.name}`,
          metadata_: {
            filename: file.name,
            product_id: tableName // linking the table conceptually for US1 MVP
          }
        })
      });
      alert("Source uploaded and ingestion started!");
    } catch (e) {
      console.error(e);
      alert("Failed to upload source");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 border rounded shadow-sm">
      <h2 className="text-lg font-bold mb-4">Create Hybrid Skill</h2>
      {!skillId ? (
        <div className="flex flex-col gap-2 max-w-sm">
          <input 
            type="text" 
            placeholder="Skill Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="border p-2"
          />
          <textarea 
            placeholder="Description..." 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            className="border p-2"
          />
          <button onClick={createSkill} className="bg-blue-500 text-white p-2 rounded">
            Create
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-w-sm">
          <p className="text-green-600 font-semibold">Skill Created! ID: {skillId}</p>
          <hr />
          <h3 className="font-semibold">Upload Source Document</h3>
          <input 
            type="file" 
            onChange={e => setFile(e.target.files?.[0] || null)} 
            className="border p-2"
          />
          <h3 className="font-semibold mt-2">Select Postgres Table</h3>
          <input 
            type="text" 
            placeholder="e.g. products" 
            value={tableName} 
            onChange={e => setTableName(e.target.value)} 
            className="border p-2"
          />
          <button onClick={uploadSource} disabled={uploading || !file || !tableName} className="bg-green-500 text-white p-2 rounded disabled:opacity-50">
            {uploading ? 'Processing...' : 'Start Ingestion'}
          </button>
        </div>
      )}
    </div>
  );
};
