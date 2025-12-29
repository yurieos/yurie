'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Expand, X } from 'lucide-react';

interface ScreenshotPreviewProps {
  url: string;
  screenshot: string;
  isLoading?: boolean;
  className?: string;
}

export function ScreenshotPreview({ url, screenshot, isLoading = false, className }: ScreenshotPreviewProps) {
  const [showModal, setShowModal] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Preload image before showing
  useEffect(() => {
    if (screenshot && typeof window !== 'undefined') {
      const img = document.createElement('img');
      img.onload = () => {
        // Small delay to ensure smooth animation
        setTimeout(() => setImageLoaded(true), 100);
      };
      img.onerror = () => {
        // Failed to preload screenshot
        setImageLoaded(true);
      };
      img.src = screenshot;
    }
  }, [screenshot, url]);

  // Animate scan progress when loading
  useEffect(() => {
    if (isLoading && scanProgress < 100) {
      const timer = setTimeout(() => {
        setScanProgress(prev => Math.min(prev + 5, 100));
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isLoading, scanProgress]);

  // Reset scan progress when loading changes
  useEffect(() => {
    if (isLoading) {
      setScanProgress(0);
    }
  }, [isLoading]);

  // Safe URL hostname extraction
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = url;
  }

  return (
    <>
      <div 
        className={cn(
          "relative group cursor-pointer overflow-hidden rounded-lg border border-border bg-muted",
          "transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
          className
        )}
        onClick={() => setShowModal(true)}
      >
        {/* Screenshot thumbnail */}
        <div className="relative aspect-video">
          {screenshot && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={screenshot}
              alt={`Screenshot of ${url}`}
              className={cn(
                "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setImageLoaded(true)}
            />
          )}
          
          {/* Loading state with scanning animation */}
          {(!imageLoaded || !screenshot) && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Scanning overlay animation - only show after image is loaded */}
          {isLoading && imageLoaded && screenshot && (
            <>
              {/* Scan line effect */}
              <div 
                className="absolute left-0 right-0 h-1 bg-gradient-to-b from-transparent via-primary to-transparent opacity-80 animate-scan"
                style={{
                  top: `${scanProgress}%`,
                  boxShadow: '0 0 20px 5px color-mix(in srgb, var(--primary) 50%, transparent)'
                }}
              />
              
              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-20 animate-pulse" style={{
                backgroundImage: `
                  linear-gradient(to right, color-mix(in srgb, var(--primary) 20%, transparent) 1px, transparent 1px),
                  linear-gradient(to bottom, color-mix(in srgb, var(--primary) 20%, transparent) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }} />
              
              {/* Corner indicators */}
              <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-primary animate-pulse" />
              <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-primary animate-pulse" />
              <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-primary animate-pulse" />
              <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-primary animate-pulse" />
            </>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
            <Expand className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </div>

        {/* URL label */}
        <div className="p-2 bg-card border-t border-border">
          <p className="text-xs text-muted-foreground truncate">
            {hostname}
          </p>
        </div>
      </div>

      {/* Full-size modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">Screenshot of {url}</DialogTitle>
          
          {/* Modal header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex-1 mr-4">
              <p className="text-sm font-medium text-foreground truncate">
                {url}
              </p>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Modal body with full screenshot */}
          <div className="relative w-full h-full overflow-auto bg-muted">
            {screenshot && (
              <div className="relative min-h-[500px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot}
                  alt={`Screenshot of ${url}`}
                  className="w-full h-auto"
                />
                
                {/* Scanning animation in modal */}
                {isLoading && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Animated scan grid */}
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/10 animate-scan-vertical" />
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 animate-scan-horizontal" />
                    
                    {/* Analyzing text */}
                    <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-1 rounded-md text-sm font-mono">
                      <span className="animate-pulse">Analyzing page content...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
