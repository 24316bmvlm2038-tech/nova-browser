import { NextResponse } from 'next/server';
import { ALL_SOURCES, gather } from '@/lib/live';
import { fetchThumbnails } from '@/lib/live/thumbnails';

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
  let section: string | undefined;
  let limit: number;
  let withImages: boolean;

  try {
    const body = await request.json().catch(() => ({}));
    query = typeof body.query === 'string' && body.query.trim() ? body.query.trim() : undefined;
    sources = Array.isArray(body.sources) ? body.sources.filter((s: unknown) => typeof s === 'string') : undefined;
    section = typeof body.section === 'string' && body.section.trim() ? body.section.trim() : undefined;
    limit = typeof body.limit === 'number' ? Math.min(Math.max(body.limit, 1), 40) : 18;
    // Costs one extra request per story, so it's opt-in — the News tab asks
    // for it, the chat digest doesn't.
    withImages = body.withImages === true;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const digest = await gather({
      query,
      sources,
      section,
      limit,
      signal: controller.signal,
    });

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

    if (withImages && digest.items.length > 0) {
      const thumbs = await fetchThumbnails(
        digest.items.map((item) => item.url),
        controller.signal
      );
      digest.items = digest.items.map((item) => {
        const image = thumbs.get(item.url);
        return image ? { ...item, image } : item;
      });
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
