import { bluesky } from './sources/bluesky';
import { googlenews, sectionHeadlines } from './sources/googlenews';
import { hackernews } from './sources/hackernews';
import { mastodon } from './sources/mastodon';
import { reddit } from './sources/reddit';
import { youtube } from './sources/youtube';
import type { FetchOptions, LiveDigest, LiveItem, LiveSource, LiveTopic } from './types';

export const ALL_SOURCES: LiveSource[] = [
  reddit,
  hackernews,
  bluesky,
  mastodon,
  googlenews,
  youtube,
];

export const sourceById = (id: string): LiveSource | undefined =>
  ALL_SOURCES.find((source) => source.id === id);

/**
 * Which sources to query. An explicit list wins; otherwise every source that
 * has the config it needs (which excludes YouTube unless a key is set).
 */
export const activeSources = (requested?: string[]): LiveSource[] => {
  const pool = ALL_SOURCES.filter((source) => source.isConfigured());
  if (!requested || requested.length === 0) return pool;
  return pool.filter((source) => requested.includes(source.id));
};

/** Same story posted to two sources: keep one. Normalizes trailing slashes and trackers. */
const canonical = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref|fbclid|gclid)/i.test(key)) parsed.searchParams.delete(key);
    }
    return `${parsed.host}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
  } catch {
    return url;
  }
};

export const dedupe = (items: LiveItem[]): LiveItem[] => {
  const seen = new Map<string, LiveItem>();
  for (const item of items) {
    const key = canonical(item.url);
    const existing = seen.get(key);
    // Prefer the copy with more engagement — it's the livelier thread.
    if (!existing || (item.score ?? 0) > (existing.score ?? 0)) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
};

const HOUR = 3600_000;

/** Newer items rank higher; a day-old item is worth about half a fresh one. */
const recencyWeight = (item: LiveItem, now: number): number => {
  if (!item.publishedAt) return 0.6;
  const ageHours = (now - new Date(item.publishedAt).getTime()) / HOUR;
  if (!Number.isFinite(ageHours) || ageHours < 0) return 0.6;
  return 1 / (1 + ageHours / 24);
};

/**
 * Rank across sources whose scores aren't comparable — 30,000 Reddit upvotes
 * and 20 Mastodon boosts both mean "top of that feed". Each item is scored by
 * its rank *within its own source*, then blended with recency, so no single
 * high-volume source can crowd everything else out.
 */
export const rankAcrossSources = (items: LiveItem[]): LiveItem[] => {
  const now = Date.now();
  const bySource = new Map<string, LiveItem[]>();

  for (const item of items) {
    const bucket = bySource.get(item.source) ?? [];
    bucket.push(item);
    bySource.set(item.source, bucket);
  }

  const scored = new Map<LiveItem, number>();
  for (const bucket of bySource.values()) {
    const ordered = [...bucket].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    ordered.forEach((item, index) => {
      // 1.0 for the top item in its source, falling to ~0 at the bottom.
      const positional = 1 - index / Math.max(ordered.length, 1);
      scored.set(item, positional * 0.6 + recencyWeight(item, now) * 0.4);
    });
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item);
};

/**
 * Take from each source in turn so the top of the digest shows a spread of
 * platforms rather than five Reddit posts.
 */
export const interleave = (items: LiveItem[], limit: number): LiveItem[] => {
  const queues = new Map<string, LiveItem[]>();
  for (const item of items) {
    const queue = queues.get(item.source) ?? [];
    queue.push(item);
    queues.set(item.source, queue);
  }

  const output: LiveItem[] = [];
  while (output.length < limit) {
    let took = false;
    for (const queue of queues.values()) {
      if (queue.length === 0) continue;
      output.push(queue.shift() as LiveItem);
      took = true;
      if (output.length >= limit) break;
    }
    if (!took) break;
  }
  return output;
};

interface GatherOptions extends FetchOptions {
  /** Restrict to these source ids. */
  sources?: string[];
  /** Omit for trending; provide to search each source instead. */
  query?: string;
  /** Google News section, e.g. `TECHNOLOGY`. Ignored by the other sources. */
  section?: string;
}

/**
 * Fan out across sources in parallel. One slow or broken source must not sink
 * the digest, so failures are collected and reported alongside the results
 * rather than thrown.
 */
export const gather = async (options: GatherOptions = {}): Promise<LiveDigest> => {
  const limit = options.limit ?? 18;
  const sources = activeSources(options.sources);
  const perSource = Math.max(5, Math.ceil((limit * 2) / Math.max(sources.length, 1)));

  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const perSourceOptions = { limit: perSource, signal: options.signal };
      const fetcher =
        options.query && source.search
          ? source.search(options.query, perSourceOptions)
          : options.query
            ? Promise.resolve([])
            : // A section only means something to Google News; everything else
              // just returns its own trending list.
              options.section && source.id === 'googlenews'
              ? sectionHeadlines(options.section, perSourceOptions)
              : source.trending(perSourceOptions);

      const [items, topics] = await Promise.all([
        fetcher,
        // Only trending views carry topics, and only some sources expose them.
        !options.query && source.topics
          ? source.topics({ limit: 8, signal: options.signal }).catch(() => [])
          : Promise.resolve([] as LiveTopic[]),
      ]);

      return { source, items, topics };
    })
  );

  const items: LiveItem[] = [];
  const topics: LiveTopic[] = [];
  const succeeded: string[] = [];
  const failures: { source: string; reason: string }[] = [];

  settled.forEach((outcome, index) => {
    const source = sources[index];
    if (outcome.status === 'fulfilled') {
      if (outcome.value.items.length > 0) succeeded.push(source.id);
      items.push(...outcome.value.items);
      topics.push(...outcome.value.topics);
    } else {
      failures.push({
        source: source.id,
        reason:
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason),
      });
    }
  });

  return {
    items: interleave(rankAcrossSources(dedupe(items.filter((item) => item.url))), limit),
    topics: topics.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, 12),
    sources: succeeded,
    failures,
    fetchedAt: new Date().toISOString(),
  };
};
