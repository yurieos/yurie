'use client';

import { cva, type VariantProps } from "class-variance-authority";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// StatusIndicator - Unified status display component
// Replaces: step-indicator.tsx and status-icon.tsx
// ============================================

const statusVariants = cva(
  "flex items-center justify-center rounded-full transition-all duration-200",
  {
    variants: {
      status: {
        pending: "border-2 border-muted-foreground/20 bg-transparent",
        active: "bg-primary",
        completed: "bg-primary",
        loading: "bg-muted",
        success: "bg-emerald-100 dark:bg-emerald-900/30",
        error: "bg-destructive/20",
      },
      size: {
        xs: "w-3 h-3",
        sm: "w-3.5 h-3.5",
        md: "w-5 h-5",
      },
    },
    defaultVariants: {
      status: "pending",
      size: "sm",
    },
  }
);

const iconSizes = {
  xs: "w-2 h-2",
  sm: "w-2 h-2", 
  md: "w-3 h-3",
} as const;

const iconColors = {
  pending: "",
  active: "text-primary-foreground",
  completed: "text-primary-foreground",
  loading: "text-muted-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-destructive",
} as const;

export interface StatusIndicatorProps
  extends VariantProps<typeof statusVariants> {
  showIcon?: boolean;
  animate?: boolean;
  className?: string;
}

export function StatusIndicator({ 
  status = "pending", 
  size = "sm", 
  showIcon = true,
  animate = true,
  className 
}: StatusIndicatorProps) {
  const iconClass = cn(iconSizes[size || "sm"], iconColors[status || "pending"]);

  // Active with animation (for step progress)
  if (status === "active" && animate) {
    return (
      <div className="relative flex items-center justify-center w-3.5 h-3.5">
        <div className="absolute inset-[-4px] rounded-full border border-primary/25 animate-timeline-ripple opacity-0" />
        <div className="absolute inset-[-2px] rounded-full bg-primary/20 blur-[3px] animate-timeline-glow" />
        <div className={cn(statusVariants({ status, size }), "animate-timeline-breathe", className)} />
      </div>
    );
  }

  // Loading spinner
  if (status === "loading" && showIcon) {
    return (
      <div className={cn(statusVariants({ status, size }), className)}>
        <Loader2 className={cn(iconClass, "animate-spin")} />
      </div>
    );
  }

  // Completed with checkmark
  if (status === "completed" && showIcon) {
    return (
      <div className={cn(statusVariants({ status, size }), className)}>
        <Check className={iconClass} strokeWidth={3} />
      </div>
    );
  }

  // Success with checkmark
  if (status === "success" && showIcon) {
    return (
      <div className={cn(statusVariants({ status, size }), className)}>
        <Check className={iconClass} strokeWidth={2.5} />
      </div>
    );
  }

  // Error with icon
  if (status === "error" && showIcon) {
    return (
      <div className={cn(statusVariants({ status, size }), className)}>
        <AlertCircle className={iconClass} />
      </div>
    );
  }

  // Default (pending or no icon)
  return <div className={cn(statusVariants({ status, size }), className)} />;
}

// ============================================
// PrimaryStatusIndicator - For search-related status
// Convenience wrapper with primary color scheme
// ============================================

export interface PrimaryStatusIndicatorProps {
  complete: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export function PrimaryStatusIndicator({ 
  complete, 
  size = "xs",
  className 
}: PrimaryStatusIndicatorProps) {
  const iconClass = iconSizes[size];
  
  if (complete) {
    return (
      <div className={cn("icon-wrapper-primary", className)}>
        <Check className={cn(iconClass, "text-primary")} strokeWidth={2.5} />
      </div>
    );
  }
  
  return (
    <div className={cn("icon-wrapper-primary", className)}>
      <Loader2 className={cn(iconClass, "animate-spin text-primary")} />
    </div>
  );
}

// ============================================
// StatusIcon - Backwards compatible wrapper
// Matches the original status-icon.tsx API
// ============================================

type LegacyStatus = 'loading' | 'success' | 'error' | 'pending';
type LegacySize = '2xs' | 'xs' | 'sm' | 'md';

interface StatusIconProps {
  status: LegacyStatus;
  size?: LegacySize;
  className?: string;
}

const legacySizeMap: Record<LegacySize, "xs" | "sm" | "md"> = {
  '2xs': 'xs',
  'xs': 'xs',
  'sm': 'sm',
  'md': 'md',
};

const legacyStatusMap: Record<LegacyStatus, "pending" | "loading" | "success" | "error"> = {
  'loading': 'loading',
  'success': 'success',
  'error': 'error',
  'pending': 'pending',
};

export function StatusIcon({ status, size = 'xs', className }: StatusIconProps) {
  return (
    <StatusIndicator
      status={legacyStatusMap[status]}
      size={legacySizeMap[size]}
      className={className}
    />
  );
}

// ============================================
// Exports for variant access (CVA pattern)
// ============================================

export { statusVariants };

