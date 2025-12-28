'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { SearchEvent } from '@/lib/langgraph-search-engine';
import { StorableMessage, DisplayMessage } from '@/lib/types';

// Re-export types for backwards compatibility
export type { StorableMessage, DisplayMessage } from '@/lib/types';

interface UseConversationOptions {
  userId?: string;
}

export function useConversation({ userId }: UseConversationOptions) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [conversationId, setConversationId] = useState<string>('');
  const lastSavedRef = useRef<string>('');

  // Generate conversation ID on client only
  useEffect(() => {
    if (!conversationId) {
      setConversationId(uuidv4());
    }
  }, [conversationId]);

  // Save conversation when messages change (debounced)
  useEffect(() => {
    if (!userId || messages.length === 0) return;

    const messagesToSave: StorableMessage[] = messages
      .filter(msg => msg.content || msg.searchResults || msg.type === 'search-display')
      .map(msg => {
        const baseMessage: StorableMessage = {
          id: msg.id,
          role: msg.role,
          content: msg.content || msg.searchResults || '',
          timestamp: parseInt(msg.id) || Date.now(),
          searchResults: msg.searchResults,
          type: msg.type,
          sources: msg.sources,
          followUpQuestions: msg.followUpQuestions,
        };
        
        if (msg.type === 'search-display' && msg.searchEvents && msg.searchEvents.length > 0) {
          baseMessage.searchEvents = msg.searchEvents.filter(e => e.type !== 'content-chunk');
        }
        
        return baseMessage;
      });

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

  const resetConversation = useCallback(() => {
    setMessages([]);
    setConversationId(uuidv4());
    lastSavedRef.current = '';
  }, []);

  return {
    messages,
    setMessages,
    conversationId,
    resetConversation,
  };
}

