'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getFaviconUrl, getDefaultFavicon, markFaviconFailed } from '@/lib/favicon-utils';
import Image from 'next/image';

interface AnimatedThinkingLineProps {
  messages: string[];
}

export function AnimatedThinkingLine({ messages }: AnimatedThinkingLineProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (messages.length <= 1) return;
    
    // Detect if this is a "speed run" (many source names)
    const isSpeedRun = messages.some(msg => msg.includes('Analyzing') && messages.length > 5);
    const cycleDelay = isSpeedRun ? 600 : 2000;
    const fadeDelay = isSpeedRun ? 100 : 300;
    
    const cycleMessages = () => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (isSpeedRun && next >= messages.length - 1) {
            setIsComplete(true);
            return messages.length - 1;
          }
          return next % messages.length;
        });
        setIsVisible(true);
      }, fadeDelay);
    };
    
    if (!isComplete) {
      const interval = setInterval(cycleMessages, cycleDelay);
      return () => clearInterval(interval);
    }
  }, [messages, isComplete]);
  
  const currentMessage = messages[currentIndex];
  const analyzingMatch = currentMessage.match(/Analyzing (.+)\.\.\./);
  const currentUrl = analyzingMatch ? analyzingMatch[1] : null;
  
  return (
    <div className="flex items-start gap-3 text-foreground">
      <div className="icon-wrapper mt-0.5 overflow-hidden">
        {currentUrl ? (
          <Image 
            src={getFaviconUrl(currentUrl)} 
            alt=""
            width={20}
            height={20}
            className={`icon-md rounded transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = getDefaultFavicon(currentUrl);
              markFaviconFailed(currentUrl);
            }}
          />
        ) : (
          <Loader2 className="icon-xs animate-spin text-muted-foreground" />
        )}
      </div>
      <span 
        className={`text-sm transition-opacity ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
        style={{ transitionDuration: '150ms' }}
      >
        {currentMessage}
      </span>
    </div>
  );
}
