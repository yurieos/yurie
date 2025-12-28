'use client';

import Image from 'next/image';
import { getFaviconUrl, getDefaultFavicon, markFaviconFailed } from '@/lib/favicon-utils';

type StackSize = 'sm' | 'md';

interface FaviconStackProps {
  urls: string[];
  max?: number;
  size?: StackSize;
  className?: string;
}

const sizeConfig: Record<StackSize, { class: string; pixels: number; overflowClass: string }> = {
  sm: { 
    class: 'w-3.5 h-3.5', 
    pixels: 14, 
    overflowClass: 'w-3.5 h-3.5 text-[6px]' 
  },
  md: { 
    class: 'w-[18px] h-[18px]', 
    pixels: 18, 
    overflowClass: 'w-[18px] h-[18px] text-[7px]' 
  },
};

export function FaviconStack({ urls, max = 5, size = 'md', className }: FaviconStackProps) {
  // Deduplicate by domain
  const uniqueDomains = new Map<string, string>();
  urls.forEach(url => {
    try {
      const domain = new URL(url).hostname;
      if (!uniqueDomains.has(domain)) {
        uniqueDomains.set(domain, url);
      }
    } catch {
      // Skip invalid URLs
    }
  });

  const displayUrls = Array.from(uniqueDomains.values()).slice(0, max);
  const overflowCount = urls.length - displayUrls.length;
  const config = sizeConfig[size];

  if (displayUrls.length === 0) {
    return null;
  }

  return (
    <div className={`favicon-stack ${className || ''}`}>
      {displayUrls.map((url, i) => (
        <div
          key={url}
          className="relative animate-scale-in"
          style={{ animationDelay: `${i * 60}ms`, zIndex: max - i }}
        >
          <Image
            src={getFaviconUrl(url)}
            alt=""
            width={config.pixels}
            height={config.pixels}
            className={`${config.class} favicon-item`}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.src = getDefaultFavicon(url);
              markFaviconFailed(url);
            }}
          />
        </div>
      ))}
      {overflowCount > 0 && (
        <div
          className={`${config.overflowClass} favicon-overflow animate-scale-in`}
          style={{ animationDelay: `${displayUrls.length * 60}ms`, zIndex: 0 }}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  );
}

// Simple inline favicon for use in text/list contexts
interface InlineFaviconProps {
  url: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const inlineSizeConfig: Record<'xs' | 'sm' | 'md', { class: string; pixels: number }> = {
  xs: { class: 'w-3 h-3', pixels: 12 },
  sm: { class: 'w-4 h-4', pixels: 16 },
  md: { class: 'w-5 h-5', pixels: 20 },
};

export function InlineFavicon({ url, size = 'sm', className }: InlineFaviconProps) {
  const config = inlineSizeConfig[size];
  
  return (
    <Image
      src={getFaviconUrl(url)}
      alt=""
      width={config.pixels}
      height={config.pixels}
      className={`${config.class} rounded flex-shrink-0 ${className || ''}`}
      onError={(e) => {
        const img = e.target as HTMLImageElement;
        img.src = getDefaultFavicon(url);
        markFaviconFailed(url);
      }}
    />
  );
}

