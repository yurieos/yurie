import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';
import { LangGraphSearchEngine, SearchEvent } from '@/lib/langgraph-search-engine';
import { 
  createSSESender, 
  getSSEHeaders, 
  validationError, 
  requireApiKey, 
  getApiKey 
} from '@/lib/api-utils';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, context } = body;

    if (!query || typeof query !== 'string') {
      return validationError('Query');
    }

    // Get API keys
    const firecrawlApiKey = getApiKey(body, 'X-Firecrawl-API-Key', req.headers, 'FIRECRAWL_API_KEY');
    const openaiApiKey = process.env.OPENAI_API_KEY;

    const firecrawlError = requireApiKey(firecrawlApiKey, 'FIRECRAWL_API_KEY');
    if (firecrawlError) return firecrawlError;

    const openaiError = requireApiKey(openaiApiKey, 'OPENAI_API_KEY');
    if (openaiError) return openaiError;

    // Create search engine
    const firecrawl = new FirecrawlClient(firecrawlApiKey);
    const searchEngine = new LangGraphSearchEngine(firecrawl);

    // Track if the stream has been closed
    let streamClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const sse = createSSESender<SearchEvent>(controller);

        try {
          console.log('[Search API] Starting search for:', query.substring(0, 50));

          await searchEngine.search(
            query,
            (event: SearchEvent) => {
              if (streamClosed) return;
              
              sse.send(event);

              if (event.type === 'final-result') {
                streamClosed = true;
                sse.close();
              }
            },
            context
          );

          if (!streamClosed) {
            console.log('[Search API] Search completed without final-result, closing stream');
            streamClosed = true;
            sse.close();
          }
        } catch (error) {
          console.error('[Search API] Search error:', error);
          if (!streamClosed) {
            sse.error(error instanceof Error ? error.message : 'Search failed');
            streamClosed = true;
            sse.close();
          }
        }
      },
      cancel() {
        console.log('[Search API] Stream cancelled by client');
        streamClosed = true;
      }
    });

    return new NextResponse(stream, { headers: getSSEHeaders() });
  } catch (error) {
    console.error('[Search API] Request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
