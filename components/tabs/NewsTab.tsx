'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLive } from '@/lib/api';
import { clusterStories, distinctOutlets, type StoryCluster } from '@/lib/live/cluster';
import { SECTIONS } from '@/lib/live/sources/googlenews';
import type { LiveDigest, LiveItem } from '@/store/useChatStore';

/**
 * "Top stories" blends every source; the rest narrow to one. Reading a single
 * source at a time was the old behaviour and it buried the news under whatever
 * one platform happened to be loud about.
 */
const FEEDS = [
  { id: 'top', label: 'Top stories', sources: [] as string[] },
  { id: 'googlenews', label: 'Headlines', sources: ['googlenews'] },
  { id: 'reddit', label: 'Reddit', sources: ['reddit'] },
  { id: 'hackernews', label: 'Hacker News', sources: ['hackernews'] },
  { id: 'bluesky', label: 'Bluesky', sources: ['bluesky'] },
  { id: 'mastodon', label: 'Mastodon', sources: ['mastodon'] },
] as const;

type FeedId = (typeof FEEDS)[number]['id'];

/** Sections only apply where Google News is in the mix. */
const sectionsApply = (feed: FeedId) => feed === 'top' || feed === 'googlenews';

const REFRESH_MS = 5 * 60_000;

const relativeTime = (iso?: string) => {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
};

const compact = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : String(value);

