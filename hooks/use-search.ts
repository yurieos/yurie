'use client';

import { useRef, useCallback, useState } from 'react';
import { readStreamableValue } from 'ai/rsc';
import { search as searchAction } from '@/app/search';
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

const IDLE_TIMEOUT_MS = 5000;
const UPDATE_THROTTLE_MS = 50;

/**
 * Custom hook for managing search operations with streaming support.
 * Encapsulates all streaming logic, abort handling, and idle timeout management.
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
  const abortRef = useRef<boolean>(false);
  const idleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const lastUpdateTimeRef = useRef<number>(0);

  /**
   * Cleanup function to clear intervals and reset state
   */
  const cleanup = useCallback(() => {
    if (idleIntervalRef.current) {
      clearInterval(idleIntervalRef.current);
      idleIntervalRef.current = null;
    }
  }, []);

  /**
   * Abort the current search operation
   */
  const abort = useCallback(() => {
    abortRef.current = true;
    cleanup();
    setState(prev => ({ ...prev, isSearching: false }));
  }, [cleanup]);

  /**
   * Reset the search state for a new search
   */
  const reset = useCallback(() => {
    abortRef.current = false;
    setState({
      isSearching: false,
      streamedContent: '',
      sources: [],
      followUpQuestions: [],
      error: null,
    });
  }, []);

  /**
   * Execute a search with streaming support
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
    // Reset abort flag at start
    abortRef.current = false;
    cleanup();

    setState(prev => ({
      ...prev,
      isSearching: true,
      streamedContent: '',
      sources: [],
      followUpQuestions: [],
      error: null,
    }));

    let streamedContent = '';
    let finalContent = '';
    let sources: Source[] = [];
    let followUpQuestions: string[] = [];
    let streamingStarted = false;
    let receivedFinalResult = false;
    let timedOut = false;

    // Setup idle timeout checker
    lastEventTimeRef.current = Date.now();
    idleIntervalRef.current = setInterval(() => {
      if (abortRef.current) {
        cleanup();
        return;
      }

      const idleTime = Date.now() - lastEventTimeRef.current;
      if (idleTime > IDLE_TIMEOUT_MS && streamingStarted && !receivedFinalResult && !timedOut) {
        timedOut = true;
        cleanup();
        
        // Finalize with current content
        setState(prev => ({
          ...prev,
          isSearching: false,
          streamedContent: streamedContent,
        }));
        
        callbacks.onComplete?.(streamedContent, sources, followUpQuestions);
      }
    }, 1000);

    try {
      const { stream } = await searchAction(query, context, firecrawlApiKey);

      for await (const event of readStreamableValue(stream)) {
        lastEventTimeRef.current = Date.now();

        // Check abort/timeout conditions
        if (timedOut || abortRef.current) {
          if (abortRef.current) {
            cleanup();
          }
          break;
        }

        if (!event) continue;

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

        // Handle final result
        if (event.type === 'final-result') {
          finalContent = event.content;
          sources = event.sources || [];
          followUpQuestions = event.followUpQuestions || [];
          receivedFinalResult = true;

          cleanup();

          // Use accumulated content or final content
          const completeContent = streamedContent || finalContent;

          setState({
            isSearching: false,
            streamedContent: completeContent,
            sources,
            followUpQuestions,
            error: null,
          });

          callbacks.onComplete?.(completeContent, sources, followUpQuestions);
          
          return { content: completeContent, sources, followUpQuestions };
        }
      }

      // Stream ended without final-result
      if (streamingStarted && streamedContent && !abortRef.current && !receivedFinalResult) {
        cleanup();
        
        setState(prev => ({
          ...prev,
          isSearching: false,
          streamedContent,
        }));

        callbacks.onComplete?.(streamedContent, sources, followUpQuestions);
        return { content: streamedContent, sources, followUpQuestions };
      }

      cleanup();
      setState(prev => ({ ...prev, isSearching: false }));
      return null;

    } catch (error) {
      cleanup();

      // Don't report errors if aborted
      if (abortRef.current) {
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
  }, [cleanup]);

  return {
    // State
    ...state,
    
    // Actions
    search,
    abort,
    reset,
  };
}

