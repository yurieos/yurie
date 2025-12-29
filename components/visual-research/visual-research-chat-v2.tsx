'use client';

// Force refresh after icon update
import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, CornerRightUp, Copy, Check, AlertCircle, Compass, Users, Palette, Wind, Brain } from 'lucide-react';
import { SearchResultsDisplay } from './search-results-display';
import { MarkdownRenderer } from '@/app/markdown-renderer';
import { cn } from '@/lib/utils';
import type { VisualSearchResult, Source, StorableMessage } from '@/lib/types';
import { useUser } from '@clerk/nextjs';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  isError?: boolean;
}

interface SearchState {
  phase: 'idle' | 'searching' | 'scraping' | 'analyzing' | 'complete' | 'error';
  message?: string;
}

const SUGGESTED_QUERIES = [
  {
    text: "How did the ancient Nazca people create giant geoglyphs only visible from the sky?",
    icon: Compass
  },
  {
    text: "What made the Stanford Prison Experiment spiral into horror in just 6 days?",
    icon: Users
  },
  {
    text: "How did forger Han van Meegeren create fake Vermeers that fooled the Nazis?",
    icon: Palette
  },
  {
    text: "What causes the 'Sailing Stones' of Death Valley to move completely on their own?",
    icon: Wind
  },
  {
    text: "How did Phineas Gage survive an iron rod through his brain and change neuroscience?",
    icon: Brain
  }
];

interface VisualResearchChatProps {
  userId?: string;
  onMessagesChange?: (hasMessages: boolean) => void;
}

