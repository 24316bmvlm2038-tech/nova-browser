import type { FetchOptions, LiveItem, LiveSource } from '../types';

/**
 * Bluesky via the AT Protocol's public AppView. `public.api.bsky.app` serves
 * read-only endpoints with no session or app password, which covers post search
 * and the "What's Hot" style feeds.
 */
const BASE = 'https://public.api.bsky.app/xrpc';

/** The discover feed, published by Bluesky itself. */
const HOT_FEED =
  'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';

interface Post {
  uri: string;
  author?: { handle?: string; displayName?: string };
  record?: { text?: string; createdAt?: string };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt?: string;
}

const request = async (path: string, signal?: AbortSignal) => {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Bluesky returned ${response.status}`);
  }
  return response.json();
};

/**
 * Turn an at:// URI into a bsky.app permalink. The rkey is the last path
 * segment and the DID is the authority.
 */
export const permalink = (uri: string, handle?: string): string => {
  const match = uri.match(/^at:\/\/([^/]+)\/[^/]+\/(.+)$/);
  if (!match) return '';
  return `https://bsky.app/profile/${handle || match[1]}/post/${match[2]}`;
};

export const toItem = (post: Post): LiveItem => {
  const text = (post.record?.text ?? '').replace(/\s+/g, ' ').trim();
  const title = text.length > 120 ? `${text.slice(0, 117)}…` : text || '(no text)';

  return {
    id: `bluesky:${post.uri}`,
    title,
    url: permalink(post.uri, post.author?.handle),
    source: 'Bluesky',
    author: post.author?.handle ? `@${post.author.handle}` : undefined,
    score: (post.likeCount ?? 0) + (post.repostCount ?? 0),
    comments: post.replyCount,
    publishedAt: post.record?.createdAt ?? post.indexedAt,
    summary: text.length > 120 ? text.slice(0, 280) : undefined,
  };
};

export const bluesky: LiveSource = {
  id: 'bluesky',
  label: 'Bluesky',
  kind: 'social',
  isConfigured: () => true,

  async trending(options: FetchOptions = {}) {
    const limit = options.limit ?? 15;
    const params = new URLSearchParams({ feed: HOT_FEED, limit: String(limit) });
    const data = await request(`/app.bsky.feed.getFeed?${params}`, options.signal);

    return (data.feed ?? [])
      .map((entry: any) => entry.post as Post)
      .filter((post: Post) => post?.uri)
      .map(toItem)
      .filter((item: LiveItem) => item.url);
  },

  async search(query: string, options: FetchOptions = {}) {
    const limit = options.limit ?? 15;
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      sort: 'top',
    });
    const data = await request(`/app.bsky.feed.searchPosts?${params}`, options.signal);

    return (data.posts ?? [])
      .filter((post: Post) => post?.uri)
      .map(toItem)
      .filter((item: LiveItem) => item.url);
  },
};
