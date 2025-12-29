'use client';

import { useRef, useCallback, useState } from 'react';
import { SearchEvent, Source } from '@/lib/types';

export interface SearchState {
  isSearching: boolean;
  streamedContent: string;
  sources: Source[];
  followUpQuestions: string[];
  error: string | null;
}

export interface SearchCallbacks {
  onEvent?: (event: SearchEvent) => void;
  onStreamStart?: () => void;
  onStreamChunk?: (content: string, fullContent: string) => void;
  onComplete?: (content: string, sources: Source[], followUpQuestions: string[]) => void;
  onError?: (error: string) => void;
}

export interface ConversationContext {
  query: string;
  response: string;
}

// Timeout for idle connection (no data received)
const IDLE_TIMEOUT_MS = 60000; // 60 seconds
const UPDATE_THROTTLE_MS = 50;

/**
 * Custom hook for managing search operations with streaming support.
 * Uses SSE (Server-Sent Events) for reliable streaming instead of ai/rsc.
 */
export function useSearch() {
  const [state, setState] = useState<SearchState>({
    isSearching: false,
    streamedContent: '',
    sources: [],
    followUpQuestions: [],
    error: null,
  });

  // Refs for abort and cleanup
  const abortControllerRef = useRef<AbortController | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const lastUpdateTimeRef = useRef<number>(0);

  /**
   * Cleanup function to clear timeouts and abort controller
   */
  const cleanup = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  /**
   * Reset the idle timeout
   */
  const resetIdleTimeout = useCallback((
    onTimeout: () => void
  ) => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    idleTimeoutRef.current = setTimeout(onTimeout, IDLE_TIMEOUT_MS);
    lastEventTimeRef.current = Date.now();
  }, []);

  /**
   * Abort the current search operation
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    cleanup();
    setState(prev => ({ ...prev, isSearching: false }));
  }, [cleanup]);

  /**
   * Reset the search state for a new search
   */
  const reset = useCallback(() => {
    abort();
    setState({
      isSearching: false,
      streamedContent: '',
      sources: [],
      followUpQuestions: [],
      error: null,
    });
  }, [abort]);

  /**
   * Execute a search with streaming support using SSE
   */
  const search = useCallback(async (
    query: string,
    context: ConversationContext[] = [],
    callbacks: SearchCallbacks = {},
    firecrawlApiKey?: string
  ): Promise<{
    content: string;
    sources: Source[];
    followUpQuestions: string[];
  } | null> => {
    // Abort any existing search
    abort();
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isSearching: true,
      streamedContent: '',
      sources: [],
      followUpQuestions: [],
      error: null,
    }));

    let streamedContent = '';
    let sources: Source[] = [];
    let followUpQuestions: string[] = [];
    let streamingStarted = false;
    let receivedFinalResult = false;

    // Setup idle timeout handler
    const handleIdleTimeout = () => {
      console.warn('[useSearch] Idle timeout reached, finalizing with current content');
      
      if (!receivedFinalResult && streamingStarted && streamedContent) {
        receivedFinalResult = true;
        cleanup();

        setState(prev => ({
          ...prev,
          isSearching: false,
          streamedContent,
        }));

        callbacks.onComplete?.(streamedContent, sources, followUpQuestions);
      }
    };

    resetIdleTimeout(handleIdleTimeout);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(firecrawlApiKey ? { 'X-Firecrawl-API-Key': firecrawlApiKey } : {}),
        },
        body: JSON.stringify({ query, context, apiKey: firecrawlApiKey }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process any remaining buffer content
          if (buffer.trim()) {
            const lines = buffer.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const event = JSON.parse(line.slice(6)) as SearchEvent;
                  processEvent(event);
                } catch {
                  // Ignore parse errors for incomplete data
                }
              }
            }
          }
          break;
        }

        // Reset idle timeout on data received
        resetIdleTimeout(handleIdleTimeout);

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as SearchEvent;
            processEvent(event);
          } catch (parseError) {
            // Ignore parse errors for incomplete JSON
            if (!(parseError instanceof SyntaxError)) {
              console.error('[useSearch] Parse error:', parseError);
            }
          }
        }
      }

      function processEvent(event: SearchEvent) {
        if (receivedFinalResult || abortControllerRef.current?.signal.aborted) {
          return;
        }

        // Forward all events to callback
        callbacks.onEvent?.(event);

        // Handle content streaming
        if (event.type === 'content-chunk') {
          streamedContent += event.chunk;
          const now = Date.now();

          if (!streamingStarted) {
            streamingStarted = true;
            lastUpdateTimeRef.current = now;
            callbacks.onStreamStart?.();
          }

          // Throttle state updates for performance
          if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE_MS) {
            lastUpdateTimeRef.current = now;
            setState(prev => ({ ...prev, streamedContent }));
            callbacks.onStreamChunk?.(event.chunk, streamedContent);
          }
        }

        // Collect sources from found events
        if (event.type === 'found' && event.sources) {
          sources = [...sources, ...event.sources];
        }

        // Handle final result
        if (event.type === 'final-result') {
          receivedFinalResult = true;
          cleanup();

          const finalContent = streamedContent || event.content || '';
          sources = event.sources || sources;
          followUpQuestions = event.followUpQuestions || [];

          setState({
            isSearching: false,
            streamedContent: finalContent,
            sources,
            followUpQuestions,
            error: null,
          });

          callbacks.onComplete?.(finalContent, sources, followUpQuestions);
        }

        // Handle error events from the stream
        if (event.type === 'error') {
          cleanup();
          const errorMessage = event.error || 'An error occurred';
          
          setState(prev => ({
            ...prev,
            isSearching: false,
            error: errorMessage,
          }));

          callbacks.onError?.(errorMessage);
        }
      }

      // Stream ended
      cleanup();

      // If we got content but no final-result, still complete successfully
      if (streamingStarted && streamedContent && !receivedFinalResult) {
        receivedFinalResult = true;
        
        setState(prev => ({
          ...prev,
          isSearching: false,
          streamedContent,
        }));

        callbacks.onComplete?.(streamedContent, sources, followUpQuestions);
        return { content: streamedContent, sources, followUpQuestions };
      }

      if (receivedFinalResult) {
        return { content: streamedContent, sources, followUpQuestions };
      }

      setState(prev => ({ ...prev, isSearching: false }));
      return null;

    } catch (error) {
      cleanup();

      // Don't report errors if aborted
      if (error instanceof Error && error.name === 'AbortError') {
        setState(prev => ({ ...prev, isSearching: false }));
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'An error occurred during search';

      setState(prev => ({
        ...prev,
        isSearching: false,
        error: errorMessage,
      }));

      callbacks.onError?.(errorMessage);
      throw error;
    }
  }, [abort, cleanup, resetIdleTimeout]);

  return {
    // State
    ...state,

    // Actions
    search,
    abort,
    reset,
  };
}
