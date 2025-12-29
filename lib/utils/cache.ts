/**
 * Caching Utilities for Search Results
 * 
 * Provides in-memory caching with TTL support for search results
 * to reduce redundant API calls and improve response times.
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

export interface CacheOptions {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number;
  /** Maximum number of entries (default: 100) */
  maxSize?: number;
  /** Enable stale-while-revalidate (default: true) */
  staleWhileRevalidate?: boolean;
  /** Grace period for stale data in ms (default: 60000) */
  staleGracePeriod?: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

/**
 * Generic in-memory cache with TTL and LRU eviction
 */
export class Cache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;
  private readonly maxSize: number;
  private readonly staleWhileRevalidate: boolean;
  private readonly staleGracePeriod: number;
  
  private hits = 0;
  private misses = 0;

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl ?? 5 * 60 * 1000; // 5 minutes
    this.maxSize = options.maxSize ?? 100;
    this.staleWhileRevalidate = options.staleWhileRevalidate ?? true;
    this.staleGracePeriod = options.staleGracePeriod ?? 60 * 1000; // 1 minute
  }

  /**
   * Generate a cache key from query and options
   */
  static generateKey(query: string, options?: Record<string, unknown>): string {
    const normalizedQuery = query.toLowerCase().trim();
    const optionsStr = options ? JSON.stringify(options, Object.keys(options).sort()) : '';
    return `${normalizedQuery}:${optionsStr}`;
  }

  /**
   * Get a value from cache
   */
  get(key: string): { value: T; stale: boolean } | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    
    // Check if completely expired (beyond grace period)
    if (this.staleWhileRevalidate) {
      if (now > entry.expiresAt + this.staleGracePeriod) {
        this.cache.delete(key);
        this.misses++;
        return null;
      }
    } else if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update hit count and move to end (LRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.hits++;
    
    return {
      value: entry.value,
      stale: now > entry.expiresAt,
    };
  }

  /**
   * Set a value in cache
   */
  set(key: string, value: T, ttlOverride?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    const actualTtl = ttlOverride ?? this.ttl;

    this.cache.set(key, {
      value,
      timestamp: now,
      expiresAt: now + actualTtl,
      hits: 0,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      if (!this.staleWhileRevalidate || Date.now() > entry.expiresAt + this.staleGracePeriod) {
        this.cache.delete(key);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Evict the oldest entry (LRU)
   */
  private evictOldest(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      const maxAge = this.staleWhileRevalidate 
        ? entry.expiresAt + this.staleGracePeriod 
        : entry.expiresAt;
      
      if (now > maxAge) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Get-or-set pattern for cache
 */
export async function cacheGetOrSet<T>(
  cache: Cache<T>,
  key: string,
  fetcher: () => Promise<T>,
  options?: { 
    ttl?: number; 
    forceRefresh?: boolean;
    onStale?: (value: T) => void;
  }
): Promise<T> {
  // Check cache first (unless force refresh)
  if (!options?.forceRefresh) {
    const cached = cache.get(key);
    
    if (cached) {
      // If data is stale but within grace period, return stale and revalidate
      if (cached.stale && options?.onStale) {
        options.onStale(cached.value);
        // Revalidate in background
        fetcher().then(value => cache.set(key, value, options?.ttl)).catch(() => {});
      }
      return cached.value;
    }
  }

  // Fetch fresh data
  const value = await fetcher();
  cache.set(key, value, options?.ttl);
  return value;
}

/**
 * Deduplication cache to prevent concurrent identical requests
 */
export class RequestDeduplicator<T> {
  private pending = new Map<string, Promise<T>>();

  /**
   * Execute a request, deduplicating concurrent identical requests
   */
  async execute(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Check if there's already a pending request for this key
    const existing = this.pending.get(key);
    if (existing) {
      return existing;
    }

    // Create and store the promise
    const promise = fetcher().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Check if a request is currently pending
   */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }

  /**
   * Get the number of pending requests
   */
  get pendingCount(): number {
    return this.pending.size;
  }
}

// =============================================================================
// Search-specific caching
// =============================================================================

import { Source } from '../types';
import { SearchProvider } from '../providers/search-router';

export interface CachedSearchResult {
  sources: Source[];
  provider: SearchProvider;
  preAnswer?: string;
  timestamp: number;
}

// Global search cache instance
export const searchCache = new Cache<CachedSearchResult>({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 200,
  staleWhileRevalidate: true,
  staleGracePeriod: 2 * 60 * 1000, // 2 minutes grace
});

// Global request deduplicator
export const searchDeduplicator = new RequestDeduplicator<CachedSearchResult>();

/**
 * Create a cache key for search results
 */
export function createSearchCacheKey(
  query: string,
  provider: SearchProvider,
  options?: { maxResults?: number }
): string {
  return Cache.generateKey(query, { provider, ...options });
}

