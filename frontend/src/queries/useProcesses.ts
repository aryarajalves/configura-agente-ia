import { useState, useEffect } from 'react';

export interface ProcessState {
  process_id: string;
  name: string;
  status: string;
  total_progress: number;
  current_step_name: string;
  is_active: boolean;
}

export interface ProcessTerminal {
  process_id: string;
  status: string;
  message: string;
  toast_type: string;
}

export function useProcesses(userId: string) {
  const [processes, setProcesses] = useState<Record<string, ProcessState>>({});
  const [lastNotification, setLastNotification] = useState<ProcessTerminal | null>(null);

  useEffect(() => {
    if (!userId) return;
    
    const ws = new WebSocket(`ws://localhost:8000/api/v1/ws/processes/${userId}`);
    
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "process_update") {
        setProcesses(prev => ({
          ...prev,
          [parsed.data.process_id]: parsed.data
        }));
      } else if (parsed.type === "process_terminal") {
        setLastNotification(parsed.data);
      }
    };

    return () => {
      ws.close();
    };
  }, [userId]);

  return { processes, lastNotification };
}
