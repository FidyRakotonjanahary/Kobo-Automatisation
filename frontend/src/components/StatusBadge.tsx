import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  error:   'bg-rose-50 text-rose-700 border-rose-100',
  info:    'bg-indigo-50 text-indigo-700 border-indigo-100',
  neutral: 'bg-gray-50 text-gray-600 border-gray-100',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, children, className = '' }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium leading-none ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export default StatusBadge;
