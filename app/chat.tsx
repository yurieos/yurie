'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useSearch, type ConversationContext } from '@/hooks/use-search';

interface ChatProps {
  userId?: string;
}

export function Chat({ userId }: ChatProps) {
  // State
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [firecrawlApiKey, setFirecrawlApiKey] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [, setIsCheckingEnv] = useState<boolean>(true);
  const [pendingQuery, setPendingQuery] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const [conversationMode, setConversationMode] = useState<'default' | 'visual'>('default');
  
  // Refs
  const lastSavedRef = useRef<string>('');
  const abortRef = useRef<boolean>(false);
  
  // Use search hook
  const { search: performSearchHook, abort: abortSearch, isSearching } = useSearch();

  // Generate conversation ID on client only
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

  // Save conversation when messages change
  useEffect(() => {
    if (!userId || messages.length === 0) return;

    const messagesToSave: StorableMessage[] = messages
      .filter(msg => msg.content || msg.searchResults || msg.type === 'search-display')
      .map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content || msg.searchResults || '',
        timestamp: parseInt(msg.id) || Date.now(),
        searchResults: msg.searchResults,
        type: msg.type,
        sources: msg.sources,
        followUpQuestions: msg.followUpQuestions,
        searchEvents: msg.type === 'search-display' && msg.searchEvents
          ? msg.searchEvents.filter(e => e.type !== 'content-chunk')
          : undefined,
      }));

    if (messagesToSave.length === 0) return;

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
          window.dispatchEvent(new CustomEvent('conversationUpdated'));
        }
      } catch (error) {
        console.error('Failed to save conversation:', error);
      }
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [messages, userId, conversationId]);

  // Notify header about message state changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('messagesChanged', { 
      detail: { hasMessages: messages.length > 0, isVisualMode: conversationMode === 'visual' } 
    }));
  }, [messages.length, conversationMode]);

  // Handle new chat event
  useEffect(() => {
    const handleNewChat = () => {
      abortRef.current = true;
      abortSearch();
      setMessages([]);
      setConversationMode('default');
      setInput('');
      setConversationId(uuidv4());
      lastSavedRef.current = '';
      setTimeout(() => { abortRef.current = false; }, 100);
    };

    window.addEventListener('newChat', handleNewChat);
    return () => window.removeEventListener('newChat', handleNewChat);
  }, [abortSearch]);

  // Handle load conversation event
  useEffect(() => {
    const handleLoadConversation = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const targetConversationId = customEvent.detail.conversationId;
      const mode = customEvent.detail.mode as 'default' | 'visual' | undefined;
      const loadedMode = mode || 'default';

      // Set conversation mode from event
      setConversationMode(loadedMode);

      if (!userId) return;

      try {
        const response = await fetch(
          `/api/conversations?userId=${userId}&conversationId=${targetConversationId}`
        );
        
        if (response.ok) {
          const data = await response.json();
          const loadedMessages = data.messages || [];

          const displayMessages: DisplayMessage[] = loadedMessages.map((msg: StorableMessage) => {
            const baseMessage: DisplayMessage = {
              id: msg.id,
              role: msg.role,
              type: msg.type || (msg.role === 'assistant' ? 'markdown' : 'text'),
              content: msg.content || msg.searchResults || '',
              isStreaming: false,
              searchResults: msg.searchResults,
              sources: msg.sources,
              followUpQuestions: msg.followUpQuestions,
            };
            
            if (msg.type === 'search-display' && msg.searchEvents) {
              const events = [...msg.searchEvents] as SearchEvent[];
              const processedUrls = new Set(
                events
                  .filter(e => e.type === 'source-processing' || e.type === 'source-complete')
                  .map(e => (e as { url?: string }).url)
                  .filter(Boolean)
              );
              
              const syntheticEvents: SearchEvent[] = [];
              events.forEach(event => {
                if (event.type === 'found') {
                  event.sources.forEach(source => {
                    if (!processedUrls.has(source.url)) {
                      syntheticEvents.push({
                        type: 'source-processing',
                        url: source.url,
                        title: source.title,
                        stage: 'analyzing' as const
                      });
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
          
          // Manually dispatch event with loaded mode to ensure header updates correctly
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('messagesChanged', { 
              detail: { hasMessages: displayMessages.length > 0, isVisualMode: loadedMode === 'visual' } 
            }));
          }, 0);
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
        setMessages([]);
        setConversationId(uuidv4());
        lastSavedRef.current = '';
      }
    };

    window.addEventListener('conversationDeleted', handleConversationDeleted);
    return () => window.removeEventListener('conversationDeleted', handleConversationDeleted);
  }, [conversationId]);

  // Handle follow-up questions
  const handleFollowUpQuestion = useCallback((question: string) => {
    setInput(question);
    // Submit automatically after setting input
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  }, []);

  // Listen for follow-up question events
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      handleFollowUpQuestion(customEvent.detail.question);
    };

    document.addEventListener('followUpQuestion', handler);
    return () => document.removeEventListener('followUpQuestion', handler);
  }, [handleFollowUpQuestion]);

  const saveApiKey = () => {
    if (firecrawlApiKey.trim()) {
      setHasApiKey(true);
      setShowApiKeyModal(false);
      toast.success('API key saved! Starting your search...');
      
      if (pendingQuery) {
        performSearch(pendingQuery);
        setPendingQuery('');
      }
    }
  };

  // Build conversation context
  const buildContext = useCallback((): ConversationContext[] => {
    const context: ConversationContext[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user' && i + 1 < messages.length) {
        const nextMsg = messages[i + 1];
        if (nextMsg.role === 'assistant' && nextMsg.searchResults) {
          context.push({ query: msg.content, response: nextMsg.searchResults });
        }
      }
    }
    return context;
  }, [messages]);

  // Perform search with streaming
  const performSearch = async (query: string) => {
    abortRef.current = false;
    const assistantMsgId = uuidv4();
    const resultMsgId = uuidv4();
    const eventsRef: SearchEvent[] = [];
    let streamingStarted = false;

    // Add search display message
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      type: 'search-display',
      content: '',
      searchEvents: [],
    }]);

    const context = buildContext();

    try {
      await performSearchHook(
        query,
        context,
        {
          onEvent: (event) => {
            if (abortRef.current) return;
            if (event.type !== 'content-chunk') {
              eventsRef.push(event);
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMsgId
                  ? { ...msg, searchEvents: [...eventsRef] }
                  : msg
              ));
            }
          },
          onStreamStart: () => {
            if (abortRef.current) return;
            streamingStarted = true;
            setMessages(prev => [...prev, {
              id: resultMsgId,
              role: 'assistant',
              type: 'markdown',
              content: '',
              isStreaming: true,
            }]);
          },
          onStreamChunk: (_chunk, fullContent) => {
            if (abortRef.current) return;
            setMessages(prev => prev.map(msg =>
              msg.id === resultMsgId ? { ...msg, content: fullContent } : msg
            ));
          },
          onComplete: (content, sources, followUpQuestions) => {
            if (abortRef.current) return;
            setMessages(prev => {
              let updated = prev.map(msg => {
                if (msg.id === resultMsgId) {
                  return {
                    ...msg,
                    content,
                    isStreaming: false,
                    sources,
                    followUpQuestions,
                    searchResults: content,
                  };
                }
                if (msg.id === assistantMsgId) {
                  return { ...msg, searchEvents: [...eventsRef], searchResults: content };
                }
                return msg;
              });

              if (!streamingStarted) {
                const hasResult = updated.some(m => m.id === resultMsgId);
                if (!hasResult) {
                  updated = [...updated, {
                    id: resultMsgId,
                    role: 'assistant' as const,
                    type: 'markdown' as const,
                    content,
                    isStreaming: false,
                    sources,
                    followUpQuestions,
                    searchResults: content,
                  }];
                }
              }
              return updated;
            });
          },
          onError: (errorMsg) => {
            if (abortRef.current) return;
            setMessages(prev => [
              ...prev.filter(msg => msg.id !== assistantMsgId && msg.id !== resultMsgId),
              {
                id: uuidv4(),
                role: 'assistant',
                type: 'error',
                content: errorMsg,
              },
            ]);
          },
        },
        firecrawlApiKey || undefined
      );
    } catch (error) {
      if (abortRef.current) return;
      console.error('Search error:', error);
      setMessages(prev => [
        ...prev.filter(msg => msg.id !== assistantMsgId && msg.id !== resultMsgId),
        {
          id: uuidv4(),
          role: 'assistant',
          type: 'error',
          content: error instanceof Error ? error.message : 'An error occurred during search',
        },
      ]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSearching) return;

    const userMessage = input;
    setInput('');

    if (!hasApiKey) {
      setPendingQuery(userMessage);
      setShowApiKeyModal(true);
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'user',
        type: 'text',
        content: userMessage,
      }]);
      return;
    }

    setMessages(prev => [...prev, {
      id: uuidv4(),
      role: 'user',
      type: 'text',
      content: userMessage,
    }]);

    await performSearch(userMessage);
  };

  return (
    <div className="flex flex-col flex-1 h-full overflow-hidden">
      {messages.length === 0 ? (
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
          <div className="flex-1 overflow-auto scrollbar-hide px-4 sm:px-6 lg:px-8 py-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`${msg.role === 'user' ? 'flex justify-end' : 'w-full'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-2xl">
                      <span className="bubble-user text-base leading-[1.6] tracking-[0.01em]">{msg.content}</span>
                    </div>
                  ) : (
                    <div className="w-full">
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
                              {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                                <div className="mt-8 pt-6 border-t border-border">
                                  <h3 className="text-sm font-semibold text-foreground mb-3">
                                    Follow-up questions
                                  </h3>
                                  <div className="space-y-2">
                                    {msg.followUpQuestions.map((question, index) => (
                                      <button
                                        key={index}
                                        onClick={() => handleFollowUpQuestion(question)}
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
                      {msg.type === 'text' && <span>{msg.content}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

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
            <Button variant="ghost" onClick={() => setShowApiKeyModal(false)}>
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
