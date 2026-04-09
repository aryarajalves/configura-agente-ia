import React from 'react';

interface ProcessProgressBarProps {
  progress: number;
  label: string;
}

export const ProcessProgressBar: React.FC<ProcessProgressBarProps> = ({ progress, label }) => {
  return (
    <div className="w-full max-w-md bg-gray-200 rounded-full dark:bg-gray-700 p-1">
      <div className="flex justify-between text-xs mb-1 px-1">
        <span>{label}</span>
        <span>{progress.toFixed(1)}%</span>
      </div>
      <div 
        className="bg-blue-600 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full transition-all duration-300" 
        style={{ width: `${progress}%` }}>
      </div>
    </div>
  );
};
