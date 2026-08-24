import { stripTags } from '../../search/html';
import type { FetchOptions, LiveItem, LiveSource, LiveTopic } from '../types';

/**
 * Mastodon. Trends and public timelines are readable without a token on most
 * instances. Trends are per-instance rather than network-wide — mastodon.social
 * is the largest, so it's the default view of "what's trending".
 */
const instance = () =>
  (process.env.MASTODON_INSTANCE || 'https://mastodon.social').replace(/\/$/, '');

interface Status {
  id: string;
  url?: string;
  uri?: string;
  content?: string;
  created_at?: string;
  replies_count?: number;
  reblogs_count?: number;
  favourites_count?: number;
  account?: { acct?: string; display_name?: string };
}

const request = async (path: string, signal?: AbortSignal) => {
  const response = await fetch(`${instance()}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Mastodon returned ${response.status}`);
  }
  return response.json();
};

/** Posts have no title, so the first line of the body stands in for one. */
export const toItem = (status: Status): LiveItem => {
  const text = stripTags(status.content ?? '');
  const title = text.length > 120 ? `${text.slice(0, 117)}…` : text || '(no text)';

  return {
    id: `mastodon:${status.id}`,
    title,
    url: status.url || status.uri || '',
    source: 'Mastodon',
    channel: instance().replace(/^https?:\/\//, ''),
    author: status.account?.acct ? `@${status.account.acct}` : undefined,
    // Boosts are the closest analogue to an upvote for ranking purposes.
    score: (status.reblogs_count ?? 0) + (status.favourites_count ?? 0),
    comments: status.replies_count,
    publishedAt: status.created_at,
    summary: text.length > 120 ? text.slice(0, 280) : undefined,
  };
};

export const mastodon: LiveSource = {
  id: 'mastodon',
  label: 'Mastodon',
  kind: 'social',
  isConfigured: () => true,

  async trending(options: FetchOptions = {}) {
    const limit = options.limit ?? 15;
    const statuses: Status[] = await request(
      `/api/v1/trends/statuses?limit=${limit}`,
      options.signal
    );
    return statuses.filter((status) => status.url || status.uri).map(toItem);
  },

  async topics(options: FetchOptions = {}) {
    const limit = options.limit ?? 10;
    const tags: any[] = await request(
      `/api/v1/trends/tags?limit=${limit}`,
      options.signal
    );

    return tags.map(
      (tag): LiveTopic => ({
        name: `#${tag.name}`,
        source: 'Mastodon',
        url: tag.url,
        // history[0] is the current day's bucket.
        volume: tag.history?.[0]?.uses
          ? Number(tag.history[0].uses)
          : undefined,
      })
    );
  },

  async search(query: string, options: FetchOptions = {}) {
    const limit = options.limit ?? 15;
    // Hashtag timelines are public; full-text search needs a token, so route
    // queries through the tag timeline instead.
    const tag = query.replace(/^#/, '').replace(/[^\p{L}\p{N}_]/gu, '');
    if (!tag) return [];

    const statuses: Status[] = await request(
      `/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=${limit}`,
      options.signal
    );
    return statuses.filter((status) => status.url || status.uri).map(toItem);
  },
};