export default function NewsTab() {
  const [feed, setFeed] = useState<FeedId>('top');
  const [section, setSection] = useState<string>('top');
  const [digest, setDigest] = useState<LiveDigest | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  /** Bumped every minute so "12m ago" doesn't sit frozen on screen. */
  const [, setTick] = useState(0);

  // A refresh that lands after the user has switched feeds must not overwrite
  // the feed they are now looking at.
  const request = useRef(0);

  const load = useCallback(
    async (feedId: FeedId, sectionId: string, topic: string) => {
      const ticket = (request.current += 1);
      setBusy(true);
      setError('');
      try {
        const chosen = FEEDS.find((option) => option.id === feedId);
        const result = await fetchLive(
          topic || undefined,
          [...(chosen?.sources ?? [])],
          25,
          true,
          sectionsApply(feedId) && !topic ? sectionId : undefined
        );
        if (ticket !== request.current) return;
        setDigest(result);
      } catch (problem) {
        if (ticket !== request.current) return;
        setDigest(null);
        setError(problem instanceof Error ? problem.message : 'Could not load the feed.');
      } finally {
        if (ticket === request.current) setBusy(false);
      }
    },
    []
  );

  useEffect(() => {
    load(feed, section, query);
    // Refetch when the feed or section changes; searching is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, section, load]);

  // News goes stale on its own, so the tab keeps itself current rather than
  // waiting to be told.
  useEffect(() => {
    const refresh = setInterval(() => load(feed, section, query), REFRESH_MS);
    const clock = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => {
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, [feed, section, query, load]);

  const clusters: StoryCluster[] = digest ? clusterStories(digest.items) : [];
  const fetched = relativeTime(digest?.fetchedAt);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-ground-dark">
      <header className="flex-shrink-0 bg-white dark:bg-ground-dark">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-2 flex items-baseline justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">News</h1>
          <button
            onClick={() => load(feed, section, query)}
            disabled={busy}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary disabled:opacity-50"
          >
            {busy ? 'Loading…' : fetched ? `Updated ${fetched} · Refresh` : 'Refresh'}
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            load(feed, section, query);
          }}
          className="max-w-3xl mx-auto px-4 pb-2"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the news…"
            className="w-full px-4 py-2.5 text-sm rounded-full bg-sunk-light dark:bg-sunk-dark text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </form>

        <div className="max-w-3xl mx-auto px-4 pb-1.5 flex gap-1.5 overflow-x-auto">
          {FEEDS.map((option) => (
            <button
              key={option.id}
              onClick={() => setFeed(option.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                feed === option.id
                  ? 'bg-primary text-white'
                  : 'bg-sunk-light dark:bg-sunk-dark text-gray-600 dark:text-gray-300 hover:text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {sectionsApply(feed) && !query && (
          <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-3 overflow-x-auto">
            {SECTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setSection(option.id)}
                className={`text-xs whitespace-nowrap pb-1 border-b-2 transition-colors ${
                  section === option.id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-primary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {error && (
            <p className="text-sm px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300">
              {error}
            </p>
          )}

          {busy && !digest && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              Fetching the latest…
            </p>
          )}

          {digest && digest.items.length === 0 && !busy && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              Nothing here right now.
            </p>
          )}

          {digest && digest.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {digest.topics.map((topic) => (
                <button
                  key={`${topic.source}-${topic.name}`}
                  onClick={() => {
                    const term = topic.name.replace(/^#/, '');
                    setQuery(term);
                    load(feed, section, term);
                  }}
                  className="text-xs px-2.5 py-1 rounded-full bg-sunk-light dark:bg-sunk-dark text-gray-700 dark:text-gray-300 hover:text-primary"
                >
                  {topic.name}
                  {topic.volume ? (
                    <span className="text-gray-400 dark:text-gray-500"> {compact(topic.volume)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          <ul className="flex flex-col gap-1">
            {clusters.map((cluster, index) => (
              <li key={cluster.lead.id}>
                <Story
                  cluster={cluster}
                  lead={index === 0 && Boolean(cluster.lead.image)}
                />
              </li>
            ))}
          </ul>

          {digest && digest.failures.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
              Unavailable: {digest.failures.map((failure) => failure.source).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ item }: { item: LiveItem }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span className="font-medium">{item.channel || item.source}</span>
      {item.author && <span className="truncate max-w-[9rem]">{item.author}</span>}
      {typeof item.score === 'number' && item.score > 0 && <span>▲ {compact(item.score)}</span>}
      {typeof item.comments === 'number' && item.comments > 0 && (
        <span>{compact(item.comments)} comments</span>
      )}
      {relativeTime(item.publishedAt) && <span>{relativeTime(item.publishedAt)}</span>}
    </div>
  );
}

function Story({ cluster, lead }: { cluster: StoryCluster; lead: boolean }) {
  const [open, setOpen] = useState(false);
  const item = cluster.lead;
  const outlets = distinctOutlets(cluster.coverage);

  const body = lead ? (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-card overflow-hidden bg-sunk-light dark:bg-sunk-dark group"
    >
      <Thumb src={item.image} className="w-full aspect-[16/9]" />
      <div className="p-3.5">
        <p className="text-[15px] font-semibold text-gray-900 dark:text-white group-hover:text-primary leading-snug">
          {item.title}
        </p>
        <Meta item={item} />
      </div>
    </a>
  ) : (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 rounded-card hover:bg-sunk-light dark:hover:bg-sunk-dark transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary leading-snug">
          {item.title}
        </p>
        <Meta item={item} />
      </div>
      {item.image && (
        <Thumb src={item.image} className="w-[76px] h-[76px] flex-shrink-0 rounded-xl" />
      )}
    </a>
  );

  if (outlets.length === 0) return body;

  return (
    <div>
      {body}
      <div className="pl-3 pb-1">
        <button
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="text-xs font-medium text-primary py-1"
        >
          {open
            ? 'Hide other coverage'
            : `${outlets.length} more ${outlets.length === 1 ? 'outlet' : 'outlets'} covering this`}
        </button>

        {open && (
          <ul className="flex flex-col gap-0.5 mt-0.5 border-l-2 border-sunk-light dark:border-sunk-dark pl-3">
            {outlets.map((other) => (
              <li key={other.id}>
                <a
                  href={other.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-1 group"
                >
                  <p className="text-[13px] text-gray-800 dark:text-gray-200 group-hover:text-primary leading-snug">
                    {other.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {other.channel || other.source}
                    {relativeTime(other.publishedAt) && ` · ${relativeTime(other.publishedAt)}`}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Publisher images are hotlinked from wherever the article lives, so a dead or
 * blocked URL must collapse quietly rather than leave a broken-image icon.
 */
function Thumb({ src, className }: { src?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    <div className={`overflow-hidden bg-gray-100 dark:bg-gray-800 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
