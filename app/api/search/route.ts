import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';
import { LangGraphSearchEngine, SearchEvent } from '@/lib/langgraph-search-engine';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface SSESender {
  sendEvent: (event: SearchEvent) => void;
  sendError: (error: string) => void;
}

function createSSESender(controller: ReadableStreamDefaultController<Uint8Array>): SSESender {
  const encoder = new TextEncoder();
  
  return {
    sendEvent: (event: SearchEvent) => {
      try {
        const payload = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } catch (e) {
        console.error('[Search API] Failed to send event:', e);
      }
    },
    sendError: (error: string) => {
      try {
        const payload = JSON.stringify({ type: 'error', error, errorType: 'unknown' });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      } catch (e) {
        console.error('[Search API] Failed to send error:', e);
      }
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, context, apiKey } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Get API keys
    const firecrawlApiKey = apiKey || req.headers.get('X-Firecrawl-API-Key') || process.env.FIRECRAWL_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!firecrawlApiKey) {
      return NextResponse.json({ 
        error: 'FIRECRAWL_API_KEY is not configured. Add it to your .env.local file or provide it via the UI.' 
      }, { status: 500 });
    }

    if (!openaiApiKey) {
      return NextResponse.json({ 
        error: 'OPENAI_API_KEY is not configured. Add it to your .env.local file.' 
      }, { status: 500 });
    }

    // Create search engine
    const firecrawl = new FirecrawlClient(firecrawlApiKey);
    const searchEngine = new LangGraphSearchEngine(firecrawl);

    // Track if the stream has been closed
    let streamClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const sse = createSSESender(controller);

        try {
          console.log('[Search API] Starting search for:', query.substring(0, 50));

          await searchEngine.search(
            query,
            (event: SearchEvent) => {
              // Don't send events after stream is closed
              if (streamClosed) return;
              
              sse.sendEvent(event);

              // If this is the final result, close the stream
              if (event.type === 'final-result') {
                streamClosed = true;
                controller.close();
              }
            },
            context
          );

          // If we didn't get a final-result event, still close the stream
          if (!streamClosed) {
            console.log('[Search API] Search completed without final-result, closing stream');
            streamClosed = true;
            controller.close();
          }
        } catch (error) {
          console.error('[Search API] Search error:', error);
          if (!streamClosed) {
            sse.sendError(error instanceof Error ? error.message : 'Search failed');
            streamClosed = true;
            controller.close();
          }
        }
      },
      cancel() {
        console.log('[Search API] Stream cancelled by client');
        streamClosed = true;
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Search API] Request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

