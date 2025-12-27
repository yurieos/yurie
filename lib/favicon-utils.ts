// Favicon utilities - fetches real favicons from source websites
const failedDomains = new Set<string>();

// Light mode fallback icons (darker color for visibility on light backgrounds)
const GLOBE_FALLBACK_LIGHT = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'/%3E%3Cpath d='M2 12h20'/%3E%3C/svg%3E`;

const FILE_FALLBACK_LIGHT = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3Cline x1='16' y1='13' x2='8' y2='13'/%3E%3Cline x1='16' y1='17' x2='8' y2='17'/%3E%3Cline x1='10' y1='9' x2='8' y2='9'/%3E%3C/svg%3E`;

// Dark mode fallback icons (lighter color for visibility on dark backgrounds)
const GLOBE_FALLBACK_DARK = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a8a29e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'/%3E%3Cpath d='M2 12h20'/%3E%3C/svg%3E`;

const FILE_FALLBACK_DARK = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a8a29e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3Cline x1='16' y1='13' x2='8' y2='13'/%3E%3Cline x1='16' y1='17' x2='8' y2='17'/%3E%3Cline x1='10' y1='9' x2='8' y2='9'/%3E%3C/svg%3E`;

// Check if dark mode is active
function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

// Check if URL points to a document/PDF
function isDocumentUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith('.pdf') || 
           pathname.endsWith('.doc') || 
           pathname.endsWith('.docx') ||
           pathname.includes('/pdf/') ||
           pathname.includes('/document/') ||
           pathname.includes('/opinion/');  // Court documents like courtlistener
  } catch {
    return false;
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const domain = new URL(url).hostname;
    
    // If we've already seen this domain fail, return appropriate fallback
    if (failedDomains.has(domain)) {
      return getDefaultFavicon(url);
    }
    
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return getDefaultFavicon(url);
  }
}

export function getDefaultFavicon(url?: string): string {
  const dark = isDarkMode();
  if (url && isDocumentUrl(url)) {
    return dark ? FILE_FALLBACK_DARK : FILE_FALLBACK_LIGHT;
  }
  return dark ? GLOBE_FALLBACK_DARK : GLOBE_FALLBACK_LIGHT;
}

export function markFaviconFailed(url: string): void {
  try {
    const domain = new URL(url).hostname;
    failedDomains.add(domain);
  } catch {
    // Invalid URL, ignore
  }
}
