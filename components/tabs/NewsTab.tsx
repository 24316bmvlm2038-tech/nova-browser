'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchLive } from '@/lib/api';
import type { LiveDigest, LiveItem } from '@/store/useChatStore';

/** Google News first, then the social sources, so the tab leads with headlines. */
const FEEDS = [
  { id: 'googlenews', label: 'Headlines' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'hackernews', label: 'Hacker News' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'mastodon', label: 'Mastodon' },
] as const;

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
  const [feed, setFeed] = useState<(typeof FEEDS)[number]['id']>('googlenews');
  const [digest, setDigest] = useState<LiveDigest | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (source: string, topic: string) => {
      setBusy(true);
      setError('');
      try {
        setDigest(await fetchLive(topic || undefined, [source], 25, true));
      } catch (problem) {
        setDigest(null);
        setError(problem instanceof Error ? problem.message : 'Could not load the feed.');
      } finally {
        setBusy(false);
      }
    },
    []
  );

  useEffect(() => {
    load(feed, query);
    // Refetch on feed change only; searching is explicit via the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, load]);

  return (
    <div className="flex flex-col h-full">
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-2 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">News</h1>
          <button
            onClick={() => load(feed, query)}
            disabled={busy}
            className="text-xs px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {busy ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            load(feed, query);
          }}
          className="max-w-3xl mx-auto px-4 pb-2"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this feed…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </form>

        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-1.5 overflow-x-auto">
          {FEEDS.map((option) => (
            <button
              key={option.id}
              onClick={() => setFeed(option.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                feed === option.id
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-primary'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {error && (
            <p className="text-sm px-3.5 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
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
                    setQuery(topic.name.replace(/^#/, ''));
                    load(feed, topic.name.replace(/^#/, ''));
                  }}
                  className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-primary"
                >
                  {topic.name}
                  {topic.volume ? (
                    <span className="text-gray-400 dark:text-gray-500"> {compact(topic.volume)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          <ul className="flex flex-col gap-2.5">
            {digest?.items.map((item, index) => (
              <li key={item.id}>
                <Story item={item} lead={index === 0 && Boolean(item.image)} />
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

function Story({ item, lead }: { item: LiveItem; lead: boolean }) {
  const meta = (
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

  // The top story runs full-bleed like a news app; the rest are list rows.
  if (lead) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary transition-colors group"
      >
        <Thumb src={item.image} className="w-full aspect-[16/9]" />
        <div className="p-3.5">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-white group-hover:text-primary leading-snug">
            {item.title}
          </p>
          {meta}
        </div>
      </a>
    );
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary leading-snug">
          {item.title}
        </p>
        {meta}
      </div>
      {item.image && <Thumb src={item.image} className="w-[76px] h-[76px] flex-shrink-0 rounded-lg" />}
    </a>
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
