'use client';

// ============================================
// Re-export from unified StatusIndicator for backwards compatibility
// The actual implementation is in status-indicator.tsx
// ============================================

export { 
  StatusIcon, 
  PrimaryStatusIndicator as PrimaryStatusIcon,
} from './status-indicator';
