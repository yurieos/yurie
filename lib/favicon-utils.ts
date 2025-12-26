// Favicon utilities - fetches real favicons from source websites
const failedDomains = new Set<string>();

// Fallback globe icon for when favicon fails to load
const GLOBE_FALLBACK = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🦕%3C/text%3E%3C/svg%3E`;

export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    
    // If we've already seen this domain fail, return fallback immediately
    if (failedDomains.has(domain)) {
      return getDefaultFavicon();
    }
    
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return getDefaultFavicon();
  }
}

export function getDefaultFavicon(): string {
  return GLOBE_FALLBACK;
}

export function markFaviconFailed(url: string): void {
  try {
    const domain = new URL(url).hostname;
    failedDomains.add(domain);
  } catch {
    // Invalid URL, ignore
  }
}
