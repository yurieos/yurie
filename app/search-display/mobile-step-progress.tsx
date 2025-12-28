'use client';

import { SearchStep, SearchPhase } from '@/lib/langgraph-search-engine';

interface MobileStepProgressProps {
  steps: SearchStep[];
  currentPhase: SearchPhase | null;
}

export function MobileStepProgress({ steps }: MobileStepProgressProps) {
  // Filter to only main phases for mobile (not individual search queries)
  const mainSteps = steps.filter(s => !s.id.startsWith('search-'));
  const completedCount = mainSteps.filter(s => s.status === 'completed').length;
  const totalSteps = mainSteps.length;
  const progress = totalSteps > 0 ? (completedCount / totalSteps) * 100 : 0;
  
  return (
    <div className="flex items-center gap-2">
      {/* Progress bar */}
      <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {/* Step count */}
      <span className="text-[10px] font-medium text-muted-foreground tabular-nums whitespace-nowrap">
        {completedCount}/{totalSteps}
      </span>
    </div>
  );
}

