import { NextRequest, NextResponse } from 'next/server';
import Firecrawl from '@mendable/firecrawl-js';
import OpenAI from 'openai';
import { buildVisualResearchPrompt } from '@/lib/yurie-system-prompt';
import { 
  validationError, 
  requireApiKey, 
  getApiKey,
  getSSEHeaders 
} from '@/lib/api-utils';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Types
interface SearchResult {
  url: string;
  title: string;
  description: string;
  markdown?: string;
  screenshot?: string;
}

// Helper to create SSE sender specific to visual research
function createVisualSSESender(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder();
  
  const send = (payload: unknown) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };
  
  return {
    event: (type: string, data: Record<string, unknown>) => send({ type: 'event', event: { type, ...data } }),
    content: (chunk: string) => send({ type: 'content', chunk }),
    done: (content: string, sources: Array<{ url: string; title: string; summary: string }>) => 
      send({ type: 'done', content, sources }),
    error: (error: string) => send({ type: 'error', error }),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body?.query;

    if (!query || typeof query !== 'string') {
      return validationError('Query');
    }

    // Get API keys
    const firecrawlApiKey = getApiKey(body, 'X-Firecrawl-API-Key', req.headers, 'FIRECRAWL_API_KEY');
    const openaiApiKey = getApiKey(body, 'X-OpenAI-API-Key', req.headers, 'OPENAI_API_KEY');

    const firecrawlError = requireApiKey(firecrawlApiKey, 'FIRECRAWL_API_KEY');
    if (firecrawlError) return firecrawlError;

    const openaiError = requireApiKey(openaiApiKey, 'OPENAI_API_KEY');
    if (openaiError) return openaiError;

    const firecrawl = new Firecrawl({ apiKey: firecrawlApiKey });
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const stream = new ReadableStream({
      async start(controller) {
        const sse = createVisualSSESender(controller);

        try {
          // Step 1: Search with Firecrawl
          console.log('[Visual Research] Starting search for:', query);
          sse.event('searching', { query, message: 'Searching the web...' });

          let searchData;
          try {
            searchData = await firecrawl.search(query, {
              limit: 5,
              scrapeOptions: {
                formats: ['markdown', { type: 'screenshot', fullPage: true }]
              }
            });
          } catch (searchError) {
            throw new Error(`Search failed: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
          }

          type SearchResultItem = {
            url: string;
            title?: string;
            description?: string;
            markdown?: string;
            screenshot?: string;
            metadata?: { title?: string; description?: string };
          };

          const webResults = (searchData?.web || []) as SearchResultItem[];
          
          console.log('[Visual Research] Search result count:', webResults.length);

          if (webResults.length === 0) {
            throw new Error('No search results found for your query. Try different keywords.');
          }

          const results: SearchResult[] = webResults.map(item => ({
            url: item.url,
            title: item.title || item.metadata?.title || 'Untitled',
            description: item.description || item.metadata?.description || '',
            markdown: item.markdown,
            screenshot: item.screenshot,
          }));

          // Send visual search results
          sse.event('visual-search-results', {
            results: results.map(r => ({ url: r.url, title: r.title, description: r.description })),
            query
          });

          // Send found sources
          sse.event('found', {
            query,
            sources: results.map(r => ({
              url: r.url,
              title: r.title,
              summary: r.description,
              content: r.markdown || '',
            }))
          });

          // Step 2: Process each result with screenshots
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            
            sse.event('scraping', { url: result.url, index: i + 1, total: results.length });
            sse.event('visual-scraping', { url: result.url, index: i + 1, total: results.length });

            if (result.screenshot) {
              console.log('[Visual Research] Sending screenshot for:', result.url.substring(0, 50));
              sse.event('screenshot-captured', { url: result.url, screenshot: result.screenshot });
            }

            await new Promise(resolve => setTimeout(resolve, 400));

            sse.event('source-complete', {
              url: result.url,
              title: result.title,
              content: result.markdown || '',
              screenshot: result.screenshot
            });
          }

          // Step 3: Synthesize with OpenAI
          sse.event('analyzing', { message: 'Synthesizing research findings...' });
          console.log('[Visual Research] Starting OpenAI synthesis with', results.length, 'sources');

          const contextContent = results
            .map((r, i) => {
              const content = r.markdown?.substring(0, 4000) || r.description;
              return `[Source ${i + 1}] ${r.title}\nURL: ${r.url}\n\n${content}`;
            })
            .join('\n\n---\n\n');

          const now = new Date();
          const dateStr = now.toLocaleDateString('en-US', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
          });
          const currentDateContext = `Today's date is ${dateStr}. Current year: ${now.getFullYear()}.`;

          const systemPrompt = `${buildVisualResearchPrompt(currentDateContext)}

---

The following sources are available (use [1], [2], etc. for inline citations, but do NOT list them at the end - the UI displays sources separately):

${contextContent}`;

          let completion;
          try {
            completion = await openai.chat.completions.create({
              model: 'gpt-5-mini-2025-08-07',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
              ],
              stream: true,
            });
          } catch (openaiError) {
            throw new Error(`AI synthesis failed: ${openaiError instanceof Error ? openaiError.message : 'Unknown error'}`);
          }

          let fullContent = '';
          console.log('[Visual Research] Streaming OpenAI response...');
          
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullContent += content;
              sse.content(content);
            }
          }
          
          console.log('[Visual Research] Completed. Response length:', fullContent.length);

          sse.done(fullContent, results.map(r => ({
            url: r.url,
            title: r.title,
            summary: r.description,
          })));

          controller.close();
        } catch (error) {
          console.error('[Visual Research] Error:', error);
          sse.error(error instanceof Error ? error.message : 'An unexpected error occurred');
          controller.close();
        }
      }
    });

    return new NextResponse(stream, { headers: getSSEHeaders() });
  } catch (error) {
    console.error('[Visual Research] Request error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
