import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { parseFeed, toIso } from '../lib/live/rss';
import { splitPublisher } from '../lib/live/sources/googlenews';
import { toItems as redditItems } from '../lib/live/sources/reddit';
import { permalink } from '../lib/live/sources/bluesky';
import { dedupe, interleave, rankAcrossSources } from '../lib/live';
import { extractTrendingTopic, isPriceQuery, isTrendingQuery } from '../lib/searchIntent';
import type { LiveItem } from '../lib/live/types';

const newsXml = readFileSync(join(__dirname, 'fixtures/googlenews.xml'), 'utf8');

const item = (over: Partial<LiveItem> & Pick<LiveItem, 'id' | 'source'>): LiveItem => ({
  title: 'title',
  url: `https://example.com/${over.id}`,
  ...over,
});

test('parses an RSS feed', () => {
  const entries = parseFeed(newsXml, 20);

  // The entry with no <link> is skipped.
  assert.equal(entries.length, 4);
  assert.equal(entries[0].title, 'Central bank holds rates steady amid mixed signals - Reuters');
  assert.equal(entries[0].link, 'https://news.google.com/rss/articles/CBMiabc123');
  // Description HTML is stripped down to text.
  assert.equal(entries[0].summary, 'Full coverage of the decision.');
  // CDATA is unwrapped.
  assert.match(entries[1].title, /^Storm system moves inland/);
  // Entities are decoded.
  assert.match(entries[2].title, /trench & find new species/);
});

test('respects the feed entry limit', () => {
  assert.equal(parseFeed(newsXml, 2).length, 2);
});

test('normalizes feed dates and drops unparseable ones', () => {
  assert.equal(toIso('Mon, 24 Aug 2026 09:14:00 GMT'), '2026-08-24T09:14:00.000Z');
  assert.equal(toIso('2026-08-24T09:14:00Z'), '2026-08-24T09:14:00.000Z');
  assert.equal(toIso('not a real date'), undefined);
  assert.equal(toIso(undefined), undefined);
});

test('splits the publisher off a news headline', () => {
  assert.deepEqual(splitPublisher('Rates held steady amid signals - Reuters'), {
    title: 'Rates held steady amid signals',
    publisher: 'Reuters',
  });
  // No suffix: title passes through untouched.
  assert.deepEqual(splitPublisher('A headline with no publisher suffix'), {
    title: 'A headline with no publisher suffix',
  });
  // A dash early in the string is part of the headline, not a publisher.
  assert.deepEqual(splitPublisher('Wall - to - wall coverage of a very long news story'), {
    title: 'Wall - to - wall coverage of a very long news story',
  });
});

test('maps Reddit listings and filters stickied and NSFW posts', () => {
  const items = redditItems({
    data: {
      children: [
        {
          data: {
            id: 'abc',
            title: 'A real post',
            permalink: '/r/news/comments/abc/a_real_post/',
            subreddit_name_prefixed: 'r/news',
            author: 'someone',
            ups: 4200,
            num_comments: 310,
            created_utc: 1_756_000_000,
          },
        },
        { data: { id: 'def', title: 'Pinned mod post', permalink: '/x', stickied: true } },
        { data: { id: 'ghi', title: 'NSFW post', permalink: '/y', over_18: true } },
      ],
    },
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'reddit:abc');
  // Links the discussion, not the outbound target.
  assert.equal(items[0].url, 'https://www.reddit.com/r/news/comments/abc/a_real_post/');
  assert.equal(items[0].author, 'u/someone');
  assert.equal(items[0].score, 4200);
  assert.equal(items[0].publishedAt, new Date(1_756_000_000_000).toISOString());
});

test('builds a bsky.app permalink from an at:// uri', () => {
  assert.equal(
    permalink('at://did:plc:abc123/app.bsky.feed.post/3kxyz', 'alice.bsky.social'),
    'https://bsky.app/profile/alice.bsky.social/post/3kxyz'
  );
  // Without a handle it falls back to the DID, which bsky.app also resolves.
  assert.equal(
    permalink('at://did:plc:abc123/app.bsky.feed.post/3kxyz'),
    'https://bsky.app/profile/did:plc:abc123/post/3kxyz'
  );
  assert.equal(permalink('not-a-uri'), '');
});

test('dedupes the same story across sources, keeping the livelier copy', () => {
  const items = dedupe([
    item({ id: '1', source: 'Reddit', url: 'https://site.com/story?utm_source=x', score: 10 }),
    item({ id: '2', source: 'Hacker News', url: 'https://site.com/story/', score: 400 }),
    item({ id: '3', source: 'Bluesky', url: 'https://other.com/thing' }),
  ]);

  assert.equal(items.length, 2);
  // Tracking params and trailing slashes don't defeat the match; higher score wins.
  assert.equal(items.find((i) => i.url.includes('site.com'))?.source, 'Hacker News');
});

test('ranks by position within each source, not by raw score', () => {
  // Mastodon's numbers are tiny next to Reddit's, but its top post must still
  // outrank Reddit's weakest.
  const ranked = rankAcrossSources([
    item({ id: 'r1', source: 'Reddit', score: 50_000, publishedAt: new Date().toISOString() }),
    item({ id: 'r2', source: 'Reddit', score: 20_000, publishedAt: new Date().toISOString() }),
    item({ id: 'm1', source: 'Mastodon', score: 40, publishedAt: new Date().toISOString() }),
  ]);

  const order = ranked.map((i) => i.id);
  assert.ok(order.indexOf('m1') < order.indexOf('r2'), `expected m1 before r2, got ${order}`);
});

test('interleaves sources so one platform cannot dominate the top', () => {
  const mixed = interleave(
    [
      item({ id: 'r1', source: 'Reddit' }),
      item({ id: 'r2', source: 'Reddit' }),
      item({ id: 'r3', source: 'Reddit' }),
      item({ id: 'h1', source: 'Hacker News' }),
      item({ id: 'b1', source: 'Bluesky' }),
    ],
    4
  );

  assert.equal(mixed.length, 4);
  assert.deepEqual(new Set(mixed.slice(0, 3).map((i) => i.source)).size, 3);
});

test('interleave stops cleanly when sources run dry', () => {
  const mixed = interleave([item({ id: 'a', source: 'Reddit' })], 10);
  assert.equal(mixed.length, 1);
});

test('routes trending questions to the live feeds', () => {
  assert.equal(isTrendingQuery("what's trending"), true);
  assert.equal(isTrendingQuery("what's happening right now"), true);
  assert.equal(isTrendingQuery('show me the top stories'), true);
  assert.equal(isTrendingQuery('anything new on reddit?'), true);
  assert.equal(isTrendingQuery('catch me up'), true);
  assert.equal(isTrendingQuery('write me a haiku'), false);
});

test('a price question with "right now" stays a price question', () => {
  // Trending is checked first, so it must not swallow this.
  assert.equal(isTrendingQuery('how much is an iPhone 15 right now'), false);
  assert.equal(isPriceQuery('how much is an iPhone 15 right now'), true);
});

test('extracts a topic from a trending question, or none for an open question', () => {
  assert.equal(extractTrendingTopic('what are people saying about Tesla'), 'people saying Tesla');
  assert.equal(extractTrendingTopic('is there any news about the election'), 'election');
  // Open-ended questions produce no topic, which means "general digest".
  assert.equal(extractTrendingTopic("what's trending"), '');
  assert.equal(extractTrendingTopic("what's happening right now"), '');
  assert.equal(extractTrendingTopic('catch me up'), '');
});
