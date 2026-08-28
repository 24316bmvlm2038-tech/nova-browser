import { hostnameOf } from '../../search/html';
import { parseFeed, toIso } from '../rss';
import type { FetchOptions, LiveItem, LiveSource } from '../types';

/**
 * Google News RSS. Free, no key, and it aggregates thousands of outlets, so it
 * covers "what's in the news" without wiring up each publisher separately.
 */
const BASE = 'https://news.google.com/rss';

const locale = () => ({
  hl: process.env.NEWS_LANGUAGE || 'en-US',
  gl: process.env.NEWS_COUNTRY || 'US',
  ceid: `${process.env.NEWS_COUNTRY || 'US'}:${(process.env.NEWS_LANGUAGE || 'en-US').split('-')[0]}`,
});

const fetchFeed = async (path: string, params: URLSearchParams, signal?: AbortSignal) => {
  const response = await fetch(`${BASE}${path}?${params}`, {
    headers: { 'User-Agent': 'CanAi/1.0 (news reader)', Accept: 'application/rss+xml' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Google News returned ${response.status}`);
  }
  return response.text();
};

/**
 * Headlines arrive as "Story title - Publisher". Split the publisher off so it
 * can be shown as the channel instead of cluttering the title.
 */
export const splitPublisher = (
  title: string
): { title: string; publisher?: string } => {
  const index = title.lastIndexOf(' - ');
  if (index === -1 || index < title.length / 2) return { title };
  return {
    title: title.slice(0, index).trim(),
    publisher: title.slice(index + 3).trim() || undefined,
  };
};

const toItems = (xml: string, limit: number): LiveItem[] =>
  parseFeed(xml, limit).map((entry, index): LiveItem => {
    const { title, publisher } = splitPublisher(entry.title);
    return {
      id: `gnews:${entry.link || index}`,
      title,
      url: entry.link,
      source: 'Google News',
      channel: publisher ?? hostnameOf(entry.link) ?? undefined,
      publishedAt: toIso(entry.published),
    };
  });

/**
 * Google News' own sections. Reading only the front page gives one
 * undifferentiated stream, where a day of politics buries everything else;
 * these are the same categories the Google News app puts across the top.
 */
export const SECTIONS = [
  { id: 'top', label: 'Top stories' },
  { id: 'WORLD', label: 'World' },
  { id: 'NATION', label: 'National' },
  { id: 'BUSINESS', label: 'Business' },
  { id: 'TECHNOLOGY', label: 'Technology' },
  { id: 'SCIENCE', label: 'Science' },
  { id: 'HEALTH', label: 'Health' },
  { id: 'SPORTS', label: 'Sport' },
  { id: 'ENTERTAINMENT', label: 'Entertainment' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

const isSection = (value: string): boolean =>
  SECTIONS.some((section) => section.id === value);

/**
 * Headlines for one section. Anything unrecognised falls back to the front
 * page rather than requesting a URL Google will 404 — a bad section id is a
 * caller's typo, not a reason to show the user an error.
 */
export const sectionHeadlines = async (
  section: string,
  options: FetchOptions = {}
): Promise<LiveItem[]> => {
  const limit = options.limit ?? 15;
  const path =
    section && section !== 'top' && isSection(section)
      ? `/headlines/section/topic/${section}`
      : '';
  const xml = await fetchFeed(path, new URLSearchParams(locale()), options.signal);
  return toItems(xml, limit);
};

export const googlenews: LiveSource = {
  id: 'googlenews',
  label: 'Google News',
  kind: 'news',
  isConfigured: () => true,

  async trending(options: FetchOptions = {}) {
    return sectionHeadlines('top', options);
  },

  async search(query: string, options: FetchOptions = {}) {
    const limit = options.limit ?? 15;
    const params = new URLSearchParams({ q: query, ...locale() });
    const xml = await fetchFeed('/search', params, options.signal);
    return toItems(xml, limit);
  },
};
