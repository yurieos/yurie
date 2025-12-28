'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { SearchEvent, SearchStep, SearchPhase } from '@/lib/langgraph-search-engine';
import { useIsMobile } from '@/hooks/use-mobile';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { StepIndicator } from './step-indicator';
import { ProgressHeader } from './progress-header';
import { FoundSourcesGroup } from './found-sources-group';
import { renderEvent } from './event-renderer';

interface SourceState {
  url: string;
  title: string;
  stage: 'browsing' | 'extracting' | 'analyzing' | 'complete';
  summary?: string;
}

export function SearchDisplay({ events }: { events: SearchEvent[] }) {
  const [steps, setSteps] = useState<SearchStep[]>([]);
  const [, setStreamedContent] = useState('');
  const [showFinalResult, setShowFinalResult] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(new Set());
  const [, setSearchQueries] = useState<string[]>([]);
  const [currentPhase, setCurrentPhase] = useState<SearchPhase | null>(null);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [allSourceUrls, setAllSourceUrls] = useState<string[]>([]);
  const [lastEventTime, setLastEventTime] = useState<number>(Date.now());
  const [showMobileSteps, setShowMobileSteps] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const stepsScrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  const [sourceStates, setSourceStates] = useState<Map<string, SourceState>>(new Map());
  
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Initialize steps and start timer
  useEffect(() => {
    if (steps.length === 0 && events.length > 0) {
      setSteps([
        { id: 'understanding', label: 'Understanding request', status: 'pending' },
        { id: 'planning', label: 'Planning search', status: 'pending' },
        { id: 'searching', label: 'Searching sources', status: 'pending' },
        { id: 'analyzing', label: 'Analyzing content', status: 'pending' },
        { id: 'synthesizing', label: 'Synthesizing answer', status: 'pending' },
        { id: 'complete', label: 'Complete', status: 'pending' }
      ]);
      setStartTime(Date.now());
    }
  }, [events.length, steps.length]);

  // Update timer
  useEffect(() => {
    if (startTime) {
      const interval = setInterval(() => {
        if (!showFinalResult) {
          setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime, showFinalResult]);

  // Update steps based on events
  useEffect(() => {
    const searchEvents = events.filter(e => e.type === 'searching');
    const uniqueQueries = [...new Set(searchEvents.map(e => e.type === 'searching' ? e.query : ''))];
    setSearchQueries(uniqueQueries);
    
    const latestPhaseEvent = events.findLast(e => e.type === 'phase-update');
    if (latestPhaseEvent?.type === 'phase-update') {
      setCurrentPhase(latestPhaseEvent.phase);
      
      const phases: SearchPhase[] = ['understanding', 'planning', 'searching', 'analyzing', 'synthesizing', 'complete'];
      const currentPhaseIndex = phases.indexOf(latestPhaseEvent.phase);
      if (currentPhaseIndex > 0) {
        setCompletedPhases(prev => {
          const newCompleted = new Set(prev);
          for (let i = 0; i < currentPhaseIndex; i++) {
            newCompleted.add(phases[i]);
          }
          return newCompleted;
        });
      }
      
      setSteps(() => {
        const baseSteps = [
          { id: 'understanding', label: 'Understanding request', status: 'pending' },
          { id: 'planning', label: 'Planning search', status: 'pending' },
          { id: 'searching', label: 'Searching sources', status: 'pending' }
        ] as SearchStep[];
        
        if (['searching', 'analyzing', 'synthesizing', 'complete'].includes(latestPhaseEvent.phase) && uniqueQueries.length > 0) {
          uniqueQueries.forEach((query, idx) => {
            const queryLabel = query.length > 25 ? query.substring(0, 25) + '\u2026' : query;
            baseSteps.push({ id: `search-${idx}`, label: queryLabel, status: 'pending' });
          });
        }
        
        baseSteps.push(
          { id: 'analyzing', label: 'Analyzing content', status: 'pending' },
          { id: 'synthesizing', label: 'Synthesizing answer', status: 'pending' },
          { id: 'complete', label: 'Complete', status: 'pending' }
        );
        
        baseSteps.forEach((step) => {
          if (step.id.startsWith('search-')) {
            const searchIndex = parseInt(step.id.split('-')[1]);
            const searchQuery = uniqueQueries[searchIndex];
            const foundEvent = events.find(e => 
              e.type === 'found' && e.query.toLowerCase().trim() === searchQuery.toLowerCase().trim()
            );
            if (foundEvent) {
              step.status = 'completed';
            } else if (currentPhaseIndex >= 2) {
              step.status = 'active';
            }
          } else {
            const stepPhaseIndex = phases.indexOf(step.id as SearchPhase);
            if (stepPhaseIndex < currentPhaseIndex) {
              step.status = 'completed';
            } else if (stepPhaseIndex === currentPhaseIndex) {
              step.status = 'active';
            }
          }
        });
        
        return baseSteps;
      });
    }
  }, [events]);

  // Handle streaming and source states
  useEffect(() => {
    const contentChunks = events.filter(e => e.type === 'content-chunk');
    if (contentChunks.length > 0) {
      const content = contentChunks.map(e => e.type === 'content-chunk' ? e.chunk : '').join('');
      setStreamedContent(content);
    }
    
    if (events.find(e => e.type === 'final-result')) {
      setShowFinalResult(true);
    }
    
    if (events.length > 0) setLastEventTime(Date.now());
    
    const foundEvents = events.filter(e => e.type === 'found');
    const totalSourcesFound = foundEvents.reduce((acc, event) => 
      acc + (event.type === 'found' ? event.sources.length : 0), 0);
    setScrapedCount(totalSourcesFound);
    
    const sourceUrls: string[] = [];
    foundEvents.forEach(event => {
      if (event.type === 'found') {
        event.sources.forEach(source => sourceUrls.push(source.url));
      }
    });
    setAllSourceUrls(sourceUrls);
    
    events.forEach(event => {
      if (event.type === 'source-processing') {
        setSourceStates(prev => {
          const newMap = new Map(prev);
          newMap.set(event.url, {
            url: event.url,
            title: event.title,
            stage: event.stage,
            summary: prev.get(event.url)?.summary
          });
          return newMap;
        });
      } else if (event.type === 'source-complete') {
        setSourceStates(prev => {
          const newMap = new Map(prev);
          const existing = prev.get(event.url);
          newMap.set(event.url, {
            url: event.url,
            title: existing?.title || '',
            stage: 'complete',
            summary: event.summary
          });
          return newMap;
        });
      }
    });
  }, [events]);

  // Stalled check
  const [, setIsStalled] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSinceLastEvent = Date.now() - lastEventTime;
      setIsStalled(timeSinceLastEvent > 3000 && !showFinalResult && currentPhase === 'searching');
    }, 1000);
    return () => clearInterval(interval);
  }, [lastEventTime, showFinalResult, currentPhase]);

  // Auto-scroll
  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    if (stepsScrollRef.current) {
      stepsScrollRef.current.scrollTop = stepsScrollRef.current.scrollHeight;
    }
  }, [steps]);

  const latestResult = events.findLast(e => e.type === 'final-result');
  
  // Helper to build display groups
  const buildDisplayGroups = () => {
    const displayGroups: { event: SearchEvent; sourceProcessing?: unknown[] }[] = [];
    let currentFoundEvent: SearchEvent | null = null;
    let currentSources: unknown[] = [];
    
    events.forEach((event) => {
      if (event.type === 'content-chunk' || event.type === 'final-result') return;
      
      if (event.type === 'found') {
        if (currentFoundEvent && currentSources.length > 0) {
          displayGroups.push({ event: currentFoundEvent, sourceProcessing: [...currentSources] });
          currentSources = [];
        }
        currentFoundEvent = event;
      } else if ((event.type === 'source-processing' || event.type === 'source-complete') && currentFoundEvent) {
        // Skip accumulation
      } else {
        if (currentFoundEvent) {
          displayGroups.push({ event: currentFoundEvent, sourceProcessing: [...currentSources] });
          currentFoundEvent = null;
          currentSources = [];
        }
        displayGroups.push({ event });
      }
    });
    
    if (currentFoundEvent) {
      displayGroups.push({ event: currentFoundEvent, sourceProcessing: currentSources });
    }
    
    return displayGroups;
  };

  const renderEventsList = (displayGroups: ReturnType<typeof buildDisplayGroups>) => {
    const latestFoundIndex = displayGroups.findLastIndex(g => g.event.type === 'found');
    
    return displayGroups.map((group, i) => {
      if (group.event.type === 'found') {
        const foundUrls = new Set(group.event.sources.map(s => s.url));
        const sourcesForThisQuery = Array.from(sourceStates.entries())
          .filter(([url]) => foundUrls.has(url))
          .map(([, source]) => source);
        
        return (
          <FoundSourcesGroup
            key={i}
            event={group.event}
            sources={sourcesForThisQuery}
            defaultExpanded={i === latestFoundIndex}
            completedPhases={completedPhases}
            currentPhase={currentPhase}
            events={events}
          />
        );
      }
      
      return (
        <div key={i} className="animate-fade-in">
          {renderEvent(group.event, completedPhases, currentPhase, false, events)}
        </div>
      );
    });
  };

  // Complete state
  if (showFinalResult && latestResult?.type === 'final-result') {
    if (isMobile) {
      return (
        <div className="card-surface overflow-hidden shadow-sm">
          <div className="p-3">
            <ProgressHeader 
              title="Complete" 
              time={formatTime(elapsedSeconds)} 
              sourcesCount={scrapedCount}
              sourceUrls={allSourceUrls}
              isComplete={true}
              steps={steps}
              currentPhase={currentPhase}
            />
          </div>
          
          <button
            onClick={() => setShowMobileSteps(!showMobileSteps)}
            className="w-full flex-between px-4 py-2.5 border-t border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs font-medium text-muted-foreground">View search details</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showMobileSteps ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`overflow-hidden transition-all duration-300 ${showMobileSteps ? 'max-h-[60vh]' : 'max-h-0'}`}>
            <div className="p-4 overflow-y-auto max-h-[60vh] scrollbar-hide border-t border-border/40">
              <div className="space-y-2.5">
                {events.filter(e => e.type !== 'content-chunk' && e.type !== 'final-result').map((event, i) => (
                  <div key={i} className="text-sm">
                    {renderEvent(event, completedPhases, currentPhase, false, events)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-row h-[500px] card-surface overflow-hidden shadow-sm">
        <div className="w-64 border-r border-border/80 bg-gradient-to-b from-muted/40 via-muted/20 to-transparent flex-shrink-0 flex flex-col">
          <div className="p-4 pb-3">
            <ProgressHeader 
              title="Complete" 
              time={formatTime(elapsedSeconds)} 
              sourcesCount={scrapedCount}
              sourceUrls={allSourceUrls}
              isComplete={true}
              steps={steps}
              currentPhase={currentPhase}
            />
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4">
            <div className="relative rounded-xl p-4 bg-card/80 border border-border/30">
              <div className="relative pl-7">
                {steps.map((step, index) => {
                  const isLastStep = index === steps.length - 1;
                  return (
                    <div key={step.id} className={`relative ${isLastStep ? '' : 'pb-4'}`}>
                      <div className="absolute left-[-25px] top-[1px] w-[14px] h-[14px] flex-center">
                        <StepIndicator status="completed" />
                      </div>
                      <div className="min-h-[14px] flex flex-col justify-center">
                        <p className="text-[13px] font-medium text-foreground/80 leading-snug">{step.label}</p>
                      </div>
                      {!isLastStep && (
                        <div className="absolute left-[-19px] top-[15px] bottom-0 w-[1.5px] rounded-full bg-primary" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-auto scrollbar-hide">
          <div className="max-w-4xl">
            <div className="space-y-3">
              {events.filter(e => e.type !== 'content-chunk' && e.type !== 'final-result').map((event, i) => (
                <div key={i} className="text-sm">
                  {renderEvent(event, completedPhases, currentPhase, false, events)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Progress state
  if (isMobile) {
    const displayGroups = buildDisplayGroups();
    
    return (
      <div className="card-surface overflow-hidden shadow-sm">
        <div className="p-3">
          <ProgressHeader 
            title="Searching" 
            time={formatTime(elapsedSeconds)} 
            sourcesCount={scrapedCount}
            sourceUrls={allSourceUrls}
            isComplete={false}
            steps={steps}
            currentPhase={currentPhase}
          />
        </div>
        
        {steps.find(s => s.status === 'active') && (
          <div className="px-4 py-2 border-t border-border/40 bg-muted/20">
            <TextShimmer duration={2} spread={15} className="text-xs font-medium">
              {steps.find(s => s.status === 'active')?.label}
            </TextShimmer>
          </div>
        )}
        
        <button
          onClick={() => setShowMobileSteps(!showMobileSteps)}
          className="w-full flex-between px-4 py-2.5 border-t border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="text-xs font-medium text-muted-foreground">
            {showMobileSteps ? 'Hide details' : 'Show search details'}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showMobileSteps ? 'rotate-180' : ''}`} />
        </button>
        
        <div className={`overflow-hidden transition-all duration-300 ${showMobileSteps ? 'max-h-[50vh]' : 'max-h-0'}`}>
          <div className="p-4 overflow-y-auto max-h-[50vh] scrollbar-hide border-t border-border/40" ref={messagesScrollRef}>
            <div className="space-y-2.5">
              {renderEventsList(displayGroups)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop progress
  const displayGroups = buildDisplayGroups();
  
  return (
    <div className="flex flex-row h-[500px] card-surface overflow-hidden shadow-sm">
      <div className="w-64 border-r border-border/80 bg-gradient-to-b from-muted/40 via-muted/20 to-transparent flex-shrink-0 flex flex-col">
        <div className="p-4 pb-3">
          <ProgressHeader 
            title="Progress" 
            time={formatTime(elapsedSeconds)} 
            sourcesCount={scrapedCount}
            sourceUrls={allSourceUrls}
            isComplete={false}
            steps={steps}
            currentPhase={currentPhase}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4" ref={stepsScrollRef}>
          <div className="relative rounded-xl p-4 bg-card/80 border border-border/30">
            <div className="relative pl-7">
              {steps.map((step, index) => {
                const completedCount = steps.filter(s => s.status === 'completed').length;
                const isLineCompleted = index < completedCount;
                const isLastStep = index === steps.length - 1;
                
                return (
                  <div
                    key={step.id}
                    className="relative animate-fade-in opacity-0"
                    style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'forwards' }}
                  >
                    <div className={`relative ${isLastStep ? '' : 'pb-4'}`}>
                      <div className="absolute left-[-25px] top-[1px] w-[14px] h-[14px] flex-center">
                        <StepIndicator status={step.status} />
                      </div>
                      
                      <div className="min-h-[14px] flex flex-col justify-center">
                        {step.status === 'active' ? (
                          <TextShimmer duration={2} spread={15} className="text-[13px] leading-snug font-medium">
                            {step.label}
                          </TextShimmer>
                        ) : (
                          <p className={`text-[13px] leading-snug transition-colors duration-200 ${
                            step.status === 'completed' ? 'font-medium text-foreground/80' : 'text-muted-foreground/35'
                          }`}>
                            {step.label}
                          </p>
                        )}
                      </div>
                      
                      {!isLastStep && (
                        <div className={`absolute left-[-19px] top-[15px] bottom-0 w-[1.5px] rounded-full transition-colors duration-500 ${
                          isLineCompleted ? 'bg-primary' : step.status === 'active' ? 'bg-gradient-to-b from-primary to-transparent' : 'bg-muted-foreground/15'
                        }`} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto scrollbar-hide" ref={messagesScrollRef}>
        <div className="max-w-4xl">
          <div className="space-y-3">
            {renderEventsList(displayGroups)}
          </div>
        </div>
      </div>
    </div>
  );
}

