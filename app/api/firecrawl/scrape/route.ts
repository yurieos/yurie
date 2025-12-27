import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, onlyMainContent = true, includeLinks = false, apiKey } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const firecrawl = new FirecrawlClient(apiKey);
    const result = await firecrawl.scrapeForLLM(url, {
      onlyMainContent,
      includeLinks,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scrape API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to scrape URL' 
      },
      { status: 500 }
    );
  }
}


