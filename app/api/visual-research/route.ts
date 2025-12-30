import { NextRequest, NextResponse } from 'next/server';
import Firecrawl from '@mendable/firecrawl-js';
import OpenAI from 'openai';
import { buildVisualResearchPrompt } from '@/lib/yurie-system-prompt';

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

interface SSEController {
  enqueue: (data: string) => void;
  close: () => void;
}

// Helper to create SSE sender
function createSSESender(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder();
  
  return {
    sendEvent: (type: string, data: Record<string, unknown>) => {
      const payload = JSON.stringify({ type: 'event', event: { type, ...data } });
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
    },
    sendContent: (chunk: string) => {
      const payload = JSON.stringify({ type: 'content', chunk });
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
    },
    sendDone: (content: string, sources: Array<{ url: string; title: string; summary: string }>) => {
      const payload = JSON.stringify({ type: 'done', content, sources });
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
    },
    sendError: (error: string) => {
      const payload = JSON.stringify({ type: 'error', error });
      controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = body?.query;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Get API keys
    const firecrawlApiKey = req.headers.get('X-Firecrawl-API-Key') || process.env.FIRECRAWL_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!firecrawlApiKey) {
      return NextResponse.json({ 
        error: 'FIRECRAWL_API_KEY is not configured. Add it to your .env.local file.' 
      }, { status: 500 });
    }

    if (!openaiApiKey) {
      return NextResponse.json({ 
        error: 'OPENAI_API_KEY is not configured. Add it to your .env.local file.' 
      }, { status: 500 });
    }

    const firecrawl = new Firecrawl({ apiKey: firecrawlApiKey });
    const openai = new OpenAI({ apiKey: openaiApiKey });

    const stream = new ReadableStream({
      async start(controller) {
        const sse = createSSESender(controller);

        try {
          // ============================================
          // Step 1: Search with Firecrawl
          // ============================================
          console.log('[Visual Research] Starting search for:', query);
          sse.sendEvent('searching', { query, message: 'Searching the web...' });

          let searchData;
          try {
            // Firecrawl v4 search API - returns SearchData with web/news/images arrays
            searchData = await firecrawl.search(query, {
              limit: 5,
              scrapeOptions: {
                formats: ['markdown', { type: 'screenshot', fullPage: true }]
              }
            });
          } catch (searchError) {
            console.error('[Visual Research] Firecrawl search error:', searchError);
            throw new Error(`Search failed: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
          }

          // Firecrawl v4 returns SearchData with web/news/images arrays
          // Each item is a Document with url, title, markdown, screenshot, etc.
          type SearchResultItem = {
            url: string;
            title?: string;
            description?: string;
            markdown?: string;
            screenshot?: string;
            metadata?: { title?: string; description?: string };
          };

          // Get web results (primary source for research)
          const webResults = (searchData?.web || []) as SearchResultItem[];
          
          console.log('[Visual Research] Search result count:', webResults.length);

          if (webResults.length === 0) {
            throw new Error('No search results found for your query. Try different keywords.');
          }

          // Transform results
          const results: SearchResult[] = webResults.map(item => ({
            url: item.url,
            title: item.title || item.metadata?.title || 'Untitled',
            description: item.description || item.metadata?.description || '',
            markdown: item.markdown,
            screenshot: item.screenshot,
          }));

          // Send visual search results for the browser display
          sse.sendEvent('visual-search-results', {
            results: results.map(r => ({
              url: r.url,
              title: r.title,
              description: r.description,
            })),
            query
          });

          // Send found sources for the chat
          sse.sendEvent('found', {
            query,
            sources: results.map(r => ({
              url: r.url,
              title: r.title,
              summary: r.description,
              content: r.markdown || '',
            }))
          });

          // ============================================
          // Step 2: Process each result with screenshots
          // ============================================
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            
            // Emit scraping events
            sse.sendEvent('scraping', {
              url: result.url,
              index: i + 1,
              total: results.length
            });

            sse.sendEvent('visual-scraping', {
              url: result.url,
              index: i + 1,
              total: results.length
            });

            // If we have a screenshot, emit it
            if (result.screenshot) {
              console.log('[Visual Research] Sending screenshot for:', result.url.substring(0, 50));
              sse.sendEvent('screenshot-captured', {
                url: result.url,
                screenshot: result.screenshot
              });
            }

            // Small delay to make the visual feedback visible
            await new Promise(resolve => setTimeout(resolve, 400));

            // Emit source complete
            sse.sendEvent('source-complete', {
              url: result.url,
              title: result.title,
              content: result.markdown || '',
              screenshot: result.screenshot
            });
          }

          // ============================================
          // Step 3: Synthesize with OpenAI
          // ============================================
          sse.sendEvent('analyzing', { message: 'Synthesizing research findings...' });
          console.log('[Visual Research] Starting OpenAI synthesis with', results.length, 'sources');

          const contextContent = results
            .map((r, i) => {
              const content = r.markdown?.substring(0, 4000) || r.description;
              return `[Source ${i + 1}] ${r.title}\nURL: ${r.url}\n\n${content}`;
            })
            .join('\n\n---\n\n');

          // Get current date for the unified Yurie prompt
          const now = new Date();
          const dateStr = now.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          const currentDateContext = `Today's date is ${dateStr}. Current year: ${now.getFullYear()}.`;

          // Use the unified Yurie prompt (human-like researcher personality)
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
            console.error('[Visual Research] OpenAI error:', openaiError);
            throw new Error(`AI synthesis failed: ${openaiError instanceof Error ? openaiError.message : 'Unknown error'}`);
          }

          let fullContent = '';
          console.log('[Visual Research] Streaming OpenAI response...');
          
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullContent += content;
              sse.sendContent(content);
            }
          }
          
          console.log('[Visual Research] Completed. Response length:', fullContent.length);

          // Send final done event
          sse.sendDone(fullContent, results.map(r => ({
            url: r.url,
            title: r.title,
            summary: r.description,
          })));

          controller.close();
        } catch (error) {
          console.error('[Visual Research] Error:', error);
          const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
          sse.sendError(errorMessage);
          controller.close();
        }
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
    console.error('[Visual Research] Request error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
