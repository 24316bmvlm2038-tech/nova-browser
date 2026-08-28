import type { LiveItem } from './types';

/**
 * Group items that cover the same story.
 *
 * A live digest of one event reads as five near-identical rows — Reuters, AP,
 * the BBC and two Reddit threads all reporting the same thing. Google News
 * collapses those into one entry with the other coverage tucked underneath,
 * and that is most of what makes its feed readable. There is no shared id to
 * group on (each outlet has its own URL), so grouping has to come from the
 * headlines themselves.
 */

/**
 * Words that carry no signal about *which* story a headline is about. Without
 * this list "The report on the crisis" and "The report on the election" share
 * three tokens and look like the same story.
 */
const STOPWORDS = new Set([
  'a', 'about', 'after', 'again', 'against', 'all', 'also', 'amid', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'been', 'before', 'being', 'between', 'both',
  'but', 'by', 'can', 'could', 'did', 'do', 'does', 'down', 'during', 'each',
  'few', 'first', 'for', 'from', 'get', 'gets', 'had', 'has', 'have', 'he',
  'her', 'here', 'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is',
  'it', 'its', 'just', 'like', 'may', 'me', 'might', 'more', 'most', 'my',
  'new', 'no', 'not', 'now', 'of', 'off', 'on', 'once', 'one', 'only', 'or',
  'other', 'our', 'out', 'over', 'own', 'per', 'said', 'same', 'says', 'she',
  'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'two', 'under', 'until', 'up', 'us', 'very', 'was', 'we', 'were', 'what',
  'when', 'where', 'which', 'while', 'who', 'why', 'will', 'with', 'would',
  'you', 'your',
]);

/**
 * Significant words in a headline, lowercased and stripped of punctuation.
 * Numbers are kept whatever their length — "737", "5G" and "2026" are among
 * the most distinctive tokens a headline can carry.
 */
export const keywords = (title: string): Set<string> => {
  const words = title
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .split(/[^a-z0-9']+/)
    .map((word) => word.replace(/^'+|'+$/g, ''))
    .map((word) => word.replace(/'s$/, ''));

  const kept = words.filter(
    (word) =>
      word.length > 0 &&
      !STOPWORDS.has(word) &&
      (word.length >= 3 || /\d/.test(word))
  );

  return new Set(kept);
};

/**
 * How much two headlines overlap, as a fraction of the shorter one.
 *
 * Containment rather than Jaccard: a wire headline ("Regulators open inquiry
 * into outage") and a long analysis headline about the same event share every
 * word of the short one but only half of the long one, and Jaccard would score
 * that as a miss.
 */
export const overlap = (a: Set<string>, b: Set<string>): number => {
  const smaller = a.size <= b.size ? a : b;
  const larger = smaller === a ? b : a;
  if (smaller.size === 0) return 0;

  let shared = 0;
  for (const word of smaller) {
    if (larger.has(word)) shared += 1;
  }
  return shared / smaller.size;
};

/** Fraction of the shorter headline that must match to count as one story. */
const THRESHOLD = 0.6;

/**
 * Two shared words is the floor. Below it, a pair of three-word headlines
 * sharing one word would clear the threshold on a single coincidence.
 */
const MIN_SHARED = 2;

const sharedCount = (a: Set<string>, b: Set<string>): number => {
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) shared += 1;
  }
  return shared;
};

export interface StoryCluster {
  /** Best item for the story — the first one seen, so ranking decides. */
  lead: LiveItem;
  /** The same story elsewhere, in rank order. Empty for a one-off. */
  coverage: LiveItem[];
}

/**
 * Collapse a ranked list into clusters, preserving order.
 *
 * Greedy and single-pass: each item joins the first cluster it matches, so the
 * highest-ranked item of a story always leads it. That keeps the feed's
 * ordering intact, which a re-sorting clusterer would quietly destroy.
 */
export const clusterStories = (items: LiveItem[]): StoryCluster[] => {
  const clusters: { lead: LiveItem; coverage: LiveItem[]; words: Set<string> }[] = [];

  for (const item of items) {
    const words = keywords(item.title);
    const home = clusters.find(
      (cluster) =>
        overlap(cluster.words, words) >= THRESHOLD &&
        sharedCount(cluster.words, words) >= MIN_SHARED
    );

    if (home) {
      home.coverage.push(item);
    } else {
      clusters.push({ lead: item, coverage: [], words });
    }
  }

  return clusters.map(({ lead, coverage }) => ({ lead, coverage }));
};

/**
 * Publishers that syndicate the same wire copy show up repeatedly. Keep one
 * row per outlet so "+8 more" isn't eight copies of the same byline.
 */
export const distinctOutlets = (coverage: LiveItem[]): LiveItem[] => {
  const seen = new Set<string>();
  const kept: LiveItem[] = [];

  for (const item of coverage) {
    const outlet = (item.channel || item.source).toLowerCase();
    if (seen.has(outlet)) continue;
    seen.add(outlet);
    kept.push(item);
  }
  return kept;
};
