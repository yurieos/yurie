'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Source } from '@/lib/langgraph-search-engine';
import { getFaviconUrl, getDefaultFavicon, markFaviconFailed } from '@/lib/favicon-utils';
import { getHostname, getReadingTime, getWordCount } from '@/lib/url-utils';
import { IconBadge } from '@/components/ui/icon-badge';
import { SourceDetailView } from './source-detail-view';
import { 
  ChevronRight, 
  X, 
  Search as SearchIcon,
  FileText, 
  Clock, 
  BookOpen, 
  Sparkles 
} from 'lucide-react';

interface SourcesListProps {
  sources: Source[];
}

export function SourcesList({ sources }: SourcesListProps) {
  const [showSourcesPanel, setShowSourcesPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSourceIndex, setSelectedSourceIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Filter sources based on search query
  const filteredSources = sources.filter(source => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      source.title.toLowerCase().includes(query) ||
      source.url.toLowerCase().includes(query) ||
      (source.content?.toLowerCase().includes(query) ?? false)
    );
  });
  
  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedSourceIndex !== null) {
        setSelectedSourceIndex(null);
      } else {
        setShowSourcesPanel(false);
      }
    }
  }, [selectedSourceIndex]);
  
  useEffect(() => {
    if (showSourcesPanel) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return; // Explicit return for TypeScript noImplicitReturns
  }, [showSourcesPanel, handleKeyDown]);
  
  // Calculate total stats
  const totalWords = sources.reduce((acc, s) => {
    return acc + (s.content ? s.content.trim().split(/\s+/).length : 0);
  }, 0);
  const sourcesWithContent = sources.filter(s => s.content).length;
  
  return (
    <>
      {/* Sources button with favicon preview */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex -space-x-2">
          {(() => {
            // Get unique domains
            const uniqueDomains = new Map<string, Source>();
            sources.forEach(source => {
              try {
                const domain = new URL(source.url).hostname;
                if (!uniqueDomains.has(domain)) {
                  uniqueDomains.set(domain, source);
                }
              } catch {}
            });
            const uniqueSources = Array.from(uniqueDomains.values());
            
            return (
              <>
                {uniqueSources.slice(0, 5).map((source, i) => (
                  <Image 
                    key={i}
                    src={getFaviconUrl(source.url)} 
                    alt=""
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full border-2 border-background bg-card shadow-sm"
                    style={{ zIndex: 5 - i }}
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      img.src = getDefaultFavicon(source.url);
                      markFaviconFailed(source.url);
                    }}
                  />
                ))}
                {uniqueSources.length > 5 && (
                  <div className="w-6 h-6 rounded-full border-2 border-background bg-primary/10 flex items-center justify-center shadow-sm">
                    <span className="text-[10px] font-bold text-primary">+{uniqueSources.length - 5}</span>
                  </div>
                )}
              </>
            );
          })()}
        </div>
        <button
          onClick={() => setShowSourcesPanel(true)}
          className="group flex items-center gap-2 text-sm link-muted"
        >
          <span>View {sources.length} sources & page contents</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Click-away overlay */}
      {showSourcesPanel && (
        <div 
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            if (selectedSourceIndex !== null) {
              setSelectedSourceIndex(null);
            } else {
              setShowSourcesPanel(false);
            }
          }}
        />
      )}
      
      {/* Sources Panel */}
      <div 
        ref={panelRef}
        className={`fixed inset-y-0 right-0 w-full sm:w-[480px] bg-card border-l border-border transform transition-transform duration-300 ease-out ${
          showSourcesPanel ? 'translate-x-0' : 'translate-x-full'
        } z-40 flex flex-col shadow-2xl`}
      >
        {selectedSourceIndex !== null ? (
          <SourceDetailView 
            source={sources[selectedSourceIndex]} 
            index={selectedSourceIndex}
            onBack={() => setSelectedSourceIndex(null)}
          />
        ) : (
          <>
            {/* Header */}
            <div className="flex-shrink-0 border-b border-border">
              <div className="p-5 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <IconBadge>
                      <BookOpen className="w-5 h-5 text-primary" />
                    </IconBadge>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Sources</h3>
                      <p className="text-xs text-muted-foreground">{sources.length} pages researched</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSourcesPanel(false)}
                    className="btn-icon-ghost p-2"
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sources..."
                    className="w-full h-10 pl-10 pr-4 text-sm bg-muted/50 border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-accent rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Stats bar */}
              <div className="flex items-center gap-4 px-5 py-2.5 bg-muted/30 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <FileText className="w-3.5 h-3.5" />
                  <span>{sourcesWithContent} with content</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{totalWords.toLocaleString()} words total</span>
                </div>
              </div>
            </div>
            
            {/* Source list */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
              {filteredSources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <SearchIcon className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-medium">No sources found</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Try a different search term
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSources.map((source, i) => {
                    const originalIndex = sources.indexOf(source);
                    const hasContent = !!source.content;
                    
                    return (
                      <div 
                        key={originalIndex}
                        onClick={() => setSelectedSourceIndex(originalIndex)}
                        className="group relative p-3.5 card-surface-interactive source-card-gradient"
                        style={{
                          animationDelay: `${i * 50}ms`,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-9 h-9 rounded-lg bg-muted/70 flex items-center justify-center overflow-hidden">
                              <Image 
                                src={getFaviconUrl(source.url)} 
                                alt=""
                                width={20}
                                height={20}
                                className="w-5 h-5"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  img.src = getDefaultFavicon(source.url);
                                  markFaviconFailed(source.url);
                                }}
                              />
                            </div>
                            <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shadow-sm">
                              {originalIndex + 1}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                              {source.title}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {getHostname(source.url)}
                            </p>
                            
                            {hasContent && (
                              <div className="flex items-center gap-3 mt-2">
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                                  <Clock className="w-3 h-3" />
                                  {getReadingTime(source.content!)}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                                  <FileText className="w-3 h-3" />
                                  {getWordCount(source.content!)}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
                        </div>
                        
                        {/* Content preview */}
                        {hasContent && (
                          <p className="text-xs text-muted-foreground/80 mt-2.5 line-clamp-2 leading-relaxed pl-12">
                            {source.content!.slice(0, 150).trim()}...
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
          </>
        )}
      </div>
    </>
  );
}

