import type { FetchOptions, LiveItem, LiveSource } from '../types';

/**
 * YouTube trending. Unlike the other sources this needs a key (free tier,
 * 10k units/day from the Google Cloud console) — without YOUTUBE_API_KEY the
 * source reports itself unconfigured and the aggregator skips it.
 */
const BASE = 'https://www.googleapis.com/youtube/v3';

const request = async (path: string, params: URLSearchParams, signal?: AbortSignal) => {
  params.set('key', process.env.YOUTUBE_API_KEY as string);
  const response = await fetch(`${BASE}${path}?${params}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`YouTube returned ${response.status}`);
  }
  return response.json();
};

const toItem = (video: any): LiveItem => ({
  id: `youtube:${video.id?.videoId ?? video.id}`,
  title: video.snippet?.title ?? '(untitled)',
  url: `https://www.youtube.com/watch?v=${video.id?.videoId ?? video.id}`,
  source: 'YouTube',
  channel: video.snippet?.channelTitle,
  score: video.statistics?.viewCount ? Number(video.statistics.viewCount) : undefined,
  comments: video.statistics?.commentCount
    ? Number(video.statistics.commentCount)
    : undefined,
  publishedAt: video.snippet?.publishedAt,
});

export const youtube: LiveSource = {
  id: 'youtube',
  label: 'YouTube',
  kind: 'social',
  isConfigured: () => Boolean(process.env.YOUTUBE_API_KEY),

  async trending(options: FetchOptions = {}) {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      chart: 'mostPopular',
      regionCode: process.env.NEWS_COUNTRY || 'US',
      maxResults: String(options.limit ?? 15),
    });
    const data = await request('/videos', params, options.signal);
    return (data.items ?? []).map(toItem);
  },

  async search(query: string, options: FetchOptions = {}) {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      order: 'viewCount',
      maxResults: String(options.limit ?? 15),
    });
    const data = await request('/search', params, options.signal);
    return (data.items ?? []).map(toItem);
  },
};
