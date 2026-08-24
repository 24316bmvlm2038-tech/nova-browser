import type { LiveDigest, LiveItem } from '@/store/useChatStore';

interface TrendingCardProps {
  digest: LiveDigest;
}

/** Colour per platform so the mix of sources is readable at a glance. */
const SOURCE_STYLE: Record<string, string> = {
  Reddit: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  'Hacker News': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  Bluesky: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
  Mastodon: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  'Google News': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  YouTube: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
};

const relativeTime = (iso?: string): string => {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const compact = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : String(value);

export default function TrendingCard({ digest }: TrendingCardProps) {
  return (
    <div className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {digest.query ? `Live: ${digest.query}` : 'Trending now'}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          {relativeTime(digest.fetchedAt) || 'just now'}
        </span>
      </div>

      {digest.topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {digest.topics.map((topic) => (
            <a
              key={`${topic.source}-${topic.name}`}
              href={topic.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-2 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
              title={topic.volume ? `${topic.volume} posts today` : undefined}
            >
              {topic.name}
              {topic.volume ? (
                <span className="text-gray-400 dark:text-gray-500"> {compact(topic.volume)}</span>
              ) : null}
            </a>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {digest.items.map((item) => (
          <li key={item.id}>
            <Row item={item} />
          </li>
        ))}
      </ul>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        {digest.sources.length > 0 && <>From {digest.sources.length} source{digest.sources.length === 1 ? '' : 's'}. </>}
        {digest.failures.length > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            Unavailable: {digest.failures.map((failure) => failure.source).join(', ')}.
          </span>
        )}
      </p>
    </div>
  );
}

function Row({ item }: { item: LiveItem }) {
  const badge =
    SOURCE_STYLE[item.source] ??
    'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary transition-colors group"
    >
      <div className="flex items-start gap-2">
        <span
          className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${badge}`}
        >
          {item.source}
        </span>
        <span className="text-sm text-gray-800 dark:text-gray-200 group-hover:text-primary leading-snug">
          {item.title}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 pl-1 text-xs text-gray-500 dark:text-gray-400">
        {item.channel && <span className="truncate max-w-[14rem]">{item.channel}</span>}
        {item.author && <span className="truncate max-w-[10rem]">{item.author}</span>}
        {typeof item.score === 'number' && item.score > 0 && (
          <span>▲ {compact(item.score)}</span>
        )}
        {typeof item.comments === 'number' && item.comments > 0 && (
          <span>{compact(item.comments)} comments</span>
        )}
        {relativeTime(item.publishedAt) && <span>{relativeTime(item.publishedAt)}</span>}
      </div>
    </a>
  );
}
