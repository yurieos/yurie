'use client';

import { SearchEvent, SearchStep, SearchPhase } from '@/lib/langgraph-search-engine';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { MarkdownRenderer } from './markdown-renderer';
import { getFaviconUrl, getDefaultFavicon, markFaviconFailed } from '@/lib/favicon-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2, Check, ChevronRight, ChevronDown, Clock, AlertCircle, FileText, Search, Zap, FlaskConical, Flame } from 'lucide-react';

// Component for animated thinking line that cycles through messages
function AnimatedThinkingLine({ messages }: { messages: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (messages.length <= 1) return;
    
    // Detect if this is a "speed run" (many source names)
    const isSpeedRun = messages.some(msg => msg.includes('Analyzing') && messages.length > 5);
    const cycleDelay = isSpeedRun ? 600 : 2000; // Faster for speed runs
    const fadeDelay = isSpeedRun ? 100 : 300;
    
    const cycleMessages = () => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          // Stop at the last message if it's a speed run
          if (isSpeedRun && next >= messages.length - 1) {
            setIsComplete(true);
            return messages.length - 1; // Stay on last message
          }
          return next % messages.length;
        });
        setIsVisible(true);
      }, fadeDelay);
    };
    
    if (!isComplete) {
      const interval = setInterval(cycleMessages, cycleDelay);
      return () => clearInterval(interval);
    }
  }, [messages, isComplete]);
  
  // Extract URL from message if it's an "Analyzing" message
  const currentMessage = messages[currentIndex];
  const analyzingMatch = currentMessage.match(/Analyzing (.+)\.\.\./);
  const currentUrl = analyzingMatch ? analyzingMatch[1] : null;
  
  return (
    <div className="flex items-start gap-3 text-foreground">
      <div className="w-5 h-5 mt-0.5 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        {currentUrl ? (
          <Image 
            src={getFaviconUrl(currentUrl)} 
            alt=""
            width={20}
            height={20}
            className={`w-5 h-5 rounded transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = getDefaultFavicon();
              markFaviconFailed(currentUrl);
            }}
          />
        ) : (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
        )}
      </div>
      <span className={`text-sm transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDuration: isVisible ? '150ms' : '150ms' }}>
        {currentMessage}
      </span>
    </div>
  );
}

