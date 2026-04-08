import React, { useEffect, useState } from 'react';
import { skillStatusService, SkillStatusResponse } from '../services/skillStatusService';

export const HybridSkillStatus: React.FC<{ skillId: string }> = ({ skillId }) => {
  const [status, setStatus] = useState<SkillStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!skillId) return;

    const unsubscribe = skillStatusService.subscribeToStatus(
      skillId,
      (newStatus) => {
        setStatus(newStatus);
        setError(null);
      },
      (err) => {
        setError("Error fetching status.");
        console.error(err);
      }
    );

    return unsubscribe;
  }, [skillId]);

  if (error) return <div className="text-red-500">{error}</div>;
  if (!status) return <div>Loading status...</div>;

  const handleRetry = async () => {
    try {
      await fetch(`/api/v1/skills/${skillId}/versions/latest/retry`, { method: 'POST' });
      alert("Retry queued!");
    } catch (e) {
      alert("Failed to retry");
    }
  };

  const handleActivate = async () => {
    try {
      await fetch(`/api/v1/skills/${skillId}/versions/latest/activate`, { method: 'POST' });
      alert("Version Activated!");
    } catch (e) {
      alert("Failed to activate");
    }
  };

  return (
    <div className="p-4 border rounded shadow-sm mt-4 bg-gray-50">
      <h3 className="text-lg font-bold">Hybrid Skill Status</h3>
      <p><strong>Skill ID:</strong> {status.skill_id}</p>
      <p><strong>Status:</strong> {status.status}</p>
      {status.version_status && (
        <div className="mt-2 text-sm">
          <p><strong>Version Status:</strong> 
            <span className={`ml-2 px-2 py-1 rounded text-white ${
              status.version_status === 'active' ? 'bg-green-500' :
              status.version_status === 'error' ? 'bg-red-500' :
              status.version_status === 'attention' ? 'bg-yellow-500' :
              'bg-blue-500'
            }`}>
              {status.version_status}
            </span>
          </p>
          {status.last_processed_at && (
            <p><strong>Last Processed:</strong> {new Date(status.last_processed_at).toLocaleString()}</p>
          )}
          <div className="mt-2 flex gap-2">
            {(status.version_status === 'error' || status.version_status === 'attention') && (
              <button onClick={handleRetry} className="bg-red-600 text-white px-2 py-1 rounded text-xs">
                Retry Ingestion
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
