import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, className = '' }) => {
  return (
    <div
      className={`h-40 flex flex-col items-center justify-center text-center border border-dashed border-gray-200 rounded-lg p-6 bg-gray-50/50 ${className}`}
    >
      <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 mb-3">
        <Icon size={22} strokeWidth={1.5} />
      </div>
      <p className="text-sm font-bold text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 font-medium mt-1 max-w-[220px] leading-relaxed">{description}</p>
    </div>
  );
};

export default EmptyState;
