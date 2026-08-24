import type { FetchOptions, LiveItem, LiveSource } from '../types';

/**
 * Reddit's public JSON endpoints. No key or OAuth needed for read-only public
 * listings, but a descriptive User-Agent is required — the generic one Node
 * sends gets 429'd immediately.
 */
const USER_AGENT = 'CanAi/1.0 (local trending reader)';
const BASE = 'https://www.reddit.com';

interface RedditChild {
  data: {
    id: string;
    title: string;
    permalink: string;
    url?: string;
    subreddit_name_prefixed?: string;
    author?: string;
    ups?: number;
    num_comments?: number;
    created_utc?: number;
    selftext?: string;
    over_18?: boolean;
    stickied?: boolean;
  };
}

const request = async (path: string, signal?: AbortSignal) => {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Reddit returned ${response.status}`);
  }
  return response.json();
};

export const toItems = (payload: any): LiveItem[] =>
  (payload?.data?.children ?? [])
    .map((child: RedditChild) => child.data)
    // Pinned mod posts aren't "trending", and NSFW is filtered by default.
    .filter((post: RedditChild['data']) => post && !post.stickied && !post.over_18)
    .map(
      (post: RedditChild['data']): LiveItem => ({
        id: `reddit:${post.id}`,
        title: post.title,
        // Always link the discussion, not the outbound target — the comments
        // are the reason to look at Reddit.
        url: `${BASE}${post.permalink}`,
        source: 'Reddit',
        channel: post.subreddit_name_prefixed,
        author: post.author ? `u/${post.author}` : undefined,
        score: post.ups,
        comments: post.num_comments,
        publishedAt: post.created_utc
          ? new Date(post.created_utc * 1000).toISOString()
          : undefined,
        summary: post.selftext ? post.selftext.slice(0, 280) : undefined,
      })
    );

export const reddit: LiveSource = {
  id: 'reddit',
  label: 'Reddit',
  kind: 'social',
  isConfigured: () => true,

  async trending(options: FetchOptions = {}) {
    const limit = options.limit ?? 15;
    const payload = await request(`/r/popular/hot.json?limit=${limit}`, options.signal);
    return toItems(payload).slice(0, limit);
  },

  async search(query: string, options: FetchOptions = {}) {
    const limit = options.limit ?? 15;
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      sort: 'new',
      t: 'week',
      type: 'link',
    });
    const payload = await request(`/search.json?${params}`, options.signal);
    return toItems(payload).slice(0, limit);
  },
};
