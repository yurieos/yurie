import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, limit = 10, scrapeOptions, apiKey } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const firecrawl = new FirecrawlClient(apiKey);
    const result = await firecrawl.search(query, {
      limit: Math.min(limit, 20), // Cap at 20 results
      scrapeOptions: scrapeOptions ?? {
        formats: ['markdown'],
      },
    });

    return NextResponse.json({
      success: true,
      query,
      results: result.data,
      total: result.data.length,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error('Firecrawl Search API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to search' 
      },
      { status: 500 }
    );
  }
}

