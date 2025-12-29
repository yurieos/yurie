'use client';

import React, { createContext, useContext, useCallback, useState, useRef, type ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SearchEvent, Source, DisplayMessage } from '@/lib/types';
import { useSearch, type ConversationContext } from '@/hooks/use-search';

// =============================================================================
// Types
// =============================================================================

export interface SearchContextValue {
  // State
  messages: DisplayMessage[];
  conversationId: string;
  isSearching: boolean;
  hasApiKey: boolean;
  
  // Actions
  submitQuery: (query: string) => Promise<void>;
  submitFollowUp: (question: string) => void;
  startNewChat: () => void;
  loadConversation: (conversationId: string, messages: DisplayMessage[]) => void;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

// =============================================================================
// Context
// =============================================================================

const SearchContext = createContext<SearchContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface SearchProviderProps {
  children: ReactNode;
  userId?: string;
  initialApiKey?: string;
}

export function SearchProvider({ children, userId, initialApiKey }: SearchProviderProps) {
  // Core state
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>(() => uuidv4());
  const [firecrawlApiKey, setFirecrawlApiKey] = useState<string>(initialApiKey || '');
  const [hasApiKey, setHasApiKey] = useState<boolean>(!!initialApiKey);
  
  // Use our new search hook
  const { search, abort, isSearching } = useSearch();
  
  // Track save state
  const lastSavedRef = useRef<string>('');

  // Build conversation context from messages
  const buildContext = useCallback((): ConversationContext[] => {
    const context: ConversationContext[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user' && i + 1 < messages.length) {
        const nextMsg = messages[i + 1];
        if (nextMsg.role === 'assistant' && nextMsg.searchResults) {
          context.push({
            query: msg.content,
            response: nextMsg.searchResults,
          });
        }
      }
    }
    
    return context;
  }, [messages]);

  // Save conversation
  const saveConversation = useCallback(async (messagesToSave: DisplayMessage[]) => {
    if (!userId || messagesToSave.length === 0) return;

    const storable = messagesToSave
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

    if (storable.length === 0) return;

    const currentState = JSON.stringify(storable);
    if (currentState === lastSavedRef.current) return;

    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          conversationId,
          messages: storable,
          title: storable[0]?.content?.slice(0, 60),
        }),
      });

      if (response.ok) {
        lastSavedRef.current = currentState;
        window.dispatchEvent(new CustomEvent('conversationUpdated'));
      }
    } catch (error) {
      console.error('Failed to save conversation:', error);
    }
  }, [userId, conversationId]);

  // Submit a query
  const submitQuery = useCallback(async (query: string) => {
    const userMsgId = uuidv4();
    const assistantMsgId = uuidv4();
    const resultMsgId = uuidv4();
    
    const eventsRef: SearchEvent[] = [];
    
    // Add user message
    const userMessage: DisplayMessage = {
      id: userMsgId,
      role: 'user',
      type: 'text',
      content: query,
    };

    // Add search display message
    const searchDisplayMessage: DisplayMessage = {
      id: assistantMsgId,
      role: 'assistant',
      type: 'search-display',
      content: '',
      searchEvents: [],
    };

    setMessages(prev => [...prev, userMessage, searchDisplayMessage]);

    const context = buildContext();

    try {
      let streamingStarted = false;
      
      await search(
        query,
        context,
        {
          onEvent: (event) => {
            // Store non-content events
            if (event.type !== 'content-chunk') {
              eventsRef.push(event);
              // Update search display with events
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMsgId
                  ? { ...msg, searchEvents: [...eventsRef] }
                  : msg
              ));
            }
          },
          onStreamStart: () => {
            streamingStarted = true;
            // Add streaming result message
            setMessages(prev => [...prev, {
              id: resultMsgId,
              role: 'assistant',
              type: 'markdown',
              content: '',
              isStreaming: true,
            }]);
          },
          onStreamChunk: (_chunk, fullContent) => {
            // Update streaming content
            setMessages(prev => prev.map(msg =>
              msg.id === resultMsgId
                ? { ...msg, content: fullContent }
                : msg
            ));
          },
          onComplete: (content, sources, followUpQuestions) => {
            // Finalize result message
            setMessages(prev => {
              const updated = prev.map(msg => {
                if (msg.id === resultMsgId || (!streamingStarted && msg.id === assistantMsgId)) {
                  return {
                    ...msg,
                    id: resultMsgId,
                    type: 'markdown' as const,
                    content,
                    isStreaming: false,
                    sources,
                    followUpQuestions,
                    searchResults: content,
                  };
                }
                if (msg.id === assistantMsgId) {
                  return {
                    ...msg,
                    searchEvents: [...eventsRef],
                    searchResults: content,
                  };
                }
                return msg;
              });
              
              // If streaming never started, we need to add the result message
              if (!streamingStarted) {
                const hasResult = updated.some(m => m.id === resultMsgId);
                if (!hasResult) {
                  updated.push({
                    id: resultMsgId,
                    role: 'assistant',
                    type: 'markdown',
                    content,
                    isStreaming: false,
                    sources,
                    followUpQuestions,
                    searchResults: content,
                  });
                }
              }
              
              // Save conversation after complete
              saveConversation(updated);
              
              return updated;
            });
          },
          onError: (error) => {
            // Remove search display and add error message
            setMessages(prev => [
              ...prev.filter(msg => msg.id !== assistantMsgId && msg.id !== resultMsgId),
              {
                id: uuidv4(),
                role: 'assistant',
                type: 'error',
                content: error,
              },
            ]);
          },
        },
        firecrawlApiKey || undefined
      );
    } catch (error) {
      console.error('Search error:', error);
      // Remove incomplete messages and show error
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
  }, [buildContext, search, firecrawlApiKey, saveConversation]);

  // Submit follow-up question
  const submitFollowUp = useCallback((question: string) => {
    submitQuery(question);
  }, [submitQuery]);

  // Start new chat
  const startNewChat = useCallback(() => {
    abort();
    setMessages([]);
    setConversationId(uuidv4());
    lastSavedRef.current = '';
  }, [abort]);

  // Load existing conversation
  const loadConversation = useCallback((newConversationId: string, newMessages: DisplayMessage[]) => {
    abort();
    setMessages(newMessages);
    setConversationId(newConversationId);
    lastSavedRef.current = JSON.stringify(newMessages);
  }, [abort]);

  // API key management
  const setApiKeyHandler = useCallback((key: string) => {
    setFirecrawlApiKey(key);
    setHasApiKey(true);
  }, []);

  const clearApiKey = useCallback(() => {
    setFirecrawlApiKey('');
    setHasApiKey(false);
  }, []);

  const value: SearchContextValue = {
    // State
    messages,
    conversationId,
    isSearching,
    hasApiKey,
    
    // Actions
    submitQuery,
    submitFollowUp,
    startNewChat,
    loadConversation,
    setApiKey: setApiKeyHandler,
    clearApiKey,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useSearchContext(): SearchContextValue {
  const context = useContext(SearchContext);
  
  if (!context) {
    throw new Error('useSearchContext must be used within a SearchProvider');
  }
  
  return context;
}

// =============================================================================
// Optional: Standalone hook for components that just need follow-up handling
// =============================================================================

export function useFollowUpHandler() {
  const { submitFollowUp } = useSearchContext();
  return submitFollowUp;
}

