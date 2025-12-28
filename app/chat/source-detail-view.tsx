'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Source } from '@/lib/langgraph-search-engine';
import { getFaviconUrl, getDefaultFavicon, markFaviconFailed } from '@/lib/favicon-utils';
import { getHostname, getReadingTime, getWordCount } from '@/lib/url-utils';
import { IconBadge } from '@/components/ui/icon-badge';
import { MarkdownRenderer } from '../markdown-renderer';
import { toast } from 'sonner';
import { 
  ChevronLeft, 
  ExternalLink, 
  FileText, 
  Clock, 
  Copy, 
  Check 
} from 'lucide-react';

interface SourceDetailViewProps {
  source: Source;
  index: number;
  onBack: () => void;
}

export function SourceDetailView({ 
  source, 
  index, 
  onBack 
}: SourceDetailViewProps) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    if (source.content) {
      await navigator.clipboard.writeText(source.content);
      setCopied(true);
      toast.success('Content copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-gradient-to-b from-card to-card/95">
        <div className="p-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 group cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to sources</span>
          </button>
          
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <IconBadge>
                <Image 
                  src={getFaviconUrl(source.url)} 
                  alt=""
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = getDefaultFavicon(source.url);
                    markFaviconFailed(source.url);
                  }}
                />
              </IconBadge>
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {index + 1}
              </span>
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-base leading-tight line-clamp-2">
                {source.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {getHostname(source.url)}
              </p>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-4">
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Visit page</span>
            </a>
            {source.content && (
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-xl transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Stats bar */}
        {source.content && (
          <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/40 border-t border-border/50">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{getReadingTime(source.content)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              <span>{getWordCount(source.content)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{source.content.length.toLocaleString()} chars</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {source.content ? (
          <div className="p-5">
            <div className="prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-strong:text-foreground prose-a:text-primary">
              <MarkdownRenderer content={source.content} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">No content available</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Visit the page directly to view its contents
            </p>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in new tab</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

