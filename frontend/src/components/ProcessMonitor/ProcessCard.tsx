import React from 'react';
import { ProcessState } from '../../queries/useProcesses';
import { ProcessProgressBar } from './ProcessProgressBar';

interface ProcessCardProps {
  process: ProcessState;
  onRetry?: (id: string) => void;
  onViewLogs?: (id: string) => void;
}

export const ProcessCard: React.FC<ProcessCardProps> = ({ process, onRetry, onViewLogs }) => {
  return (
    <div className="border p-4 rounded shadow-sm bg-white">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold">{process.name}</h3>
          <p className="text-xs text-gray-500">{process.process_id}</p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-bold ${
          process.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
          process.status === 'FAILED' ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {process.status}
        </span>
      </div>
      
      <div className="mb-4">
        <ProcessProgressBar progress={process.total_progress} label={process.current_step_name} />
      </div>

      <div className="flex space-x-2">
        <button 
          onClick={() => onViewLogs?.(process.process_id)}
          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded"
        >
          View Logs
        </button>
        {process.status === 'FAILED' && (
          <button 
            onClick={() => onRetry?.(process.process_id)}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};
