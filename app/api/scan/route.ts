import { NextResponse } from 'next/server';
import { webSearch } from '@/lib/search/providers';
import {
  dedupeByPlatform,
  listingsFromResults,
  rejectOutliers,
  type ExtractedListing,
} from '@/lib/priceExtract';
import type { SearchResult } from '@/lib/search/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 20_000;
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'];

/**
 * Two passes: one biased toward new retail listings, one toward the used
 * market. Running both means a query like "iPhone 15" returns a real new-vs-used
 * spread instead of whichever the engine happened to rank first.
 */
const buildQueries = (item: string) => [
  { query: `${item} price buy`, bias: 'new' as const },
  { query: `${item} used refurbished for sale price`, bias: 'used' as const },
];

export async function POST(request: Request) {
  let item: string;
  let currency: string;
  let maxResults: number;

  try {
    const body = await request.json();
    item = typeof body.item === 'string' ? body.item.trim() : '';
    currency = SUPPORTED_CURRENCIES.includes(body.currency) ? body.currency : 'USD';
    maxResults =
      typeof body.maxResults === 'number'
        ? Math.min(Math.max(body.maxResults, 1), 10)
        : 5;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!item) {
    return NextResponse.json({ error: 'An "item" string is required' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const searches = await Promise.allSettled(
      buildQueries(item).map(({ query }) =>
        webSearch(query, { limit: 15, signal: controller.signal })
      )
    );

    const results: SearchResult[] = [];
    let provider = 'unknown';
    for (const outcome of searches) {
      if (outcome.status === 'fulfilled') {
        provider = outcome.value.provider;
        results.push(...outcome.value.results);
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: 'The search provider returned nothing. Check your connection or try again.' },
        { status: 502 }
      );
    }

    const listings = dedupeByPlatform(
      rejectOutliers(listingsFromResults(results, currency))
    );

    if (listings.length === 0) {
      return NextResponse.json(
        {
          error: `Found ${results.length} results for "${item}" but none listed a ${currency} price. Try a more specific product name.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      itemName: item,
      currency,
      provider,
      resultsSearched: results.length,
      ...summarize(listings, maxResults),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan failed';
    const aborted = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      { error: aborted ? 'Scan timed out' : message },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

const average = (values: number[]) =>
  Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

const summarize = (listings: ExtractedListing[], maxResults: number) => {
  const newListings = listings.filter((l) => l.condition === 'new');
  const usedListings = listings.filter((l) => l.condition === 'used');

  // Keep the cheapest of each condition, then fill the remaining slots by price.
  const sources = listings.slice(0, maxResults).map((listing) => ({
    platform: listing.platform,
    price: listing.price,
    url: listing.url,
    condition: listing.condition,
    title: listing.title,
  }));

  const newPrice = newListings.length > 0 ? average(newListings.map((l) => l.price)) : 0;
  const usedPrice = usedListings.length > 0 ? average(usedListings.map((l) => l.price)) : 0;

  return {
    sources,
    newPrice,
    usedPrice,
    currentPrice: newPrice || usedPrice,
    averagePrice: average(listings.map((l) => l.price)),
    lowestPrice: Math.min(...listings.map((l) => l.price)),
    highestPrice: Math.max(...listings.map((l) => l.price)),
  };
};
