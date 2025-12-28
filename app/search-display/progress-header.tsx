'use client';

import { Loader2, Check, Clock } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { SearchStep, SearchPhase } from '@/lib/langgraph-search-engine';
import { MobileStepProgress } from './mobile-step-progress';
import { FaviconStack } from '@/components/ui/favicon-stack';

interface ProgressHeaderProps {
  title: string;
  time: string;
  sourcesCount: number;
  sourceUrls: string[];
  isComplete: boolean;
  steps?: SearchStep[];
  currentPhase?: SearchPhase | null;
}

// Reusable status indicator with glow effect
function StatusIndicatorWithGlow({ 
  isComplete, 
  size = 'md' 
}: { 
  isComplete: boolean; 
  size?: 'sm' | 'md';
}) {
  const sizeClasses = size === 'sm' 
    ? { wrapper: 'w-4 h-4', icon: 'icon-2xs' }
    : { wrapper: 'w-5 h-5', icon: 'icon-xs' };

  if (isComplete) {
    return (
      <div className="relative flex-shrink-0">
        <div className={`absolute inset-0 ${sizeClasses.wrapper} rounded-full bg-primary/20 blur-[2px]`} />
        <div className={`relative ${sizeClasses.wrapper} rounded-full bg-primary flex-center`}>
          <Check className={`${sizeClasses.icon} text-primary-foreground`} strokeWidth={size === 'sm' ? 3 : 2.5} />
        </div>
      </div>
    );
  }
  
  return (
    <Loader2 className={`${sizeClasses.wrapper} animate-spin text-primary flex-shrink-0`} />
  );
}

// Loading skeleton for favicon stack
function FaviconStackSkeleton({ count }: { count: number }) {
  const skeletonCount = Math.min(3, Math.max(0, count));
  
  if (skeletonCount === 0) return null;
  
  return (
    <div className="favicon-stack">
      {[...Array(skeletonCount)].map((_, i) => (
        <div 
          key={i}
          className="w-[18px] h-[18px] rounded-full bg-muted/60 border-2 border-card animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

export function ProgressHeader({ 
  title, 
  time, 
  sourcesCount, 
  sourceUrls,
  isComplete,
  steps,
  currentPhase
}: ProgressHeaderProps) {
  const isMobile = useIsMobile();
  const maxFavicons = isMobile ? 4 : 5;

  // Mobile layout
  if (isMobile) {
    return (
      <div className={isComplete ? 'card-status-complete p-3' : 'card-status p-3'}>
        <div className="flex-between gap-3">
          {/* Status indicator + label */}
          <div className="flex items-center gap-2 min-w-0">
            <StatusIndicatorWithGlow isComplete={isComplete} size="sm" />
            <span className={`text-label truncate ${isComplete ? 'text-primary' : 'text-foreground'}`}>
              {title}
            </span>
          </div>
          
          {/* Time + Sources inline */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {sourceUrls.length > 0 && (
              <FaviconStack urls={sourceUrls} max={3} size="sm" />
            )}
            
            <span className="text-xs font-bold tabular-nums text-foreground">
              {sourcesCount}
            </span>
            
            <div className="badge-status px-1.5 py-0.5">
              <Clock className="icon-2xs text-muted-foreground" />
              <span className="text-[10px] font-mono font-medium text-foreground tabular-nums">
                {time}
              </span>
            </div>
          </div>
        </div>
        
        {/* Horizontal progress bar for mobile */}
        {steps && steps.length > 0 && !isComplete && (
          <div className="mt-2.5 pt-2 border-t border-border/30">
            <MobileStepProgress steps={steps} currentPhase={currentPhase || null} />
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={isComplete ? 'card-status-complete' : 'card-status'}>
      {/* Header row */}
      <div className="flex-between mb-4">
        <div className="flex items-center gap-2.5">
          <StatusIndicatorWithGlow isComplete={isComplete} size="md" />
          <span className={`text-label ${isComplete ? 'text-primary' : 'text-foreground'}`}>
            {title}
          </span>
        </div>
        <div className="badge-status">
          <Clock className="icon-sm text-muted-foreground" />
          <span className="text-xs font-mono font-medium text-foreground tabular-nums">
            {time}
          </span>
        </div>
      </div>
      
      {/* Sources row */}
      <div className="flex-between pt-3 border-t border-border/40">
        <span className="text-caption">Sources discovered</span>
        <div className="flex items-center gap-2">
          {sourceUrls.length > 0 ? (
            <FaviconStack urls={sourceUrls} max={maxFavicons} size="md" />
          ) : (
            <FaviconStackSkeleton count={sourcesCount} />
          )}
          <span className={`text-sm font-bold tabular-nums ${
            sourcesCount > 0 ? 'text-foreground' : 'text-muted-foreground'
          }`}>
            {sourcesCount}
          </span>
        </div>
      </div>
    </div>
  );
}
