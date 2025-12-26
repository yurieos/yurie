import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, limit = 10, maxDepth = 2, allowBackwardLinks = false, apiKey } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const firecrawl = new FirecrawlClient(apiKey);
    const result = await firecrawl.crawl(url, {
      limit: Math.min(limit, 25), // Cap at 25 pages
      maxDepth: Math.min(maxDepth, 5), // Cap at depth 5
      allowBackwardLinks,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Crawl API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to crawl website' 
      },
      { status: 500 }
    );
  }
}

