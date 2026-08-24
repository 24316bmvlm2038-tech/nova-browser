/** One post, story, or article from a live source. */
export interface LiveItem {
  /** Stable per-source id, used to dedupe across refreshes. */
  id: string;
  title: string;
  url: string;
  /** Display name of the source, e.g. "Reddit". */
  source: string;
  /** Sub-feed within the source: a subreddit, an instance, a news topic. */
  channel?: string;
  author?: string;
  /** Upvotes, likes, or boosts — comparable only within a source. */
  score?: number;
  comments?: number;
  /** ISO timestamp of publication, when the source reports one. */
  publishedAt?: string;
  summary?: string;
  /** Article thumbnail, resolved from the page's og:image. */
  image?: string;
}

/** A trending tag/topic rather than a single post. */
export interface LiveTopic {
  name: string;
  source: string;
  url?: string;
  /** Posts/uses in the trending window, when reported. */
  volume?: number;
}

export type SourceKind = 'social' | 'news';

export interface FetchOptions {
  limit?: number;
  signal?: AbortSignal;
}

export interface LiveSource {
  id: string;
  label: string;
  kind: SourceKind;
  /** False when the source needs a key that isn't set; it is then skipped. */
  isConfigured(): boolean;
  /** What's hot right now on this source. */
  trending(options?: FetchOptions): Promise<LiveItem[]>;
  /** Recent posts matching a query. Omitted when the source has no search. */
  search?(query: string, options?: FetchOptions): Promise<LiveItem[]>;
  /** Trending tags/topics, where the source exposes them. */
  topics?(options?: FetchOptions): Promise<LiveTopic[]>;
}

/** Result of fanning out across sources: what worked and what didn't. */
export interface LiveDigest {
  items: LiveItem[];
  topics: LiveTopic[];
  /** Source ids that returned data. */
  sources: string[];
  /** Sources that failed, with why — surfaced rather than silently dropped. */
  failures: { source: string; reason: string }[];
  fetchedAt: string;
}
