import { Loader2 } from 'lucide-react';

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
  xl: 'w-14 h-14',
};

/**
 * LoadingSpinner — Spinner animé réutilisable
 */
export default function LoadingSpinner({ size = 'md', className = '' }) {
  return (
    <Loader2
      className={`animate-spin text-brand-500 ${sizeClasses[size]} ${className}`}
    />
  );
}
