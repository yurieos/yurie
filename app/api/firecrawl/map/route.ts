import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, search, limit = 100, apiKey } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const firecrawl = new FirecrawlClient(apiKey);
    const result = await firecrawl.mapUrl(url, {
      search,
      limit: Math.min(limit, 1000), // Cap at 1000 URLs
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Map API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to map website' 
      },
      { status: 500 }
    );
  }
}

