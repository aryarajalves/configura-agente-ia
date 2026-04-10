import React, { useState, useEffect } from 'react';

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  metadata?: any;
}

interface StepLogs {
  step_id: string;
  step_name: string;
  logs: LogEntry[];
}

interface LogViewerProps {
  processId: string;
  onClose: () => void;
}

export const LogViewer: React.FC<LogViewerProps> = ({ processId, onClose }) => {
  const [logs, setLogs] = useState<StepLogs[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock fetch
    const fetchLogs = async () => {
      setLoading(true);
      // await fetch(`/api/v1/processes/${processId}/logs`)
      const mockLogs: StepLogs[] = [
        {
          step_id: '1',
          step_name: 'Upload',
          logs: [
            { level: 'INFO', message: 'Starting upload', timestamp: '2026-04-09T12:00:00Z' },
            { level: 'INFO', message: 'Upload complete', timestamp: '2026-04-09T12:01:00Z' }
          ]
        },
        {
          step_id: '2',
          step_name: 'AI Processing',
          logs: [
            { level: 'INFO', message: 'Vectorizing...', timestamp: '2026-04-09T12:02:00Z' },
            { level: 'ERROR', message: 'LangGraph timeout', timestamp: '2026-04-09T12:03:00Z', metadata: { trace: '...' } }
          ]
        }
      ];
      setLogs(mockLogs);
      setLoading(false);
    };

    fetchLogs();
  }, [processId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Logs do Processo: {processId}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <p>Carregando logs...</p>
          ) : (
            <div className="space-y-4">
              {logs.map(step => (
                <div key={step.step_id} className="border rounded">
                  <div className="bg-gray-100 p-2 font-semibold">{step.step_name}</div>
                  <div className="p-2 space-y-1">
                    {step.logs.map((log, idx) => (
                      <div key={idx} className={`text-sm ${log.level === 'ERROR' ? 'text-red-600' : 'text-gray-700'}`}>
                        <span className="text-gray-400">[{log.timestamp}]</span> [{log.level}] {log.message}
                        {log.metadata && (
                          <pre className="mt-1 p-2 bg-gray-200 rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
