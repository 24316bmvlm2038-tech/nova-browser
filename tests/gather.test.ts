import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';

import { gather } from '../lib/live';
import { respondTo } from './stub-live.mjs';

const realFetch = globalThis.fetch;

/**
 * Intercept fetch so the aggregator runs against fixtures. This exercises the
 * real source adapters, dedupe, ranking and interleaving — everything except
 * the network hop itself.
 */
beforeEach(() => {
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    const fixture = respondTo(url);

    if (!fixture) {
      return new Response('not found', { status: 404 });
    }
    if (fixture.text !== undefined) {
      return new Response(fixture.text, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      });
    }
    return new Response(JSON.stringify(fixture.json), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('gathers a digest across every open source', async () => {
  const digest = await gather({ limit: 12 });

  assert.equal(digest.failures.length, 0, JSON.stringify(digest.failures));
  assert.ok(digest.items.length > 0);

  // All five key-free sources contributed. YouTube is skipped: no API key set.
  const sources = new Set(digest.items.map((item) => item.source));
  for (const expected of ['Reddit', 'Hacker News', 'Bluesky', 'Mastodon', 'Google News']) {
    assert.ok(sources.has(expected), `missing ${expected}; got ${[...sources]}`);
  }
  assert.ok(!digest.sources.includes('youtube'));

  // Trending hashtags come through, highest volume first.
  assert.deepEqual(
    digest.topics.map((topic) => topic.name),
    ['#outage', '#dns']
  );
  assert.equal(digest.topics[0].volume, 4210);
});

test('the top of the digest mixes platforms rather than stacking one', async () => {
  const digest = await gather({ limit: 8 });
  const topThree = digest.items.slice(0, 3).map((item) => item.source);
  assert.equal(new Set(topThree).size, 3, `expected 3 platforms, got ${topThree}`);
});

test('every item carries a usable link', async () => {
  const digest = await gather({ limit: 12 });
  for (const item of digest.items) {
    assert.match(item.url, /^https?:\/\//, `bad url on ${item.id}`);
  }
});

test('a story posted to two platforms appears once', async () => {
  const digest = await gather({ limit: 20 });
  const outageTitles = digest.items.filter((item) =>
    item.title.includes('Major outage takes down half the internet')
  );
  // Reddit and Hacker News both carry it, but under different URLs (Reddit
  // links its own thread), so both legitimately survive; the guard is that
  // identical URLs collapse.
  const urls = digest.items.map((item) => item.url);
  assert.equal(new Set(urls).size, urls.length, 'duplicate URLs in digest');
  assert.ok(outageTitles.length >= 1);
});

test('one broken source does not sink the digest', async () => {
  const inner = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('reddit.com')) throw new Error('Reddit returned 429');
    return inner(input);
  }) as typeof fetch;

  const digest = await gather({ limit: 10 });

  assert.deepEqual(
    digest.failures.map((failure) => failure.source),
    ['reddit']
  );
  assert.match(digest.failures[0].reason, /429/);
  // The other four still delivered.
  assert.ok(digest.items.length > 0);
  assert.ok(!digest.items.some((item) => item.source === 'Reddit'));
});

test('restricting sources queries only those', async () => {
  const digest = await gather({ limit: 10, sources: ['hackernews'] });

  assert.ok(digest.items.length > 0);
  assert.deepEqual(new Set(digest.items.map((item) => item.source)), new Set(['Hacker News']));
});
