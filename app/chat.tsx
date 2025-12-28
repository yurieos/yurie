'use client';

import { useState, useEffect, useRef } from 'react';
import { search } from './search';
import { readStreamableValue } from 'ai/rsc';
import { SearchDisplay } from './search-display/';
import { SearchEvent } from '@/lib/langgraph-search-engine';
import { StorableMessage, DisplayMessage } from '@/lib/types';
import { MarkdownRenderer } from './markdown-renderer';
import { CitationTooltip } from './citation-tooltip';
import { SourcesList } from './chat/sources-list';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Suggestions } from "@/components/suggestions";
import { Loader2, CornerRightUp, ChevronRight } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ChatProps {
  userId?: string;
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
                  className="input-search"
                  disabled={isSearching}
                />
                <button
                  type="submit"
                  disabled={isSearching || !input.trim()}
                  className="absolute right-2 top-2 btn-icon-primary disabled:opacity-50"
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
                      <span className="bubble-user">{msg.content}</span>
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
                                        className="btn-followup group"
                                      >
                                        <div className="flex-between">
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
                        <div className="bubble-error">
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
              className="input-search"
              disabled={isSearching}
            />
            
            <button
              type="submit"
              disabled={!input.trim() || isSearching}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon-primary"
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
