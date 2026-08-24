import { NextResponse } from 'next/server';
import { ALL_SOURCES, gather } from '@/lib/live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 20_000;

/** Which sources exist and which are usable right now. */
export async function GET() {
  return NextResponse.json({
    sources: ALL_SOURCES.map((source) => ({
      id: source.id,
      label: source.label,
      kind: source.kind,
      available: source.isConfigured(),
      canSearch: typeof source.search === 'function',
    })),
  });
}

/** Trending across sources, or a cross-source search when `query` is given. */
export async function POST(request: Request) {
  let query: string | undefined;
  let sources: string[] | undefined;
  let limit: number;

  try {
    const body = await request.json().catch(() => ({}));
    query = typeof body.query === 'string' && body.query.trim() ? body.query.trim() : undefined;
    sources = Array.isArray(body.sources) ? body.sources.filter((s: unknown) => typeof s === 'string') : undefined;
    limit = typeof body.limit === 'number' ? Math.min(Math.max(body.limit, 1), 40) : 18;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const digest = await gather({ query, sources, limit, signal: controller.signal });

    // Every source failing is an error; some failing is normal and reported.
    if (digest.items.length === 0 && digest.failures.length > 0) {
      return NextResponse.json(
        {
          error: 'No live sources responded.',
          failures: digest.failures,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ query: query ?? null, ...digest });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      {
        error: aborted
          ? 'Live sources timed out'
          : error instanceof Error
            ? error.message
            : 'Failed to fetch live data',
      },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
