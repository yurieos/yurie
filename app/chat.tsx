'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { search } from './search';
import { readStreamableValue } from 'ai/rsc';
import { SearchDisplay } from './search-display';
import { SearchEvent, Source } from '@/lib/langgraph-search-engine';
import { MarkdownRenderer } from './markdown-renderer';
import { CitationTooltip } from './citation-tooltip';
import Image from 'next/image';
import { getFaviconUrl, getDefaultFavicon, markFaviconFailed } from '@/lib/favicon-utils';
import { getHostname, getReadingTime, getWordCount } from '@/lib/url-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Suggestions } from "@/components/suggestions";
import { 
  Loader2, 
  CornerRightUp,
  ChevronRight, 
  X, 
  Search as SearchIcon,
  ExternalLink,
  FileText,
  Clock,
  Copy,
  Check,
  BookOpen,
  Sparkles,
  ChevronLeft
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Individual source detail view
function SourceDetailView({ 
  source, 
  index, 
  onBack 
}: { 
  source: Source; 
  index: number; 
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    if (source.content) {
      await navigator.clipboard.writeText(source.content);
      setCopied(true);
      toast.success('Content copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-gradient-to-b from-card to-card/95">
        <div className="p-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 group cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to sources</span>
          </button>
          
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <IconBadge>
                <Image 
                  src={getFaviconUrl(source.url)} 
                  alt=""
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = getDefaultFavicon(source.url);
                    markFaviconFailed(source.url);
                  }}
                />
              </IconBadge>
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {index + 1}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-base leading-tight line-clamp-2">
                {source.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {getHostname(source.url)}
              </p>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-4">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Visit page</span>
            </a>
            {source.content && (
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Stats bar */}
        {source.content && (
          <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/40 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{getReadingTime(source.content)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              <span>{getWordCount(source.content)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{source.content.length.toLocaleString()} chars</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {source.content ? (
          <div className="p-5">
            <div className="prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-a:text-primary">
              <MarkdownRenderer content={source.content} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">No content available</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Visit the page directly to view its contents
            </p>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in new tab</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for sources list
function SourcesList({ sources }: { sources: Source[] }) {
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
          className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all cursor-pointer"
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
                    className="p-2 hover:bg-accent rounded-full transition-colors cursor-pointer"
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
                        className="group relative p-3.5 rounded-2xl border border-border hover:border-primary/30 bg-card hover:bg-accent/30 cursor-pointer transition-all duration-200 hover:shadow-md source-card-gradient"
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

interface ChatProps {
  userId?: string;
}

// Message type for storage (without React nodes)
interface StorableMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  searchResults?: string;
  // Rich UI persistence fields
  type?: 'text' | 'search-display' | 'markdown' | 'error';
  sources?: Source[];
  followUpQuestions?: string[];
  // Full searchEvents for Progress UI (excluding content-chunk for size)
  searchEvents?: SearchEvent[];
}

// Message type for display - stores raw data, not JSX
interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'search-display' | 'markdown' | 'error';
  content: string;
  isStreaming?: boolean;
  sources?: Source[];
  followUpQuestions?: string[];
  searchEvents?: SearchEvent[];
  searchResults?: string;
}

// Track render count for debugging
// let renderCount = 0;

export function Chat({ userId }: ChatProps) {
  // #region agent log
  // renderCount++;
  // if (renderCount <= 50 || renderCount % 100 === 0) {
  //   fetch('http://127.0.0.1:7243/ingest/a68521b3-0cb2-4489-b824-b39724e8567a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'chat.tsx:Chat:render',message:'Component render',data:{renderCount},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  // }
  // #endregion
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [firecrawlApiKey, setFirecrawlApiKey] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [, setIsCheckingEnv] = useState<boolean>(true);
  const [pendingQuery, setPendingQuery] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const lastSavedRef = useRef<string>('');
  const abortRef = useRef<boolean>(false); // Track if current search should be aborted
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null); // Track idle check interval for cleanup
  
  // Generate conversation ID on client only to avoid hydration mismatch
  useEffect(() => {
    if (!conversationId) {
      setConversationId(uuidv4());
    }
  }, [conversationId]);

  // Check for environment variables on mount
  useEffect(() => {
    const checkEnvironment = async () => {
      setIsCheckingEnv(true);
      try {
        const response = await fetch('/api/check-env');
        const data = await response.json();
        
        if (data.environmentStatus) {
          // Only check for Firecrawl API key since we can pass it from frontend
          // OpenAI and Anthropic keys must be in environment
          setHasApiKey(data.environmentStatus.FIRECRAWL_API_KEY);
        }
      } catch (error) {
        console.error('Failed to check environment:', error);
        setHasApiKey(false);
      } finally {
        setIsCheckingEnv(false);
      }
    };

    checkEnvironment();
  }, []);

  // Save conversation when messages change (debounced)
  useEffect(() => {
    if (!userId || messages.length === 0) return;

    // Only save if we have actual content to save
    const messagesToSave: StorableMessage[] = messages
      .filter(msg => msg.content || msg.searchResults || msg.type === 'search-display')
      .map(msg => {
        const baseMessage: StorableMessage = {
          id: msg.id,
          role: msg.role,
          content: msg.content || msg.searchResults || '',
          timestamp: parseInt(msg.id) || Date.now(),
          searchResults: msg.searchResults,
          // Include rich UI fields for full conversation restoration
          type: msg.type,
          sources: msg.sources,
          followUpQuestions: msg.followUpQuestions,
        };
        
        // For search-display messages, save the detailed events (excluding content-chunk for size)
        if (msg.type === 'search-display' && msg.searchEvents && msg.searchEvents.length > 0) {
          // Filter out content-chunk events as they're redundant (we have final content)
          // and they can be very large
          baseMessage.searchEvents = msg.searchEvents.filter(e => e.type !== 'content-chunk');
        }
        
        return baseMessage;
      });

    if (messagesToSave.length === 0) return;

    // Skip if nothing changed
    const currentState = JSON.stringify(messagesToSave);
    if (currentState === lastSavedRef.current) return;

    const saveTimer = setTimeout(async () => {
      try {
        const response = await fetch('/api/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            conversationId,
            messages: messagesToSave,
            title: messagesToSave[0]?.content?.slice(0, 60),
          }),
        });

        if (response.ok) {
          lastSavedRef.current = currentState;
          // Notify sidebar to refresh
          window.dispatchEvent(new CustomEvent('conversationUpdated'));
        }
      } catch (error) {
        console.error('Failed to save conversation:', error);
      }
    }, 1000); // Debounce by 1 second

    return () => clearTimeout(saveTimer);
  }, [messages, userId, conversationId]);

  // Handle new chat event - stops AI and returns to home
  useEffect(() => {
    const handleNewChat = () => {
      // Abort any ongoing search/streaming
      abortRef.current = true;
      
      // Clear any running idle check interval
      if (idleIntervalRef.current) {
        clearInterval(idleIntervalRef.current);
        idleIntervalRef.current = null;
      }
      
      // Force reset searching state
      setIsSearching(false);
      
      // Clear all state to return to home page view
      setMessages([]);
      setInput('');
      setConversationId(uuidv4());
      lastSavedRef.current = '';
      
      // Reset abort flag after a short delay so new searches can work
      setTimeout(() => {
        abortRef.current = false;
      }, 100);
    };

    window.addEventListener('newChat', handleNewChat);
    return () => window.removeEventListener('newChat', handleNewChat);
  }, []);

  // Handle load conversation event
  useEffect(() => {
    const handleLoadConversation = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const targetConversationId = customEvent.detail.conversationId;

      if (!userId) return;

      try {
        const response = await fetch(
          `/api/conversations?userId=${userId}&conversationId=${targetConversationId}`
        );
        
        if (response.ok) {
          const data = await response.json();
          const loadedMessages = data.messages || [];

          // Convert stored messages back to display format
          const displayMessages: DisplayMessage[] = loadedMessages
            .map((msg: StorableMessage) => {
              const baseMessage: DisplayMessage = {
                id: msg.id,
                role: msg.role,
                // Use stored type if available, otherwise default based on role
                type: msg.type || (msg.role === 'assistant' ? 'markdown' : 'text'),
                content: msg.content || msg.searchResults || '',
                isStreaming: false,
                searchResults: msg.searchResults,
                // Restore rich UI fields
                sources: msg.sources,
                followUpQuestions: msg.followUpQuestions,
              };
              
              // For search-display messages, restore events and ensure source-processing events exist
              if (msg.type === 'search-display' && msg.searchEvents) {
                const events = [...msg.searchEvents] as SearchEvent[];
                
                // Get all URLs that have source-processing events
                const processedUrls = new Set(
                  events
                    .filter(e => e.type === 'source-processing' || e.type === 'source-complete')
                    .map(e => (e as { url?: string }).url)
                    .filter(Boolean)
                );
                
                // For each 'found' event, ensure all its sources have source-processing events
                // This enables the collapsible source details in FoundSourcesGroup
                const syntheticEvents: SearchEvent[] = [];
                events.forEach(event => {
                  if (event.type === 'found') {
                    event.sources.forEach(source => {
                      if (!processedUrls.has(source.url)) {
                        // Add synthetic source-processing event with the title
                        syntheticEvents.push({
                          type: 'source-processing',
                          url: source.url,
                          title: source.title,
                          stage: 'analyzing' as const
                        });
                        // Add synthetic source-complete event with summary
                        syntheticEvents.push({
                          type: 'source-complete',
                          url: source.url,
                          summary: source.summary || 'Content analyzed'
                        });
                        processedUrls.add(source.url);
                      }
                    });
                  }
                });
                
                baseMessage.searchEvents = [...events, ...syntheticEvents];
              }
              
              return baseMessage;
            });

          setMessages(displayMessages);
          setConversationId(targetConversationId);
          lastSavedRef.current = JSON.stringify(loadedMessages);
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
        toast.error('Failed to load conversation');
      }
    };

    window.addEventListener('loadConversation', handleLoadConversation);
    return () => window.removeEventListener('loadConversation', handleLoadConversation);
  }, [userId]);

  // Handle conversation deleted event
  useEffect(() => {
    const handleConversationDeleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      const deletedId = customEvent.detail.conversationId;

      if (deletedId === conversationId) {
        // Current conversation was deleted, start fresh
        setMessages([]);
        setConversationId(uuidv4());
        lastSavedRef.current = '';
      }
    };

    window.addEventListener('conversationDeleted', handleConversationDeleted);
    return () => window.removeEventListener('conversationDeleted', handleConversationDeleted);
  }, [conversationId]);

  const saveApiKey = () => {
    if (firecrawlApiKey.trim()) {
      setHasApiKey(true);
      setShowApiKeyModal(false);
      toast.success('API key saved! Starting your search...');
      
      // Continue with the pending query
      if (pendingQuery) {
        performSearch(pendingQuery);
        setPendingQuery('');
      }
    }
  };

  // Listen for follow-up question events
  useEffect(() => {
    const handleFollowUpQuestion = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const question = customEvent.detail.question;
      setInput(question);
      
      // Trigger the search immediately
      setTimeout(() => {
        const form = document.querySelector('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }, 100);
    };

    document.addEventListener('followUpQuestion', handleFollowUpQuestion);
    return () => {
      document.removeEventListener('followUpQuestion', handleFollowUpQuestion);
    };
  }, []);

  const performSearch = async (query: string) => {
    // Reset abort flag at start of new search
    abortRef.current = false;
    setIsSearching(true);

    // Create assistant message with search display
    const assistantMsgId = (Date.now() + 1).toString();
    const eventsRef: SearchEvent[] = [];
    
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      type: 'search-display',
      content: '',
      searchEvents: [],
    }]);

    // Clear any previous idle interval
    if (idleIntervalRef.current) {
      clearInterval(idleIntervalRef.current);
      idleIntervalRef.current = null;
    }

    try {
      // Build context from previous messages by pairing user queries with assistant responses
      const conversationContext: Array<{ query: string; response: string }> = [];
      
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        // Find user messages followed by assistant messages with search results
        if (msg.role === 'user' && i + 1 < messages.length) {
          const nextMsg = messages[i + 1];
          if (nextMsg.role === 'assistant' && nextMsg.searchResults) {
            conversationContext.push({
              query: msg.content,
              response: nextMsg.searchResults
            });
          }
        }
      }
      
      // Get search stream with context
      // Pass the API key only if user provided one, otherwise let server use env var
      const { stream } = await search(query, conversationContext, firecrawlApiKey || undefined);
      let finalContent = '';
      
      // Read stream and update events
      let streamingStarted = false;
      const resultMsgId = (Date.now() + 2).toString();
      let streamedContent = ''; // Track content incrementally to avoid O(n²) rebuilding
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL_MS = 50; // Throttle updates to max 20 per second
      let lastEventTime = Date.now();
      let receivedFinalResult = false;
      
      // Idle timeout: if no events for 5 seconds, consider stream ended
      const IDLE_TIMEOUT_MS = 5000;
      let timedOut = false; // Flag to stop processing after timeout
      idleIntervalRef.current = setInterval(() => {
        // Skip if aborted (new chat was clicked)
        if (abortRef.current) {
          if (idleIntervalRef.current) {
            clearInterval(idleIntervalRef.current);
            idleIntervalRef.current = null;
          }
          return;
        }
        
        const idleTime = Date.now() - lastEventTime;
        if (idleTime > IDLE_TIMEOUT_MS && streamingStarted && !receivedFinalResult && !timedOut) {
          timedOut = true;
          
          // Force finalize the streaming message
          setMessages(prev => {
            return prev.map(msg => 
              msg.id === resultMsgId 
                ? {
                    ...msg,
                    content: streamedContent,
                    isStreaming: false,
                    searchResults: streamedContent,
                  }
                : msg
            );
          });
          setIsSearching(false);
          if (idleIntervalRef.current) {
            clearInterval(idleIntervalRef.current);
            idleIntervalRef.current = null;
          }
        }
      }, 1000);
      
      for await (const event of readStreamableValue(stream)) {
        lastEventTime = Date.now();
        
        // Skip processing if we've already timed out or aborted (new chat clicked)
        if (timedOut || abortRef.current) {
          if (abortRef.current && idleIntervalRef.current) {
            clearInterval(idleIntervalRef.current);
            idleIntervalRef.current = null;
          }
          break; // Exit the stream loop entirely when aborted
        }
        
        if (event) {
          // Only store non-content events in eventsRef to avoid accumulating thousands of items
          // Content is tracked separately via streamedContent
          if (event.type !== 'content-chunk') {
            eventsRef.push(event);
          }
          
          // Handle content streaming
          if (event.type === 'content-chunk') {
            // Append new chunk incrementally instead of rebuilding from all events
            streamedContent += event.chunk;
            const content = streamedContent;
            const now = Date.now();
            
            if (!streamingStarted) {
              streamingStarted = true;
              lastUpdateTime = now;
              // Add new message for streaming content
              setMessages(prev => [...prev, {
                id: resultMsgId,
                role: 'assistant',
                type: 'markdown',
                content: content,
                isStreaming: true,
              }]);
            } else if (now - lastUpdateTime >= UPDATE_INTERVAL_MS) {
              // Throttle updates to avoid overwhelming React
              lastUpdateTime = now;
              // Update streaming message with new content
              setMessages(prev => prev.map(msg => 
                msg.id === resultMsgId 
                  ? { ...msg, content: content }
                  : msg
              ));
            }
            // Note: content is still accumulated even when update is throttled
            
          }
          
          // Capture final result
          if (event.type === 'final-result') {
            finalContent = event.content;
            receivedFinalResult = true;
            if (idleIntervalRef.current) {
              clearInterval(idleIntervalRef.current);
              idleIntervalRef.current = null;
            }
            
            // Use the accumulated streamedContent for the final update (in case throttling skipped some chunks)
            const completeContent = streamedContent || finalContent;
            
            // Update the streaming message with final content and sources
            // AND update the research box in the same state update
            const researchEvents = eventsRef.filter(e => e.type !== 'content-chunk');
            
            setMessages(prev => prev.map(msg => {
              if (msg.id === resultMsgId) {
                return {
                  ...msg,
                  content: completeContent,
                  isStreaming: false,
                  sources: event.sources || [],
                  followUpQuestions: event.followUpQuestions || [],
                  searchResults: completeContent,
                };
              }
              if (msg.id === assistantMsgId) {
                return { 
                  ...msg, 
                  searchEvents: [...researchEvents], 
                  searchResults: finalContent 
                };
              }
              return msg;
            }));
            
            // Continue to next event, skipping the generic update block
            continue;
          }
          
          // Only update research box for non-content events to avoid excessive re-renders
          // Content chunks are handled by the streaming message, not the research box
          if (event.type !== 'content-chunk') {
            // Update research box with events (eventsRef no longer contains content-chunks)
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMsgId 
                ? { ...msg, searchEvents: [...eventsRef], searchResults: finalContent }
                : msg
            ));
          }
        }
      }
      
      // Safety: If stream ended without a final-result event, finalize the streaming message anyway
      // This can happen if the server stream ends unexpectedly
      // Skip if aborted (new chat was clicked)
      if (streamingStarted && streamedContent && !abortRef.current) {
        
        // Only finalize if we didn't already get a final-result
        if (!finalContent) {
          setMessages(prev => prev.map(msg => 
            msg.id === resultMsgId 
              ? {
                  ...msg,
                  content: streamedContent,
                  isStreaming: false,
                  searchResults: streamedContent,
                }
              : msg
          ));
        }
      }
      
      if (idleIntervalRef.current) {
        clearInterval(idleIntervalRef.current);
        idleIntervalRef.current = null;
      }
    } catch (error) {
      if (idleIntervalRef.current) {
        clearInterval(idleIntervalRef.current);
        idleIntervalRef.current = null;
      }
      
      // Don't show errors if we aborted (user clicked new chat)
      if (abortRef.current) {
        return;
      }
      
      console.error('Search error:', error);
      // Remove the search display message
      setMessages(prev => prev.filter(msg => msg.id !== assistantMsgId));
      
      // Show error message to user
      const errorMessage = error instanceof Error ? error.message : 'An error occurred during search';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        type: 'error',
        content: errorMessage,
      }]);
    } finally {
      // Only reset searching state if not aborted (abort handler already did it)
      if (!abortRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSearching) return;

    const userMessage = input;
    setInput('');

    // Check if we have API key
    if (!hasApiKey) {
      // Store the query and show modal
      setPendingQuery(userMessage);
      setShowApiKeyModal(true);
      
      // Still add user message to show what they asked
      const userMsgId = Date.now().toString();
      setMessages(prev => [...prev, {
        id: userMsgId,
        role: 'user',
        type: 'text',
        content: userMessage,
      }]);
      return;
    }

    // Add user message
    const userMsgId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      type: 'text',
      content: userMessage,
    }]);

    // Perform the search
    await performSearch(userMessage);
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {messages.length === 0 ? (
        // Center input when no messages
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="w-full max-w-2xl flex flex-col items-center">
            <form onSubmit={handleSubmit} className="w-full">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Research anything"
                  className="w-full h-14 rounded-full border border-border bg-input pl-6 pr-16 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
                  disabled={isSearching}
                />
                <button
                  type="submit"
                  disabled={isSearching || !input.trim()}
                  className="absolute right-2 top-2 h-10 w-10 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center cursor-pointer"
                >
                  {isSearching ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <CornerRightUp className="w-5 h-5" />
                  )}
                </button>
                
              </div>
            </form>
            
            <div className="mt-8 w-full">
              <Suggestions 
                onValueChange={setInput}
                inputValue={input}
                isEmpty={messages.length === 0} 
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-auto scrollbar-hide px-4 sm:px-6 lg:px-8 py-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`${
                    msg.role === 'user' 
                      ? 'flex justify-end' 
                      : 'w-full'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-2xl">
                      <span className="inline-block px-5 py-3 rounded-2xl bg-secondary text-secondary-foreground">
                        {msg.content}
                      </span>
                    </div>
                  ) : (
                    <div className="w-full">
                      {/* Render based on message type */}
                      {msg.type === 'search-display' && (
                        <SearchDisplay events={msg.searchEvents || []} />
                      )}
                      {msg.type === 'markdown' && (
                        <div className="space-y-4">
                          <div className="prose dark:prose-invert max-w-none">
                            <MarkdownRenderer content={msg.content} streaming={msg.isStreaming} />
                          </div>
                          {!msg.isStreaming && msg.sources && msg.sources.length > 0 && (
                            <>
                              <CitationTooltip sources={msg.sources} />
                              
                              {/* Follow-up Questions */}
                              {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                                <div className="mt-8 pt-6 border-t border-border">
                                  <h3 className="text-sm font-semibold text-foreground mb-3">
                                    Follow-up questions
                                  </h3>
                                  <div className="space-y-2">
                                    {msg.followUpQuestions.map((question, index) => (
                                      <button
                                        key={index}
                                        onClick={() => {
                                          const evt = new CustomEvent('followUpQuestion', { 
                                            detail: { question },
                                            bubbles: true 
                                          });
                                          document.dispatchEvent(evt);
                                        }}
                                        className="block w-full text-left px-4 py-3 rounded-2xl border border-border hover:border-primary/50 hover:bg-accent transition-colors group cursor-pointer"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm text-muted-foreground group-hover:text-foreground">
                                            {question}
                                          </span>
                                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary flex-shrink-0 ml-2" />
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Sources */}
                              <SourcesList sources={msg.sources} />
                            </>
                          )}
                        </div>
                      )}
                      {msg.type === 'error' && (
                        <div className="p-4 border border-destructive/30 bg-destructive/10 rounded-xl">
                          <p className="text-destructive font-medium">Search Error</p>
                          <p className="text-destructive/80 text-sm mt-1">{msg.content}</p>
                          {(msg.content.includes('API key') || msg.content.includes('OPENAI_API_KEY')) && (
                            <p className="text-destructive/80 text-sm mt-2">
                              Please ensure all required API keys are set in your environment variables:
                              <br />• OPENAI_API_KEY (for gpt-5.2-2025-12-11)
                              <br />• ANTHROPIC_API_KEY (optional, for Claude)
                              <br />• FIRECRAWL_API_KEY (can be provided via UI)
                            </p>
                          )}
                        </div>
                      )}
                      {msg.type === 'text' && (
                        <span>{msg.content}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="bg-background px-4 sm:px-6 lg:px-8 py-6">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Research anything"
              className="w-full h-14 rounded-full border border-border bg-input pl-6 pr-16 text-base text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all"
              disabled={isSearching}
            />
            
            <button
              type="submit"
              disabled={!input.trim() || isSearching}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground flex items-center justify-center transition-colors shadow-sm cursor-pointer"
            >
              {isSearching ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <CornerRightUp className="h-5 w-5" />
              )}
            </button>
            
          </div>
        </form>
      </div>
        </>
      )}

      {/* API Key Modal */}
      <Dialog open={showApiKeyModal} onOpenChange={setShowApiKeyModal}>
        <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>Firecrawl API Key Required</DialogTitle>
            <DialogDescription>
              To use yurie, you need a Firecrawl API key. You can get one for free.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Button
                onClick={() => window.open('https://www.firecrawl.dev/app/api-keys', '_blank')}
                className="w-full"
                variant="secondary"
              >
                Get your free API key from Firecrawl →
              </Button>
            </div>
            <div className="space-y-2">
              <label htmlFor="apiKey" className="text-sm font-medium">
                Enter your API key
              </label>
              <Input
                id="apiKey"
                type="password"
                value={firecrawlApiKey}
                onChange={(e) => setFirecrawlApiKey(e.target.value)}
                placeholder="fc-..."
                className="w-full"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setShowApiKeyModal(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="default"
              onClick={saveApiKey}
              disabled={!firecrawlApiKey.trim()}
            >
              Save and Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
