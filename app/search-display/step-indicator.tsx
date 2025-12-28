'use client';

// Re-export StatusIndicator with step-specific defaults for backwards compatibility
import { StatusIndicator } from '@/components/ui/status-indicator';

interface StepIndicatorProps {
  status: 'pending' | 'active' | 'completed';
}

export function StepIndicator({ status }: StepIndicatorProps) {
  return (
    <StatusIndicator
      status={status}
      size="sm"
      showIcon={status === 'completed'}
      animate={status === 'active'}
    />
  );
}
