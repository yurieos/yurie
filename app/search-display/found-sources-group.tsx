'use client';

import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { SearchEvent, SearchPhase } from '@/lib/langgraph-search-engine';
import { SourceProcessingLine } from './source-processing-line';
import { renderEvent } from './event-renderer';

interface SourceState {
  url: string;
  title: string;
  stage: 'browsing' | 'extracting' | 'analyzing' | 'complete';
  summary?: string;
}

interface FoundSourcesGroupProps {
  event: SearchEvent;
  sources: SourceState[];
  defaultExpanded: boolean;
  completedPhases: Set<string>;
  currentPhase: SearchPhase | null;
  events: SearchEvent[];
}

export function FoundSourcesGroup({ 
  event, 
  sources, 
  defaultExpanded, 
  completedPhases, 
  currentPhase, 
  events 
}: FoundSourcesGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);
  
  return (
    <div className="animate-fade-in">
      <div className="flex-between gap-2">
        <div className="flex-1">
          {renderEvent(event, completedPhases, currentPhase, false, events)}
        </div>
        {sources.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn-expand"
            aria-label={isExpanded ? "Collapse sources" : "Expand sources"}
          >
            <ChevronRight 
              className={`w-3 h-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
            />
          </button>
        )}
      </div>
      <div 
        className={`ml-7 mt-1 overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded && sources.length > 0 ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-1">
          {sources.map((source, index) => (
            <div
              key={source.url}
              className="animate-slide-down"
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'both'
              }}
            >
              <SourceProcessingLine
                url={source.url}
                stage={source.stage}
                summary={source.summary}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

