import React from 'react';
import { useProcesses } from '../queries/useProcesses';
import { ProcessCard } from '../components/ProcessMonitor/ProcessCard';
import { LogViewer } from '../components/ProcessMonitor/LogViewer';

export const ProcessDashboard: React.FC<{ userId: string }> = ({ userId }) => {
  const { processes, lastNotification } = useProcesses(userId);
  const [selectedProcessId, setSelectedProcessId] = React.useState<string | null>(null);
  const processList = Object.values(processes);

  const handleRetry = async (id: string) => {
    console.log('Retrying', id);
    // await fetch(`/api/v1/processes/${id}/retry`, { method: 'POST' });
  };

  const handleDelete = async (ids: string[]) => {
    console.log('Deleting', ids);
    // await fetch(`/api/v1/processes/`, { method: 'DELETE', body: JSON.stringify(ids) });
  };

  return (
    <div className="p-4">
      <ProcessToast notification={lastNotification} />
      {selectedProcessId && (
        <LogViewer 
          processId={selectedProcessId} 
          onClose={() => setSelectedProcessId(null)} 
        />
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Painel de Processos em Background</h1>
        {processList.length > 0 && (
          <button 
            onClick={() => handleDelete(processList.map(p => p.process_id))}
            className="text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Limpar Tudo
          </button>
        )}
      </div>
      {processList.length === 0 ? (
        <p className="text-gray-500 italic">Nenhum processo ativo no momento.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {processList.map(proc => (
            <ProcessCard 
              key={proc.process_id} 
              process={proc} 
              onRetry={handleRetry}
              onViewLogs={(id) => setSelectedProcessId(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
