import React, { useEffect, useState } from 'react';
import { ProcessTerminal } from '../../queries/useProcesses';

interface ProcessToastProps {
  notification: ProcessTerminal | null;
}

export const ProcessToast: React.FC<ProcessToastProps> = ({ notification }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!visible || !notification) return null;

  const bgColor = notification.toast_type === 'success' ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg transition-opacity duration-300`}>
      <p className="font-bold">{notification.status}</p>
      <p className="text-sm">{notification.message}</p>
    </div>
  );
};
