'use client';

import { FileText, Search, Zap, FlaskConical, Flame } from 'lucide-react';
import { SearchEvent, SearchPhase } from '@/lib/langgraph-search-engine';
import { getHostname } from '@/lib/url-utils';
import { MarkdownRenderer } from '../markdown-renderer';
import { AnimatedThinkingLine } from './animated-thinking-line';
import { StatusIcon, PrimaryStatusIcon } from '@/components/ui/status-icon';
import { InlineFavicon } from '@/components/ui/favicon-stack';

export function renderEvent(
  event: SearchEvent, 
  _completedPhases: Set<string>, 
  currentPhase: SearchPhase | null = null, 
  _showLoadingIndicator = false, 
  events: SearchEvent[] = []
) {
  switch (event.type) {
    case 'thinking': {
      const messages = event.message.split('|');
      const isAnimated = messages.length > 1;
      
      if (isAnimated) {
        return <AnimatedThinkingLine messages={messages} />;
      }
      
      const isInitialThinking = event.message.includes('###') || event.message.includes('**');
      
      if (isInitialThinking) {
        return (
          <div className="text-muted-foreground text-sm">
            <MarkdownRenderer content={event.message} />
          </div>
        );
      }
      
      const isProcessing = event.message.includes('Processing') && event.message.includes('sources');
      const isAnalyzing = event.message.includes('Analyzing content from');
      
      if (isProcessing || isAnalyzing) {
        const singleSourceMatch = event.message.match(/\|SOURCE:(.+)$/);
        const singleSourceUrl = singleSourceMatch?.[1];
        const displayMessage = singleSourceUrl ? event.message.replace(/\|SOURCE:.+$/, '') : event.message;
        
        return (
          <div className="flex items-start gap-3 text-foreground">
            {singleSourceUrl ? (
              <InlineFavicon url={singleSourceUrl} size="md" className="mt-0.5" />
            ) : (
              <StatusIcon status="loading" className="mt-0.5" />
            )}
            <span className="text-sm">{displayMessage}</span>
          </div>
        );
      }
      
      return (
        <div className="flex items-start gap-3 text-foreground">
          <div className="icon-wrapper mt-0.5">
            <FileText className="icon-xs" />
          </div>
          <span className="text-sm">{event.message}</span>
        </div>
      );
    }
    
    case 'provider-selected': {
      const providerIcons: Record<string, React.ReactNode> = {
        tavily: <Zap className="icon-xs" />,
        exa: <FlaskConical className="icon-xs" />,
        firecrawl: <Flame className="icon-xs" />,
      };
      
      return (
        <div className="flex items-start gap-3 text-foreground">
          <div className="icon-wrapper mt-0.5">
            {providerIcons[event.provider] || <Search className="icon-xs" />}
          </div>
          <span className="text-sm">
            Using <span className="font-medium capitalize">{event.provider}</span>
            <span className="text-caption ml-2">({event.reason})</span>
          </span>
        </div>
      );
    }
    
    case 'searching': {
      const searchingQuery = event.query.toLowerCase().trim();
      const searchCompleted = events.some(e => {
        if (e.type !== 'found') return false;
        const foundQuery = e.query.toLowerCase().trim();
        return foundQuery === searchingQuery;
      });
      
      return (
        <div className="flex items-start gap-3 text-foreground">
          <PrimaryStatusIcon complete={searchCompleted} className="mt-0.5" />
          <span className="text-sm">
            Search {event.index} of {event.total}: <span className="font-medium text-foreground">&quot;{event.query}&quot;</span>
            {event.provider && (
              <span className="text-caption ml-2">via {event.provider}</span>
            )}
            {!searchCompleted && !event.provider && <span className="text-caption ml-2">Finding sources...</span>}
          </span>
        </div>
      );
    }
    
    case 'found':
      return (
        <div className="text-sm text-foreground">
          <div className="flex items-center gap-2">
            <StatusIcon status="success" />
            <span>Found <span className="font-bold text-foreground">{event.sources.length} sources</span> for &quot;{event.query}&quot;</span>
          </div>
        </div>
      );
    
    case 'scraping':
      return (
        <div className="flex items-start gap-3">
          <InlineFavicon url={event.url} size="md" className="mt-0.5" />
          <div className="flex-1">
            <div className="text-sm text-foreground">
              Browsing <span className="font-medium text-primary">{getHostname(event.url)}</span> for &quot;{event.query}&quot;
            </div>
          </div>
        </div>
      );
    
    case 'phase-update': {
      const phases: SearchPhase[] = ['understanding', 'planning', 'searching', 'analyzing', 'synthesizing', 'complete'];
      const eventPhaseIndex = phases.indexOf(event.phase);
      const currentPhaseIndex = currentPhase ? phases.indexOf(currentPhase) : -1;
      const isCompleted = currentPhaseIndex > eventPhaseIndex || event.phase === 'complete';
      
      return (
        <div className="flex items-start gap-3 text-foreground font-medium">
          <StatusIcon status={isCompleted ? 'success' : 'loading'} className="mt-0.5" />
          <span className="text-sm">{event.message}</span>
        </div>
      );
    }
    
    case 'error':
      return (
        <div className="flex items-start gap-3 text-destructive">
          <StatusIcon status="error" className="mt-0.5" />
          <div className="text-sm">
            <span className="font-medium">Error: </span>
            <span>{event.error}</span>
            {event.errorType && <span className="text-caption ml-2">({event.errorType})</span>}
          </div>
        </div>
      );
    
    case 'source-processing':
    case 'source-complete':
      return null;
    
    default:
      return null;
  }
}
