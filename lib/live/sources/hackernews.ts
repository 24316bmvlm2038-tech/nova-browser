import type { FetchOptions, LiveItem, LiveSource } from '../types';

/**
 * Hacker News. Trending comes from the Firebase API; search uses Algolia's HN
 * index, which supports queries and returns everything in one request. Both are
 * free and unauthenticated.
 */
const FIREBASE = 'https://hacker-news.firebaseio.com/v0';
const ALGOLIA = 'https://hn.algolia.com/api/v1';

interface HnStory {
  id: number;
  title?: string;
  url?: string;
  by?: string;
  score?: number;
  descendants?: number;
  time?: number;
  text?: string;
}

const discussionUrl = (id: number) => `https://news.ycombinator.com/item?id=${id}`;

export const fromFirebase = (story: HnStory): LiveItem => ({
  id: `hn:${story.id}`,
  title: story.title ?? '(untitled)',
  // Ask HN and similar have no outbound URL; fall back to the thread.
  url: story.url || discussionUrl(story.id),
  source: 'Hacker News',
  author: story.by,
  score: story.score,
  comments: story.descendants,
  publishedAt: story.time ? new Date(story.time * 1000).toISOString() : undefined,
  summary: story.text ? story.text.slice(0, 280) : undefined,
});

export const hackernews: LiveSource = {
  id: 'hackernews',
  label: 'Hacker News',
  kind: 'social',
  isConfigured: () => true,

  async trending(options: FetchOptions = {}) {
    const limit = options.limit ?? 15;

    const listResponse = await fetch(`${FIREBASE}/topstories.json`, {
      signal: options.signal,
    });
    if (!listResponse.ok) {
      throw new Error(`Hacker News returned ${listResponse.status}`);
    }
    const ids: number[] = (await listResponse.json()) ?? [];

    // The list endpoint gives ids only; each story needs its own fetch, so cap
    // the fan-out at the requested limit rather than pulling all 500.
    const stories = await Promise.all(
      ids.slice(0, limit).map(async (id) => {
        const response = await fetch(`${FIREBASE}/item/${id}.json`, {
          signal: options.signal,
        });
        return response.ok ? ((await response.json()) as HnStory) : null;
      })
    );

    return stories.filter((story): story is HnStory => Boolean(story?.title)).map(fromFirebase);
  },

  async search(query: string, options: FetchOptions = {}) {
    const limit = options.limit ?? 15;
    const params = new URLSearchParams({
      query,
      tags: 'story',
      hitsPerPage: String(limit),
    });

    const response = await fetch(`${ALGOLIA}/search?${params}`, {
      signal: options.signal,
    });
    if (!response.ok) {
      throw new Error(`Hacker News search returned ${response.status}`);
    }

    const data = await response.json();
    return (data.hits ?? []).map(
      (hit: any): LiveItem => ({
        id: `hn:${hit.objectID}`,
        title: hit.title ?? hit.story_title ?? '(untitled)',
        url: hit.url || discussionUrl(Number(hit.objectID)),
        source: 'Hacker News',
        author: hit.author,
        score: hit.points,
        comments: hit.num_comments,
        publishedAt: hit.created_at,
      })
    );
  },
};
