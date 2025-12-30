/**
 * Centralized Logger Utility
 * 
 * Replaces scattered console.log/warn/error calls with a configurable logger.
 * In production, debug logs are suppressed for performance.
 * 
 * Usage:
 *   import { logger } from '@/lib/utils/logger';
 *   logger.debug('Debug info');     // Only in dev
 *   logger.info('Info message');    // Always
 *   logger.warn('Warning');         // Always
 *   logger.error('Error', error);   // Always
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix?: string;
  enabled?: boolean;
}

// Safely check environment - works in both Node.js and browser
function getNodeEnv(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).process?.env?.NODE_ENV || 'production';
  } catch {
    return 'production';
  }
}

// Check if we're in development mode
const isDev = getNodeEnv() !== 'production';

// Log level hierarchy for filtering
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level (debug in dev, info in prod)
const MIN_LOG_LEVEL: LogLevel = isDev ? 'debug' : 'info';

/**
 * Format a log message with optional prefix
 */
function formatMessage(prefix: string | undefined, ...args: unknown[]): unknown[] {
  if (prefix) {
    return [`[${prefix}]`, ...args];
  }
  return args;
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LOG_LEVEL];
}

/**
 * Create a logger instance with optional prefix
 */
export function createLogger(options: LoggerOptions = {}) {
  const { prefix, enabled = true } = options;

  return {
    debug: (...args: unknown[]) => {
      if (enabled && shouldLog('debug')) {
        console.log(...formatMessage(prefix, ...args));
      }
    },

    info: (...args: unknown[]) => {
      if (enabled && shouldLog('info')) {
        console.info(...formatMessage(prefix, ...args));
      }
    },

    warn: (...args: unknown[]) => {
      if (enabled && shouldLog('warn')) {
        console.warn(...formatMessage(prefix, ...args));
      }
    },

    error: (...args: unknown[]) => {
      if (enabled && shouldLog('error')) {
        console.error(...formatMessage(prefix, ...args));
      }
    },

    /**
     * Create a child logger with a new prefix
     */
    child: (childPrefix: string) => {
      const newPrefix = prefix ? `${prefix}:${childPrefix}` : childPrefix;
      return createLogger({ prefix: newPrefix, enabled });
    },
  };
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Pre-configured loggers for common modules
 */
export const loggers = {
  core: createLogger({ prefix: 'Core' }),
  search: createLogger({ prefix: 'Search' }),
  provider: createLogger({ prefix: 'Provider' }),
  firecrawl: createLogger({ prefix: 'Firecrawl' }),
  api: createLogger({ prefix: 'API' }),
  llm: createLogger({ prefix: 'LLM' }),
  context: createLogger({ prefix: 'Context' }),
  chat: createLogger({ prefix: 'Chat' }),
};

/**
 * Utility to suppress all logs (useful for testing)
 */
export const silentLogger = createLogger({ enabled: false });

export type Logger = ReturnType<typeof createLogger>;

