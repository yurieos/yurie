'use client';

import { Check } from 'lucide-react';
import { getHostname } from '@/lib/url-utils';
import { InlineFavicon } from '@/components/ui/favicon-stack';

interface SourceProcessingLineProps {
  url: string;
  stage: 'browsing' | 'extracting' | 'analyzing' | 'complete';
  summary?: string;
}

const stageLabels = {
  browsing: 'Browsing',
  extracting: 'Extracting',
  analyzing: 'Analyzing',
  complete: 'Complete'
};

export function SourceProcessingLine({ url, stage, summary }: SourceProcessingLineProps) {
  return (
    <div className="group flex items-start gap-2 text-xs py-1 animate-fade-in">
      <InlineFavicon url={url} size="xs" className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-muted-foreground truncate">
          {getHostname(url)}
        </div>
        {stage === 'complete' ? (
          summary ? (
            <div className="text-muted-foreground/70 mt-0.5">
              {summary}
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <Check className="icon-xs text-emerald-600 dark:text-emerald-400" />
              <span className="text-muted-foreground/70">Complete</span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <div className="dot-active" />
            <span className="text-muted-foreground/70">
              {stageLabels[stage]}...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
