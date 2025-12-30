/**
 * Shared API Route Utilities
 * 
 * Common utilities for API routes to reduce code duplication:
 * - SSE (Server-Sent Events) sender
 * - Error handling
 * - Request validation
 * - Response formatting
 */

import { NextResponse } from 'next/server';
import { loggers } from './utils/logger';

const log = loggers.api;

// =============================================================================
// Types
// =============================================================================

export interface SSESender<T = unknown> {
  send: (data: T) => void;
  error: (message: string, errorType?: string) => void;
  close: () => void;
}

export interface ApiErrorOptions {
  status?: number;
  success?: boolean;
  context?: string;
}

// =============================================================================
// SSE (Server-Sent Events) Utilities
// =============================================================================

/**
 * Create an SSE sender for streaming responses
 */
export function createSSESender<T = unknown>(
  controller: ReadableStreamDefaultController<Uint8Array>
): SSESender<T> {
  const encoder = new TextEncoder();
  let closed = false;

  return {
    send: (data: T) => {
      if (closed) return;
      try {
        const payload = JSON.stringify(data);
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } catch (e) {
        log.debug('[SSE] Failed to send data:', e);
      }
    },

    error: (message: string, errorType = 'unknown') => {
      if (closed) return;
      try {
        const payload = JSON.stringify({ type: 'error', error: message, errorType });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } catch (e) {
        log.debug('[SSE] Failed to send error:', e);
      }
    },

    close: () => {
      if (closed) return;
      closed = true;
      try {
        controller.close();
      } catch (e) {
        // Controller might already be closed
        log.debug('[SSE] Failed to close controller:', e);
      }
    },
  };
}

/**
 * Create SSE response headers
 */
export function getSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Handle API errors consistently
 */
export function handleApiError(
  error: unknown,
  context: string,
  options: ApiErrorOptions = {}
): NextResponse {
  const { status = 500, success = false } = options;
  
  log.debug(`[${context}] Error:`, error);
  
  const message = error instanceof Error ? error.message : `Failed: ${context}`;
  
  return NextResponse.json(
    { success, error: message },
    { status }
  );
}

/**
 * Create a validation error response
 */
export function validationError(
  field: string,
  message?: string
): NextResponse {
  return NextResponse.json(
    { error: message || `${field} is required` },
    { status: 400 }
  );
}

/**
 * Create an unauthorized error response
 */
export function unauthorizedError(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Create a not found error response
 */
export function notFoundError(resource: string): NextResponse {
  return NextResponse.json(
    { error: `${resource} not found` },
    { status: 404 }
  );
}

// =============================================================================
// Request Validation
// =============================================================================

/**
 * Validate that required fields are present in the request body
 */
export function validateRequired<T extends Record<string, unknown>>(
  body: T,
  requiredFields: (keyof T)[]
): NextResponse | null {
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return validationError(String(field));
    }
  }
  return null;
}

/**
 * Get API key from request (supports multiple sources)
 */
export function getApiKey(
  body: Record<string, unknown>,
  headerKey: string,
  headers: Headers,
  envKey: string
): string | undefined {
  return (
    (body.apiKey as string) ||
    (headerKey ? headers.get(headerKey) : null) ||
    process.env[envKey] ||
    undefined
  );
}

/**
 * Validate API key is present
 */
export function requireApiKey(
  apiKey: string | undefined,
  keyName: string
): NextResponse | null {
  if (!apiKey) {
    return NextResponse.json(
      { error: `${keyName} is not configured. Add it to your .env.local file or provide it via the UI.` },
      { status: 500 }
    );
  }
  return null;
}

// =============================================================================
// Response Formatting
// =============================================================================

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

/**
 * Apply a limit cap to a numeric value
 */
export function capLimit(value: number, maxValue: number, defaultValue?: number): number {
  const v = value || defaultValue || maxValue;
  return Math.min(v, maxValue);
}

