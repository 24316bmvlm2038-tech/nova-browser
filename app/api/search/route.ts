import { NextResponse } from 'next/server';
import { webSearch } from '@/lib/search/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 15_000;

/**
 * General web search. Runs server side so the upstream provider sees a normal
 * server request (no CORS) and any API key stays out of the browser bundle.
 */
export async function POST(request: Request) {
  let query: string;
  let limit: number | undefined;

  try {
    const body = await request.json();
    query = typeof body.query === 'string' ? body.query.trim() : '';
    limit = typeof body.limit === 'number' ? body.limit : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!query) {
    return NextResponse.json({ error: 'A "query" string is required' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const { provider, results } = await webSearch(query, {
      limit: Math.min(limit ?? 10, 25),
      signal: controller.signal,
    });
    return NextResponse.json({ query, provider, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Search failed';
    const aborted = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      { error: aborted ? 'Search timed out' : message },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
