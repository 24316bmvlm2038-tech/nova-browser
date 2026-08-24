import { decodeEntities } from '../search/html';

/**
 * News feeds carry headlines but almost never images — Google News RSS has none
 * at all. To make the feed look like a news app we fetch each article and pull
 * its Open Graph image.
 *
 * That is one extra request per story, so results are cached and the fan-out is
 * bounded. A missing image is normal and never fails the story.
 */

const CACHE_TTL_MS = 30 * 60_000;
const MAX_CACHE = 400;
const PER_REQUEST_TIMEOUT_MS = 4_000;
const CONCURRENCY = 6;
/** Only the <head> is needed; stop reading once the meta tags are past. */
const MAX_BYTES = 120_000;

const cache = new Map<string, { image: string | null; at: number }>();

const remember = (url: string, image: string | null) => {
  if (cache.size >= MAX_CACHE) {
    // Cheap eviction: drop the oldest inserted key.
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(url, { image, at: Date.now() });
};

const META_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
];

export const extractOgImage = (html: string, pageUrl: string): string | null => {
  for (const pattern of META_PATTERNS) {
    const match = html.match(pattern);
    if (!match) continue;

    const raw = decodeEntities(match[1].trim());
    if (!raw) continue;

    try {
      // Resolve protocol-relative and root-relative URLs against the article.
      const resolved = new URL(raw, pageUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue;
      return resolved.toString();
    } catch {
      continue;
    }
  }
  return null;
};

const fetchOne = async (url: string, signal?: AbortSignal): Promise<string | null> => {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.image;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(url, {
      headers: {
        // Publishers serve og: tags to crawlers; a bare fetch often gets a wall.
        'User-Agent': 'Mozilla/5.0 (compatible; CanAiBot/1.0; +local news reader)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok || !response.body) {
      remember(url, null);
      return null;
    }

    // Read only the head; a full article page can be megabytes.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';

    while (html.length < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => undefined);

    const image = extractOgImage(html, response.url || url);
    remember(url, image);
    return image;
  } catch {
    remember(url, null);
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
};

/** Resolve thumbnails for many URLs at once, bounded to CONCURRENCY at a time. */
export const fetchThumbnails = async (
  urls: string[],
  signal?: AbortSignal
): Promise<Map<string, string>> => {
  const found = new Map<string, string>();
  const queue = [...new Set(urls)];

  const worker = async () => {
    while (queue.length > 0) {
      if (signal?.aborted) return;
      const url = queue.shift();
      if (!url) return;
      const image = await fetchOne(url, signal);
      if (image) found.set(url, image);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker)
  );

  return found;
};
