import { NextRequest, NextResponse } from 'next/server';
import { FirecrawlClient } from '@/lib/firecrawl';
import { handleApiError, validationError, capLimit } from '@/lib/api-utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, search, limit = 100, apiKey } = body;

    if (!url) {
      return validationError('URL');
    }

    const firecrawl = new FirecrawlClient(apiKey);
    const result = await firecrawl.mapUrl(url, {
      search,
      limit: capLimit(limit, 1000),
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'Map API');
  }
}
