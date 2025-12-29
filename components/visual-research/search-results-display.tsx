'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Globe, Search, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VisualSearchResult } from '@/lib/types';
import { getFaviconUrl, getDefaultFavicon, markFaviconFailed } from '@/lib/favicon-utils';

interface SearchResultsDisplayProps {
  query: string;
  results: VisualSearchResult[];
  isActive: boolean;
  currentUrl?: string;
  screenshots?: Array<{ url: string; screenshot?: string }>;
  onClose?: () => void;
}

export function SearchResultsDisplay({ 
  query = '', 
  results = [], 
  isActive = false,
  currentUrl = '',
  screenshots = [],
  onClose
}: SearchResultsDisplayProps) {
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const [activeResultIndex, setActiveResultIndex] = useState(-1);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const screenshotRef = useRef<HTMLImageElement>(null);

  // Show screenshot when scraping
  useEffect(() => {
    if (isActive && currentUrl && screenshots.length > 0) {
      const screenshot = screenshots.find(s => s.url === currentUrl) || screenshots[screenshots.length - 1];
      if (screenshot?.screenshot) {
        setIsImageLoaded(false);
        setCurrentScreenshot(screenshot.screenshot);
        setShowScreenshot(true);
      }
    } else if (!isActive) {
      setShowScreenshot(false);
      setCurrentScreenshot(null);
    }
  }, [currentUrl, screenshots, isActive]);

  // Highlight active result
  useEffect(() => {
    if (currentUrl && results.length > 0) {
      setActiveResultIndex(results.findIndex(r => r.url === currentUrl));
    } else {
      setActiveResultIndex(-1);
    }
  }, [currentUrl, results]);

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  return (
    <div className="h-full flex flex-col card-surface overflow-hidden">
      {/* Browser Header */}
      <div className="panel-header px-3 py-2 flex items-center gap-2 bg-muted/30">
        <div className="flex items-center gap-1.5 flex-shrink-0 h-2.5">
          <button 
            onClick={onClose}
            className="size-2.5 rounded-full bg-red-400 hover:bg-red-500 transition-colors cursor-pointer border-none p-0 flex"
            aria-label="Close"
          />
          <div className="size-2.5 rounded-full bg-yellow-400" />
          <div className="size-2.5 rounded-full bg-green-400" />
        </div>
        
        <div className="flex-1 flex items-center gap-2 bg-card rounded-md px-3 py-1.5 min-w-0 border border-border/50">
          {currentUrl && isActive ? (
            <>
              <Image 
                src={getFaviconUrl(currentUrl)} 
                alt=""
                width={14}
                height={14}
                className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  img.src = getDefaultFavicon(currentUrl);
                  markFaviconFailed(currentUrl);
                }}
              />
              <span className="text-sm font-mono truncate">{currentUrl}</span>
              <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                <div className="dot-active" />
                <span className="text-xs text-primary font-medium">Analyzing</span>
              </div>
            </>
          ) : query ? (
            <>
              <Search className="icon-xs text-muted-foreground flex-shrink-0" />
              <span className="text-sm truncate">{query}</span>
              {isActive && (
                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                  <div className="dot-active" />
                  <span className="text-xs text-primary font-medium">Searching</span>
                </div>
              )}
            </>
          ) : (
            <>
              <Globe className="icon-xs text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ready to search</span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {showScreenshot && currentScreenshot ? (
          <div className="absolute inset-0 bg-card">
            {/* Loading spinner */}
            {!isImageLoaded && (
              <div className="absolute inset-0 flex-center bg-card z-10">
                <div className="text-center">
                  <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-caption">Loading page...</p>
                </div>
              </div>
            )}
            
            {/* Screenshot */}
            <div className={cn(
              "h-full overflow-hidden transition-opacity duration-300",
              isImageLoaded ? "opacity-100" : "opacity-0"
            )}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                ref={screenshotRef}
                src={currentScreenshot} 
                alt="Page screenshot" 
                className="w-full h-full object-cover object-top"
                onLoad={() => setIsImageLoaded(true)}
              />
              
              {/* Scanner overlay */}
              {isImageLoaded && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="scanner-line" />
                </div>
              )}
            </div>

            {/* Status badge */}
            {isImageLoaded && (
              <div className="absolute bottom-4 right-4 badge-status border-primary/30 bg-card/90 backdrop-blur-sm animate-fade-up">
                <div className="dot-active" />
                <span className="text-caption text-primary font-medium">Scanning content</span>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {/* Results List */}
            <div className="py-4 px-1 space-y-4">
              {results.length > 0 ? (
                <>
                  <p className="text-caption px-3">{results.length} sources found</p>
                  
                  {results.map((result, index) => (
                    <div 
                      key={index} 
                      className={cn(
                        "p-3 rounded-xl transition-all",
                        activeResultIndex === index 
                          ? "bg-primary/5 border-2 border-dashed border-primary/40 animate-pulse" 
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Image 
                          src={getFaviconUrl(result.url)} 
                          alt=""
                          width={16}
                          height={16}
                          className="w-4 h-4 rounded-sm flex-shrink-0"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = getDefaultFavicon(result.url);
                            markFaviconFailed(result.url);
                          }}
                        />
                        <span className="text-caption">{getHostname(result.url)}</span>
                        {activeResultIndex === index && (
                          <span className="text-caption text-primary font-medium">• Analyzing</span>
                        )}
                      </div>
                      
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-primary hover:underline line-clamp-1"
                      >
                        {result.title}
                      </a>
                      
                      {result.description && (
                        <p className="text-caption mt-1 line-clamp-2">
                          {result.description}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              ) : query && !isActive ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-foreground mb-2">
                    No results for &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-caption">Try different keywords</p>
                </div>
              ) : !query ? (
                <div className="py-12 flex-center flex-col text-center">
                  <Globe className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-caption">Enter a query to search</p>
                </div>
              ) : (
                <div className="py-12 flex-center flex-col">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-caption">Searching...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
