import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';
import { handleApiError, validationError, capLimit } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, limit = 10, maxDepth = 2, allowBackwardLinks = false, apiKey } = body;

    if (!url) {
      return validationError('URL');
    }

    const firecrawl = new FirecrawlClient(apiKey);
    const result = await firecrawl.crawl(url, {
      limit: capLimit(limit, 25),
      maxDepth: capLimit(maxDepth, 5),
      allowBackwardLinks,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'Crawl API');
  }
}