export function VisualResearchChat({ userId, onMessagesChange }: VisualResearchChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>({ phase: 'idle' });
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [searchResults, setSearchResults] = useState<VisualSearchResult[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentScrapingUrl, setCurrentScrapingUrl] = useState('');
  const [screenshots, setScreenshots] = useState<Array<{ url: string; screenshot?: string }>>([]);
  const [showBrowser, setShowBrowser] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSavedRef = useRef<string>('');
  const { user } = useUser();

  // Generate conversation ID on client only
  useEffect(() => {
    if (!conversationId) {
      setConversationId(uuidv4());
    }
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    onMessagesChange?.(messages.length > 0);
  }, [messages.length, onMessagesChange]);

  // Handle new visual chat event
  useEffect(() => {
    const handleNewChat = () => {
      setMessages([]);
      setInput('');
      setIsSearching(false);
      setSearchState({ phase: 'idle' });
      setShowSuggestions(true);
      setSearchResults([]);
      setCurrentQuery('');
      setCurrentScrapingUrl('');
      setScreenshots([]);
      setShowBrowser(true);
      setConversationId(uuidv4());
      lastSavedRef.current = '';
    };

    window.addEventListener('newVisualChat', handleNewChat);
    return () => window.removeEventListener('newVisualChat', handleNewChat);
  }, []);

  // Save conversation when messages change (debounced)
  useEffect(() => {
    if (!userId || messages.length === 0 || !conversationId) return;

    // Only save messages that are complete (not streaming)
    const completedMessages = messages.filter(msg => !msg.isStreaming);
    if (completedMessages.length === 0) return;

    // Map Message interface to StorableMessage
    const messagesToSave: StorableMessage[] = completedMessages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: parseInt(msg.id) || Date.now(),
      type: msg.isError ? 'error' : (msg.role === 'user' ? 'text' : 'markdown'),
      sources: msg.sources,
    }));

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
            mode: 'visual',
          }),
        });

        if (response.ok) {
          lastSavedRef.current = currentState;
          window.dispatchEvent(new CustomEvent('conversationUpdated'));
        }
      } catch (error) {
        console.error('Failed to save visual research conversation:', error);
      }
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [messages, userId, conversationId]);

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSearch = async (query: string) => {
    if (!query.trim() || isSearching) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSearching(true);
    setSearchState({ phase: 'searching', message: 'Searching...' });
    setShowSuggestions(false);
    setSearchResults([]);
    setCurrentScrapingUrl('');
    setScreenshots([]);
    setCurrentQuery(query);
    setShowBrowser(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true
    }]);

    try {
      const response = await fetch('/api/visual-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response stream');

      let finalContent = '';
      let allSources: Source[] = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            
            if (data.type === 'event') {
              const event = data.event;
              
              switch (event.type) {
                case 'searching':
                  setSearchState({ phase: 'searching', message: 'Searching the web...' });
                  if (event.query) setCurrentQuery(event.query);
                  break;
                case 'found':
                  if (event.sources) {
                    allSources = [...allSources, ...event.sources];
                    setSearchResults(event.sources.map((s: Source) => ({
                      url: s.url,
                      title: s.title,
                      description: s.summary || s.content?.substring(0, 150),
                    })));
                  }
                  break;
                case 'visual-search-results':
                  if (event.results) setSearchResults(event.results);
                  break;
                case 'scraping':
                case 'visual-scraping':
                  setSearchState({ phase: 'scraping', message: `Analyzing ${event.index}/${event.total}` });
                  if (event.url) setCurrentScrapingUrl(event.url);
                  break;
                case 'screenshot-captured':
                  if (event.url && event.screenshot) {
                    setScreenshots(prev => 
                      prev.some(s => s.url === event.url) ? prev : [...prev, { url: event.url, screenshot: event.screenshot }]
                    );
                  }
                  break;
                case 'source-complete':
                  if (event.screenshot && event.url) {
                    setScreenshots(prev => 
                      prev.some(s => s.url === event.url) ? prev : [...prev, { url: event.url, screenshot: event.screenshot }]
                    );
                  }
                  break;
                case 'analyzing':
                  setSearchState({ phase: 'analyzing', message: 'Synthesizing...' });
                  setCurrentScrapingUrl('');
                  break;
              }
            } else if (data.type === 'content') {
              finalContent += data.chunk;
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId ? { ...msg, content: finalContent } : msg
              ));
            } else if (data.type === 'done') {
              setSearchState({ phase: 'complete' });
              setMessages(prev => prev.map(msg => 
                msg.id === assistantMessageId
                  ? { ...msg, content: finalContent || data.content || '', isStreaming: false, sources: allSources }
                  : msg
              ));
            } else if (data.type === 'error') {
              throw new Error(data.error);
            }
          } catch (parseError) {
            if (!(parseError instanceof SyntaxError)) throw parseError;
          }
        }
      }

      if (finalContent && searchState.phase !== 'complete') {
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId
            ? { ...msg, content: finalContent, isStreaming: false, sources: allSources }
            : msg
        ));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setSearchState({ phase: 'error', message: errorMessage });
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { ...msg, content: errorMessage, isStreaming: false, isError: true }
          : msg
      ));
    } finally {
      setIsSearching(false);
      setCurrentScrapingUrl('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(input);
  };

  const hasMessages = messages.length > 0;

  // Initial view - centered with hero
  if (!hasMessages) {
    return (
      <div className="w-full max-w-xl mx-auto px-4">
        {/* Hero text */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-serif font-medium text-foreground animate-fade-up">
            Hello, <em>{user?.firstName || 'there'}</em>.
          </h1>
          <p className="mt-3 text-body-sm text-muted-foreground animate-fade-up max-w-lg mx-auto" style={{ animationDelay: '100ms' }}>
            Peek into Yurie's browser as it researches in real-time
          </p>
        </div>

        {/* Search input */}
        <form onSubmit={handleSubmit} className="relative animate-fade-up" style={{ animationDelay: '150ms' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What would you like to research?"
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
        </form>

        {/* Suggestions */}
        {showSuggestions && (
          <div className="mt-6 space-y-2">
            <p className="text-caption">Try asking:</p>
            {SUGGESTED_QUERIES.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSearch(suggestion.text)}
                className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-2xl border border-border hover:border-primary/30 hover:bg-accent/50 transition-all animate-fade-up cursor-pointer"
                style={{ animationDelay: `${200 + idx * 50}ms` }}
              >
                <suggestion.icon className="icon-xs text-primary/60 flex-shrink-0" />
                <span className="flex-1 text-body-sm">{suggestion.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Split layout
  return (
    <div className="flex flex-col-reverse lg:flex-row gap-3 h-[calc(100vh-140px)] animate-fade-in mt-4 lg:mt-0">
      {/* Chat Panel */}
      <div className={cn(
        "flex flex-col card-surface overflow-hidden transition-all duration-500",
        showBrowser ? "h-[50%] lg:h-full lg:w-1/2" : "h-full w-full"
      )}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {message.role === 'user' ? (
                <div className="bubble-user text-base leading-[1.6] tracking-[0.01em] max-w-[85%]">
                  {message.content}
                </div>
              ) : (
                <div className="max-w-full space-y-1">
                  {message.content ? (
                    <div className={cn(
                      "px-4 py-3 rounded-2xl [&_p:last-child]:mb-0",
                      message.isError ? "bubble-error" : "bg-muted/30"
                    )}>
                      {message.isError ? (
                        <div className="flex items-start gap-2 text-destructive">
                          <AlertCircle className="icon-sm mt-0.5 flex-shrink-0" />
                          <span className="text-sm">{message.content}</span>
                        </div>
                      ) : (
                        <MarkdownRenderer content={message.content} streaming={message.isStreaming} />
                      )}
                    </div>
                  ) : message.isStreaming ? (
                    <div className="badge-status">
                      <div className="dot-active" />
                      <span className="text-caption">{searchState.message || 'Researching...'}</span>
                    </div>
                  ) : null}
                  
                  {message.role === 'assistant' && message.content && !message.isStreaming && !message.isError && (
                    <div className="flex px-1">
                      <button
                        onClick={() => handleCopy(message.content, message.id)}
                        className="link-muted p-1 rounded hover:bg-muted/50 transition-colors"
                      >
                        {copiedId === message.id ? (
                          <Check className="icon-xs text-emerald-500" />
                        ) : (
                          <Copy className="icon-xs" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border/50">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Follow-up question..."
              className="input-search"
              disabled={isSearching}
            />
            <button
              type="submit"
              disabled={isSearching || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-icon-primary"
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CornerRightUp className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Browser Panel */}
      {showBrowser && (
        <div className="h-[50%] lg:h-full lg:w-1/2 animate-slide-in-right">
          <SearchResultsDisplay
            query={currentQuery}
            results={searchResults}
            isActive={isSearching}
            currentUrl={currentScrapingUrl}
            screenshots={screenshots}
            onClose={() => setShowBrowser(false)}
          />
        </div>
      )}
    </div>
  );
}