// Component for found sources group with collapse/expand
function FoundSourcesGroup({ 
  event, 
  sources, 
  defaultExpanded, 
  completedPhases, 
  currentPhase, 
  events 
}: {
  event: SearchEvent;
  sources: {
    url: string;
    title: string;
    stage: 'browsing' | 'extracting' | 'analyzing' | 'complete';
    summary?: string;
  }[];
  defaultExpanded: boolean;
  completedPhases: Set<string>;
  currentPhase: SearchPhase | null;
  events: SearchEvent[];
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Auto-collapse when a new search starts
  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);
  
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          {renderEvent(event, completedPhases, currentPhase, false, events)}
        </div>
        {sources.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-accent rounded-full transition-colors flex-shrink-0 cursor-pointer"
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

// Component for animated source processing line
function SourceProcessingLine({ url, stage, summary }: { 
  url: string; 
  stage: 'browsing' | 'extracting' | 'analyzing' | 'complete';
  summary?: string;
}) {
  const stageLabels = {
    browsing: 'Browsing',
    extracting: 'Extracting',
    analyzing: 'Analyzing',
    complete: 'Complete'
  };
  
  return (
    <div className="group flex items-start gap-2 text-xs py-1 animate-fade-in">
      <Image 
        src={getFaviconUrl(url)} 
        alt=""
        width={16}
        height={16}
        className="w-4 h-4 rounded flex-shrink-0 mt-0.5"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          img.src = getDefaultFavicon();
          markFaviconFailed(url);
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-muted-foreground truncate">
          {new URL(url).hostname}
        </div>
        {stage === 'complete' ? (
          summary ? (
            <div className="text-muted-foreground/70 mt-0.5">
              {summary}
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-0.5">
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span className="text-muted-foreground/70">
                Complete
              </span>
            </div>
          )
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-muted-foreground/70">
              {stageLabels[stage as keyof typeof stageLabels]}...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Step indicator component with refined design
function StepIndicator({ status }: { status: 'pending' | 'active' | 'completed' }) {
  if (status === 'completed') {
    return (
      <div className="relative flex items-center justify-center">
        {/* Subtle glow effect */}
        <div className="absolute inset-0 w-[18px] h-[18px] rounded-full bg-primary/20 blur-[3px]" />
        {/* Main circle */}
        <div className="relative w-[18px] h-[18px] rounded-full bg-primary flex items-center justify-center shadow-sm">
          <Check className="w-[10px] h-[10px] text-primary-foreground" strokeWidth={2.5} />
        </div>
      </div>
    );
  }
  
  if (status === 'active') {
    return (
      <div className="relative flex items-center justify-center w-[18px] h-[18px]">
        {/* Outer pulse ring */}
        <div className="absolute inset-[-3px] rounded-full bg-primary/20 animate-ping" style={{ animationDuration: '2s' }} />
        {/* Inner pulsing dot */}
        <div className="relative w-[18px] h-[18px] rounded-full bg-primary/80 animate-pulse flex items-center justify-center" style={{ animationDuration: '1.5s' }}>
          <div className="w-2 h-2 rounded-full bg-primary-foreground/80" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-muted-foreground/25 bg-muted/30" />
  );
}

// Mobile-optimized horizontal step progress
function MobileStepProgress({ 
  steps, 
  currentPhase 
}: { 
  steps: SearchStep[];
  currentPhase: SearchPhase | null;
}) {
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

// Progress header component - with mobile-optimized compact version
function ProgressHeader({ 
  title, 
  time, 
  sourcesCount, 
  sourceUrls,
  isComplete,
  steps,
  currentPhase
}: { 
  title: string; 
  time: string; 
  sourcesCount: number;
  sourceUrls: string[];
  isComplete: boolean;
  steps?: SearchStep[];
  currentPhase?: SearchPhase | null;
}) {
  const isMobile = useIsMobile();
  
  // Get unique domains for favicon display
  const uniqueDomains = new Map<string, string>();
  sourceUrls.forEach(url => {
    try {
      const domain = new URL(url).hostname;
      if (!uniqueDomains.has(domain)) {
        uniqueDomains.set(domain, url);
      }
    } catch {}
  });
  const uniqueSourceUrls = Array.from(uniqueDomains.values()).slice(0, isMobile ? 4 : 5);

  // Compact mobile layout
  if (isMobile) {
    return (
      <div className={`rounded-2xl p-3 transition-all duration-500 ${
        isComplete 
          ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/25' 
          : 'bg-card/80 border border-border/80 backdrop-blur-sm'
      }`}>
        {/* Single row with all info */}
        <div className="flex items-center justify-between gap-3">
          {/* Status indicator + label */}
          <div className="flex items-center gap-2 min-w-0">
            {isComplete ? (
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 w-4 h-4 rounded-full bg-primary/20 blur-[2px]" />
                <div className="relative w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                </div>
              </div>
            ) : (
              <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
            )}
            <span className={`text-[10px] font-semibold tracking-wider uppercase truncate ${
              isComplete ? 'text-primary' : 'text-foreground'
            }`}>
              {title}
            </span>
          </div>
          
          {/* Time + Sources inline */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Source favicons */}
            {uniqueSourceUrls.length > 0 && (
              <div className="flex -space-x-1">
                {uniqueSourceUrls.slice(0, 3).map((url, i) => (
                  <Image 
                    key={url}
                    src={getFaviconUrl(url)} 
                    alt=""
                    width={14}
                    height={14}
                    className="w-3.5 h-3.5 rounded-full border border-card bg-card shadow-sm object-cover"
                    style={{ zIndex: 3 - i }}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = getDefaultFavicon();
                      markFaviconFailed(url);
                    }}
                  />
                ))}
                {sourcesCount > 3 && (
                  <div className="w-3.5 h-3.5 rounded-full border border-card bg-primary/15 flex items-center justify-center text-[6px] font-bold text-primary">
                    +{sourcesCount - 3}
                  </div>
                )}
              </div>
            )}
            
            {/* Source count */}
            <span className="text-xs font-bold tabular-nums text-foreground">
              {sourcesCount}
            </span>
            
            {/* Time badge */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-muted/50 border border-border/50">
              <Clock className="w-2.5 h-2.5 text-muted-foreground" />
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

  // Desktop layout (original)
  return (
    <div className={`rounded-2xl p-4 transition-all duration-500 ${
      isComplete 
        ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/25' 
        : 'bg-card/80 border border-border/80 backdrop-blur-sm'
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {isComplete ? (
            <div className="relative">
              <div className="absolute inset-0 w-5 h-5 rounded-full bg-primary/20 blur-[2px]" />
              <div className="relative w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" strokeWidth={2.5} />
              </div>
            </div>
          ) : (
            <div className="relative w-5 h-5">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
          <span className={`text-[11px] font-semibold tracking-widest uppercase ${
            isComplete ? 'text-primary' : 'text-foreground'
          }`}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/50">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-mono font-medium text-foreground tabular-nums">
            {time}
          </span>
        </div>
      </div>
      
      {/* Sources row */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <span className="text-[11px] text-muted-foreground font-medium">Sources discovered</span>
        <div className="flex items-center gap-2">
          {uniqueSourceUrls.length > 0 ? (
            <div className="flex -space-x-1.5">
              {uniqueSourceUrls.map((url, i) => (
                <div 
                  key={url}
                  className="relative animate-scale-in"
                  style={{ 
                    animationDelay: `${i * 60}ms`,
                    zIndex: 5 - i
                  }}
                >
                  <Image 
                    src={getFaviconUrl(url)} 
                    alt=""
                    width={18}
                    height={18}
                    className="w-[18px] h-[18px] rounded-full border-2 border-card bg-card shadow-sm object-cover"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = getDefaultFavicon();
                      markFaviconFailed(url);
                    }}
                  />
                </div>
              ))}
              {sourcesCount > uniqueSourceUrls.length && (
                <div 
                  className="w-[18px] h-[18px] rounded-full border-2 border-card bg-primary/15 flex items-center justify-center shadow-sm animate-scale-in"
                  style={{ 
                    animationDelay: `${uniqueSourceUrls.length * 60}ms`,
                    zIndex: 0
                  }}
                >
                  <span className="text-[7px] font-bold text-primary">+{sourcesCount - uniqueSourceUrls.length}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex -space-x-1.5">
              {[...Array(Math.min(3, Math.max(0, sourcesCount)))].map((_, i) => (
                <div 
                  key={i}
                  className="w-[18px] h-[18px] rounded-full bg-muted/60 border-2 border-card animate-pulse"
                  style={{ animationDelay: `${i * 100}ms` }}
                />
              ))}
            </div>
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
  
  // Track source processing states
  const [sourceStates, setSourceStates] = useState<Map<string, {
    url: string;
    title: string;
    stage: 'browsing' | 'extracting' | 'analyzing' | 'complete';
    summary?: string;
  }>>(new Map());
  
  // Format seconds into mm:ss or just ss
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
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
      // Start timer immediately
      setStartTime(Date.now());
    }
  }, [events.length, steps.length]);

  // Update timer every second
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

  // Update steps based on events - only show current and completed steps
  useEffect(() => {
    // Extract search queries from events
    const searchEvents = events.filter(e => e.type === 'searching');
    const uniqueQueries = [...new Set(searchEvents.map(e => e.type === 'searching' ? e.query : ''))];
    setSearchQueries(uniqueQueries);
    
    const latestPhaseEvent = events.findLast(e => e.type === 'phase-update');
    if (latestPhaseEvent?.type === 'phase-update') {
      setCurrentPhase(latestPhaseEvent.phase);
      
      // Mark previous phases as completed
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
        
        // Add dynamic search query steps if we're in or past the searching phase
        if (['searching', 'analyzing', 'synthesizing', 'complete'].includes(latestPhaseEvent.phase) && uniqueQueries.length > 0) {
          uniqueQueries.forEach((query, idx) => {
            const queryLabel = query.length > 25 ? query.substring(0, 25) + '\u2026' : query;
            baseSteps.push({
              id: `search-${idx}`,
              label: queryLabel,
              status: 'pending'
            });
          });
        }
        
        // Add remaining steps
        baseSteps.push(
          { id: 'analyzing', label: 'Analyzing content', status: 'pending' },
          { id: 'synthesizing', label: 'Synthesizing answer', status: 'pending' },
          { id: 'complete', label: 'Complete', status: 'pending' }
        );
        
        // Update status based on current phase
        const phases: SearchPhase[] = ['understanding', 'planning', 'searching', 'analyzing', 'synthesizing', 'complete'];
        const currentPhaseIndex = phases.indexOf(latestPhaseEvent.phase);
        
        baseSteps.forEach((step) => {
          if (step.id.startsWith('search-')) {
            // Check if this specific search is complete by looking for a 'found' event
            const searchIndex = parseInt(step.id.split('-')[1]);
            const searchQuery = uniqueQueries[searchIndex];
            const foundEvent = events.find(e => 
              e.type === 'found' && e.query.toLowerCase().trim() === searchQuery.toLowerCase().trim()
            );
            
            if (foundEvent) {
              step.status = 'completed';
            } else if (currentPhaseIndex >= 2) { // We're in or past searching phase
              step.status = 'active';
            } else {
              step.status = 'pending';
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

  // Handle streaming content and extract research info
  useEffect(() => {
    const contentChunks = events.filter(e => e.type === 'content-chunk');
    if (contentChunks.length > 0) {
      const content = contentChunks.map(e => e.type === 'content-chunk' ? e.chunk : '').join('');
      setStreamedContent(content);
    }
    
    const finalResult = events.find(e => e.type === 'final-result');
    if (finalResult) {
      setShowFinalResult(true);
    }
    
    // Update last event time
    if (events.length > 0) {
      setLastEventTime(Date.now());
    }
    
    // Count total sources found and collect URLs
    const foundEvents = events.filter(e => e.type === 'found');
    const totalSourcesFound = foundEvents.reduce((acc, event) => {
      return acc + (event.type === 'found' ? event.sources.length : 0);
    }, 0);
    setScrapedCount(totalSourcesFound);
    
    // Collect all source URLs for favicon display
    const sourceUrls: string[] = [];
    foundEvents.forEach(event => {
      if (event.type === 'found') {
        event.sources.forEach(source => {
          sourceUrls.push(source.url);
        });
      }
    });
    setAllSourceUrls(sourceUrls);
    
    // Update source processing states
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

  // Check if we're stalled (no events for more than 3 seconds)
  const [, setIsStalled] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      const timeSinceLastEvent = Date.now() - lastEventTime;
      setIsStalled(timeSinceLastEvent > 3000 && !showFinalResult && currentPhase === 'searching');
    }, 1000);
    
    return () => clearInterval(interval);
  }, [lastEventTime, showFinalResult, currentPhase]);

  // Auto-scroll messages when new events arrive
  useEffect(() => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTop = messagesScrollRef.current.scrollHeight;
    }
  }, [events]);

  // Auto-scroll steps when they update
  useEffect(() => {
    if (stepsScrollRef.current) {
      stepsScrollRef.current.scrollTop = stepsScrollRef.current.scrollHeight;
    }
  }, [steps]);

  const latestResult = events.findLast(e => e.type === 'final-result');
  
  // Show final result if complete - only show the research box, not the content
  if (showFinalResult && latestResult?.type === 'final-result') {
    // Mobile: Compact collapsible layout
    if (isMobile) {
      return (
        <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Compact header */}
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
          
          {/* Collapsible steps section */}
          <button
            onClick={() => setShowMobileSteps(!showMobileSteps)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-t border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-xs font-medium text-muted-foreground">View search details</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showMobileSteps ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Collapsible content */}
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
    
    // Desktop: Original side-by-side layout
    return (
      <div className="flex flex-row h-[500px] border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="w-64 border-r border-border/80 bg-gradient-to-b from-muted/40 via-muted/20 to-transparent flex-shrink-0 flex flex-col">
          {/* Fixed progress header */}
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
          
          {/* Scrollable steps area */}
          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4">
            <div className="relative rounded-2xl p-4 bg-card/90 backdrop-blur-sm border border-border/60 shadow-sm">
              <div className="relative pl-9">
                {steps.map((step, index) => {
                  const isLastStep = index === steps.length - 1;
                  return (
                    <div 
                      key={step.id} 
                      className={`relative ${isLastStep ? '' : 'pb-6'}`}
                    >
                      {/* Step indicator */}
                      <div className="absolute left-[-31px] top-0 w-[18px] h-[18px] flex items-center justify-center">
                        <StepIndicator status="completed" />
                      </div>
                      
                      {/* Step label */}
                      <div className="min-h-[18px] flex flex-col justify-center">
                        <p className="text-[13px] font-medium text-foreground/90 leading-tight">
                          {step.label}
                        </p>
                      </div>
                      
                      {/* Connecting line */}
                      {!isLastStep && (
                        <div className="absolute left-[-23px] top-[18px] bottom-0 w-[2px] rounded-full bg-primary" />
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

  // Show search progress
  // Mobile: Streamlined single-column layout
  if (isMobile) {
    return (
      <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Compact header with horizontal progress */}
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
        
        {/* Current step label */}
        {steps.find(s => s.status === 'active') && (
          <div className="px-4 py-2 border-t border-border/40 bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.8s' }} />
                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.8s' }} />
                <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.8s' }} />
              </div>
              <span className="text-xs font-medium text-foreground">
                {steps.find(s => s.status === 'active')?.label}
              </span>
            </div>
          </div>
        )}
        
        {/* Collapsible detailed steps toggle */}
        <button
          onClick={() => setShowMobileSteps(!showMobileSteps)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-t border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <span className="text-xs font-medium text-muted-foreground">
            {showMobileSteps ? 'Hide details' : 'Show search details'}
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showMobileSteps ? 'rotate-180' : ''}`} />
        </button>
        
        {/* Collapsible events feed */}
        <div className={`overflow-hidden transition-all duration-300 ${showMobileSteps ? 'max-h-[50vh]' : 'max-h-0'}`}>
          <div className="p-4 overflow-y-auto max-h-[50vh] scrollbar-hide border-t border-border/40" ref={messagesScrollRef}>
            <div className="space-y-2.5">
              {(() => {
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
                    // Don't accumulate
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
                
                const latestFoundIndex = displayGroups.findLastIndex(g => g.event.type === 'found');
                
                return displayGroups.map((group, i) => {
                  if (group.event.type === 'found') {
                    const foundUrls = new Set(group.event.sources.map(s => s.url));
                    const sourcesForThisQuery = Array.from(sourceStates.entries())
                      .filter(([url]) => foundUrls.has(url))
                      .map(([, source]) => source);
                    const isCurrentSearch = i === latestFoundIndex;
                    
                    return (
                      <FoundSourcesGroup
                        key={i}
                        event={group.event}
                        sources={sourcesForThisQuery}
                        defaultExpanded={isCurrentSearch}
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
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Original side-by-side layout
  return (
    <div className="flex flex-row h-[500px] border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Steps sidebar - vertical progress */}
      <div className="w-64 border-r border-border/80 bg-gradient-to-b from-muted/40 via-muted/20 to-transparent flex-shrink-0 flex flex-col">
        {/* Fixed progress header */}
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
        
        {/* Scrollable steps area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4" ref={stepsScrollRef}>
          <div className="relative rounded-2xl p-4 bg-card/90 backdrop-blur-sm border border-border/60 shadow-sm">
            <div className="relative pl-9">
              {/* Steps */}
              {steps.map((step, index) => {
                const completedCount = steps.filter(s => s.status === 'completed').length;
                const isLineCompleted = index < completedCount;
                const isLastStep = index === steps.length - 1;
                
                return (
                  <div
                    key={step.id}
                    className="relative animate-fade-in opacity-0"
                    style={{
                      animationDelay: `${index * 60}ms`,
                      animationFillMode: 'forwards'
                    }}
                  >
                    {/* Step content */}
                    <div className={`relative ${isLastStep ? '' : 'pb-6'}`}>
                      {/* Step indicator */}
                      <div className="absolute left-[-31px] top-0 w-[18px] h-[18px] flex items-center justify-center">
                        <StepIndicator status={step.status} />
                      </div>
                      
                      {/* Label */}
                      <div className="min-h-[18px] flex flex-col justify-center">
                        <p className={`text-[13px] leading-tight transition-all duration-300 ${
                          step.status === 'active' 
                            ? 'font-semibold text-foreground' 
                            : step.status === 'completed'
                            ? 'font-medium text-foreground/90'
                            : 'text-muted-foreground/50 font-normal'
                        }`}>
                          {step.label}
                        </p>
                        {step.status === 'active' && (
                          <div className="flex items-center gap-1.5 mt-1 animate-fade-in">
                            <div className="flex gap-0.5">
                              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.8s' }} />
                              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.8s' }} />
                              <span className="w-1 h-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.8s' }} />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Connecting line */}
                      {!isLastStep && (
                        <div 
                          className={`absolute left-[-23px] top-[18px] bottom-0 w-[2px] rounded-full transition-all duration-500 ${
                            isLineCompleted
                              ? 'bg-primary'
                              : step.status === 'active'
                              ? 'bg-gradient-to-b from-primary/70 to-muted/30'
                              : 'bg-muted-foreground/20'
                          }`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 p-8 overflow-y-auto scrollbar-hide" ref={messagesScrollRef}>
        <div className="max-w-4xl">
          <div className="space-y-3">
            {(() => {
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
                  // Don't accumulate
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
              
              const latestFoundIndex = displayGroups.findLastIndex(g => g.event.type === 'found');
              
              return displayGroups.map((group, i) => {
                if (group.event.type === 'found') {
                  const foundUrls = new Set(group.event.sources.map(s => s.url));
                  const sourcesForThisQuery = Array.from(sourceStates.entries())
                    .filter(([url]) => foundUrls.has(url))
                    .map(([, source]) => source);
                  const isCurrentSearch = i === latestFoundIndex;
                  
                  return (
                    <FoundSourcesGroup
                      key={i}
                      event={group.event}
                      sources={sourcesForThisQuery}
                      defaultExpanded={isCurrentSearch}
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
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderEvent(event: SearchEvent, _completedPhases: Set<string>, currentPhase: SearchPhase | null = null, _showLoadingIndicator = false, events: SearchEvent[] = []) { // eslint-disable-line @typescript-eslint/no-unused-vars
  switch (event.type) {
    case 'thinking':
      // Single line animated display
      const messages = event.message.split('|');
      const isAnimated = messages.length > 1;
      
      if (isAnimated) {
        return (
          <AnimatedThinkingLine messages={messages} />
        );
      }
      
      // Check if this is the initial understanding (contains markdown headers)
      const isInitialThinking = event.message.includes('###') || event.message.includes('**');
      
      if (isInitialThinking) {
        return (
          <div className="text-muted-foreground text-sm">
            <MarkdownRenderer content={event.message} />
          </div>
        );
      }
      
      // Check if this is a processing message that should show a spinner
      const isProcessing = event.message.includes('Processing') && event.message.includes('sources');
      const isAnalyzing = event.message.includes('Analyzing content from');
      
      if (isProcessing || isAnalyzing) {
        // Check for single source URL (for individual processing)
        const singleSourceMatch = event.message.match(/\|SOURCE:(.+)$/);
        const singleSourceUrl = singleSourceMatch?.[1];
        const displayMessage = singleSourceUrl ? event.message.replace(/\|SOURCE:.+$/, '') : event.message;
        
        return (
          <div className="flex items-start gap-3 text-foreground">
            {singleSourceUrl ? (
              // Show favicon for individual source
              <Image 
                src={getFaviconUrl(singleSourceUrl)} 
                alt=""
                width={20}
                height={20}
                className="w-5 h-5 mt-0.5 rounded flex-shrink-0"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = getDefaultFavicon();
                  markFaviconFailed(singleSourceUrl);
                }}
              />
            ) : (
              // Show spinner for general processing
              <div className="w-5 h-5 mt-0.5 rounded bg-muted flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" />
              </div>
            )}
            <span className="text-sm">{displayMessage}</span>
          </div>
        );
      }
      
      return (
        <div className="flex items-start gap-3 text-foreground">
          <div className="w-5 h-5 mt-0.5 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <FileText className="w-3 h-3" />
          </div>
          <span className="text-sm">{event.message}</span>
        </div>
      );
    
    case 'provider-selected':
      // Show which search provider was selected
      const providerIcons: Record<string, React.ReactNode> = {
        tavily: <Zap className="w-3 h-3" />,
        exa: <FlaskConical className="w-3 h-3" />,
        firecrawl: <Flame className="w-3 h-3" />,
      };
      const providerColors: Record<string, string> = {
        tavily: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        exa: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
        firecrawl: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      };
      
      return (
        <div className="flex items-start gap-3 text-foreground">
          <div className={`w-5 h-5 mt-0.5 rounded flex items-center justify-center flex-shrink-0 ${providerColors[event.provider] || 'bg-muted'}`}>
            {providerIcons[event.provider] || <Search className="w-3 h-3" />}
          </div>
          <span className="text-sm">
            Using <span className="font-medium capitalize">{event.provider}</span>
            <span className="text-xs text-muted-foreground ml-2">({event.reason})</span>
          </span>
        </div>
      );
    
    case 'searching':
      // Check if this search has completed by looking for a matching 'found' event
      const searchingQuery = event.query.toLowerCase().trim();
      const searchCompleted = events.some(e => {
        if (e.type !== 'found') return false;
        const foundQuery = e.query.toLowerCase().trim();
        return foundQuery === searchingQuery;
      });
      
      // Provider badge colors
      const searchProviderColors: Record<string, string> = {
        tavily: 'text-blue-600 dark:text-blue-400',
        exa: 'text-purple-600 dark:text-purple-400',
        firecrawl: 'text-orange-600 dark:text-orange-400',
      };
      
      return (
        <div className="flex items-start gap-3 text-foreground">
          <div className="w-5 h-5 mt-0.5 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
            {searchCompleted ? (
              <Check className="w-3 h-3 text-primary" strokeWidth={2.5} />
            ) : (
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
            )}
          </div>
          <span className="text-sm">
            Search {event.index} of {event.total}: <span className="font-medium text-foreground">&quot;{event.query}&quot;</span>
            {event.provider && (
              <span className={`text-xs ml-2 ${searchProviderColors[event.provider] || 'text-muted-foreground'}`}>
                via {event.provider}
              </span>
            )}
            {!searchCompleted && !event.provider && <span className="text-xs text-muted-foreground ml-2">Finding sources...</span>}
          </span>
        </div>
      );
    
    case 'found':
      return (
        <div className="text-sm text-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
            </div>
            <span>Found <span className="font-bold text-foreground">{event.sources.length} sources</span> for &quot;{event.query}&quot;</span>
          </div>
        </div>
      );
    
    case 'scraping':
      return (
        <div className="flex items-start gap-3">
          <Image 
            src={getFaviconUrl(event.url)} 
            alt=""
            width={20}
            height={20}
            className="w-5 h-5 mt-0.5 flex-shrink-0 rounded"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = getDefaultFavicon();
              markFaviconFailed(event.url);
            }}
          />
          <div className="flex-1">
            <div className="text-sm text-foreground">
              Browsing <span className="font-medium text-primary">{new URL(event.url).hostname}</span> for &quot;{event.query}&quot;
            </div>
          </div>
        </div>
      );
    
    case 'phase-update':
      // Check if this phase has been completed (we've moved past it)
      const phases: SearchPhase[] = ['understanding', 'planning', 'searching', 'analyzing', 'synthesizing', 'complete'];
      const eventPhaseIndex = phases.indexOf(event.phase);
      const currentPhaseIndex = currentPhase ? phases.indexOf(currentPhase) : -1;
      const isCompleted = currentPhaseIndex > eventPhaseIndex || event.phase === 'complete';
      
      return (
        <div className="flex items-start gap-3 text-foreground font-medium">
          <div className="w-5 h-5 mt-0.5 rounded bg-muted flex items-center justify-center">
            {isCompleted ? (
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
            ) : (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
          </div>
          <span className="text-sm">{event.message}</span>
        </div>
      );
    
      case 'error':
      return (
        <div className="flex items-start gap-3 text-destructive">
          <div className="w-5 h-5 mt-0.5 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-3 h-3" />
          </div>
          <div className="text-sm">
            <span className="font-medium">Error: </span>
            <span>{event.error}</span>
            {event.errorType && <span className="text-xs ml-2">({event.errorType})</span>}
          </div>
        </div>
      );
    
    case 'source-processing':
    case 'source-complete':
      // This will be handled by the SourceProcessingLine component
      return null;
    
    default:
      return null;
  }
}
