import { hostnameOf, stripTags } from './html';
import type {
  ProviderName,
  SearchOptions,
  SearchProvider,
  SearchResult,
} from './types';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';

const DEFAULT_LIMIT = 12;

/**
 * DuckDuckGo's no-JS HTML endpoint. Needs no API key, which makes it the
 * default so the app works on a fresh laptop with nothing configured. It is
 * scraping, so it is rate limited and the markup can change without notice —
 * configure one of the keyed providers below for anything load bearing.
 */
const duckduckgo: SearchProvider = {
  name: 'duckduckgo',
  isConfigured: () => true,
  async search(query, options = {}) {
    const response = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: new URLSearchParams({ q: query, kl: 'us-en' }).toString(),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned ${response.status}`);
    }

    return parseDuckDuckGoHtml(await response.text(), options.limit ?? DEFAULT_LIMIT);
  },
};

/** Exported for testing — the markup here is the most fragile part of the stack. */
export const parseDuckDuckGoHtml = (html: string, limit: number): SearchResult[] => {
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  // Each result is an <a class="result__a" href="..."> followed somewhere by a
  // <a class="result__snippet">. Walk the anchors in document order and pair them up.
  const linkPattern =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snippetPattern =
    /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/g;

  const snippets: { index: number; text: string }[] = [];
  let snippetMatch: RegExpExecArray | null;
  while ((snippetMatch = snippetPattern.exec(html)) !== null) {
    snippets.push({ index: snippetMatch.index, text: stripTags(snippetMatch[1]) });
  }

  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkPattern.exec(html)) !== null && results.length < limit) {
    const url = resolveDuckDuckGoUrl(linkMatch[1]);
    if (!url || seen.has(url)) continue;

    const title = stripTags(linkMatch[2]);
    if (!title) continue;

    // The snippet for this result is the first one appearing after the link.
    const linkIndex = linkMatch.index;
    const snippet = snippets.find((s) => s.index > linkIndex)?.text ?? '';

    seen.add(url);
    results.push({ title, url, snippet, site: hostnameOf(url) });
  }

  return results;
};

/**
 * DDG wraps outbound links as `//duckduckgo.com/l/?uddg=<encoded target>`.
 * Unwrap those; pass through anything already absolute.
 */
const resolveDuckDuckGoUrl = (href: string): string | null => {
  const raw = href.startsWith('//') ? `https:${href}` : href;
  try {
    const parsed = new URL(raw, 'https://duckduckgo.com');
    const target = parsed.searchParams.get('uddg');
    const resolved = target ? decodeURIComponent(target) : parsed.toString();
    return resolved.startsWith('http') ? resolved : null;
  } catch {
    return null;
  }
};

/** Brave Search API — 2,000 free queries/month, set BRAVE_SEARCH_API_KEY. */
const brave: SearchProvider = {
  name: 'brave',
  isConfigured: () => Boolean(process.env.BRAVE_SEARCH_API_KEY),
  async search(query, options = {}) {
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', query);
    url.searchParams.set('count', String(options.limit ?? DEFAULT_LIMIT));

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY as string,
      },
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`Brave Search returned ${response.status}`);
    }

    const data = await response.json();
    return (data.web?.results ?? []).map(
      (item: any): SearchResult => ({
        title: stripTags(item.title ?? ''),
        url: item.url ?? '',
        snippet: stripTags(item.description ?? ''),
        site: hostnameOf(item.url ?? ''),
      })
    );
  },
};

/** Serper.dev — Google results behind a key, set SERPER_API_KEY. */
const serper: SearchProvider = {
  name: 'serper',
  isConfigured: () => Boolean(process.env.SERPER_API_KEY),
  async search(query, options = {}) {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.SERPER_API_KEY as string,
      },
      body: JSON.stringify({ q: query, num: options.limit ?? DEFAULT_LIMIT }),
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`Serper returned ${response.status}`);
    }

    const data = await response.json();
    // Serper's shopping block already carries clean prices when the query is
    // product shaped, so prefer it and fall back to organic web results.
    const shopping = (data.shopping ?? []).map(
      (item: any): SearchResult => ({
        title: stripTags(item.title ?? ''),
        url: item.link ?? '',
        snippet: [item.source, item.price].filter(Boolean).join(' — '),
        site: hostnameOf(item.link ?? ''),
      })
    );
    const organic = (data.organic ?? []).map(
      (item: any): SearchResult => ({
        title: stripTags(item.title ?? ''),
        url: item.link ?? '',
        snippet: stripTags(item.snippet ?? ''),
        site: hostnameOf(item.link ?? ''),
      })
    );
    return [...shopping, ...organic];
  },
};

/** A self-hosted SearXNG instance, set SEARXNG_URL (e.g. http://localhost:8888). */
const searxng: SearchProvider = {
  name: 'searxng',
  isConfigured: () => Boolean(process.env.SEARXNG_URL),
  async search(query, options = {}) {
    const base = (process.env.SEARXNG_URL as string).replace(/\/$/, '');
    const url = new URL(`${base}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });

    if (!response.ok) {
      throw new Error(`SearXNG returned ${response.status}`);
    }

    const data = await response.json();
    return (data.results ?? [])
      .slice(0, options.limit ?? DEFAULT_LIMIT)
      .map(
        (item: any): SearchResult => ({
          title: stripTags(item.title ?? ''),
          url: item.url ?? '',
          snippet: stripTags(item.content ?? ''),
          site: hostnameOf(item.url ?? ''),
        })
      );
  },
};

const PROVIDERS: Record<ProviderName, SearchProvider> = {
  duckduckgo,
  brave,
  serper,
  searxng,
};

/**
 * Pick the provider to use. An explicit SEARCH_PROVIDER wins; otherwise prefer
 * a configured keyed provider and fall back to DuckDuckGo, which always works.
 */
export const resolveProvider = (): SearchProvider => {
  const requested = process.env.SEARCH_PROVIDER as ProviderName | undefined;
  if (requested && PROVIDERS[requested]) {
    return PROVIDERS[requested];
  }
  return (
    [serper, brave, searxng].find((provider) => provider.isConfigured()) ??
    duckduckgo
  );
};

export const webSearch = async (
  query: string,
  options: SearchOptions = {}
): Promise<{ provider: ProviderName; results: SearchResult[] }> => {
  const provider = resolveProvider();
  const results = await provider.search(query, options);
  return { provider: provider.name, results: results.filter((r) => r.url) };
};
