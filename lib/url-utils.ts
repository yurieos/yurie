/**
 * Shared URL and text utility functions
 * Consolidated from chat.tsx and search-display.tsx
 */

/**
 * Safely extract hostname from a URL string
 * Handles malformed URLs gracefully
 */
export function getHostname(url: string): string {
  if (!url) return 'Unknown source';
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`;
    return new URL(urlWithProtocol).hostname;
  } catch {
    // Try to extract domain-like pattern
    const domainMatch = url.match(/(?:https?:\/\/)?([^\/\s]+)/);
    if (domainMatch && domainMatch[1]) {
      return domainMatch[1];
    }
    return url.length > 30 ? url.slice(0, 30) + '...' : url || 'Unknown source';
  }
}

/**
 * Estimate reading time for content
 * @param content - Text content to analyze
 * @returns Formatted reading time string (e.g., "3 min read")
 */
export function getReadingTime(content: string): string {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return minutes === 1 ? '1 min read' : `${minutes} min read`;
}

/**
 * Get formatted word count for content
 * @param content - Text content to analyze
 * @returns Formatted word count string (e.g., "1,234 words")
 */
export function getWordCount(content: string): string {
  const words = content.trim().split(/\s+/).length;
  return words.toLocaleString() + ' words';
}

