/**
 * Search Engine Helper Functions
 * 
 * Utility functions used across the search engine workflow.
 */

import { SEARCH_CONFIG } from '../config';
import { Source, SearchStep, SearchEvent } from '../types';
import { ResponsesAPIClient, ResponseMessage } from '../openai-responses';

// =============================================================================
// URL Extraction
// =============================================================================

/**
 * Extract URLs from a query string
 */
export function extractUrlsFromQuery(query: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  const matches = query.match(urlRegex) || [];
  // Clean up URLs (remove trailing punctuation)
  return matches.map(url => url.replace(/[.,;:!?]+$/, ''));
}

/**
 * Determine if query is asking for crawl/map operations
 */
export function isCrawlOrMapQuery(query: string): boolean {
  const q = query.toLowerCase();
  return (
    q.includes('crawl') || 
    q.includes('all pages') || 
    q.includes('entire site') || 
    q.includes('full site') ||
    q.includes('map') ||
    q.includes('structure') ||
    q.includes('sitemap') ||
    q.includes('list all urls') ||
    q.includes('discover pages')
  );
}

// =============================================================================
// Content Scoring
// =============================================================================

/**
 * Score content based on query term matching
 */
export function scoreContent(content: string, query: string): number {
  const queryWords = query.toLowerCase().split(' ');
  const contentLower = content.toLowerCase();
  
  let score = 0;
  for (const word of queryWords) {
    if (contentLower.includes(word)) score += 0.2;
  }
  
  return Math.min(score, 1);
}

// =============================================================================
// Content Summarization
// =============================================================================

/**
 * Generate a summary of content relevant to a query
 */
export async function summarizeContent(
  llm: ResponsesAPIClient,
  content: string, 
  query: string,
  currentDateContext: string
): Promise<string> {
  try {
    const messages: ResponseMessage[] = [
      { role: 'system', content: `${currentDateContext}

You're Yurie. Extract ONE key finding from this content that's SPECIFICALLY relevant to the search query.

CRITICAL: Only summarize information that directly relates to the search query.
- If searching for "Samsung phones", only mention Samsung phone information
- If searching for "Firecrawl founders", only mention founder information
- If no relevant information is found, just return the most relevant fact from the page

Instructions:
- Return just ONE sentence with a specific finding
- Include numbers, dates, or specific details when available
- Keep it under ${SEARCH_CONFIG.SUMMARY_CHAR_LIMIT} characters
- Don't say "No relevant information was found" - find something relevant to the current search` },
      { role: 'user', content: `Query: "${query}"\n\nContent: ${content.slice(0, 2000)}` }
    ];
    
    const response = await llm.generateWithMessages(messages);
    return response.text.trim();
  } catch {
    return '';
  }
}

// =============================================================================
// Initial Steps
// =============================================================================

/**
 * Get initial search steps for the UI
 */
export function getInitialSteps(): SearchStep[] {
  return [
    { id: 'understanding', label: 'Understanding request', status: 'pending' },
    { id: 'planning', label: 'Planning search', status: 'pending' },
    { id: 'searching', label: 'Searching sources', status: 'pending' },
    { id: 'analyzing', label: 'Analyzing content', status: 'pending' },
    { id: 'synthesizing', label: 'Synthesizing answer', status: 'pending' },
    { id: 'complete', label: 'Complete', status: 'pending' }
  ];
}

// =============================================================================
// Date Context
// =============================================================================

/**
 * Get current date context for prompts
 */
export function getCurrentDateContext(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  return `Today's date is ${dateStr}. Current year: ${now.getFullYear()}.`;
}

// =============================================================================
// Graph Config Type
// =============================================================================

/**
 * Configuration type for LangGraph nodes
 */
export interface GraphConfig {
  configurable?: {
    eventCallback?: (event: SearchEvent) => void;
    checkpointId?: string;
  };
}

