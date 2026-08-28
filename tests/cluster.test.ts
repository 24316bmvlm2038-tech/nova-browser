import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clusterStories,
  distinctOutlets,
  keywords,
  overlap,
} from '../lib/live/cluster';
import type { LiveItem } from '../lib/live/types';

let counter = 0;
const item = (title: string, extra: Partial<LiveItem> = {}): LiveItem => {
  counter += 1;
  return {
    id: `i${counter}`,
    title,
    url: `https://example.com/${counter}`,
    source: 'Google News',
    ...extra,
  };
};

test('keeps only the words that identify a story', () => {
  const words = keywords('The regulators will open an inquiry into the outage');
  // "the", "will", "an", "into" say nothing about which story this is.
  assert.deepEqual([...words].sort(), ['inquiry', 'open', 'outage', 'regulators']);
});

test('keeps short tokens only when they contain a digit', () => {
  const words = keywords('FAA grounds 737 jets after 5G row');
  assert.ok(words.has('737'), 'a model number is the most distinctive token there is');
  assert.ok(words.has('5g'));
  assert.ok(!words.has('an'));
});

test('treats possessives and curly quotes as the same word', () => {
  const straight = keywords("Ireland's central bank holds rates");
  const curly = keywords('Ireland’s central bank holds rates');
  assert.deepEqual([...straight].sort(), [...curly].sort());
  assert.ok(straight.has('ireland'), 'the apostrophe-s should be stripped');
});

test('scores overlap against the shorter headline, not the union', () => {
  const short = keywords('Regulators open outage inquiry');
  const long = keywords(
    'Regulators open outage inquiry as lawmakers demand answers from providers'
  );
  // Every word of the short headline appears in the long one.
  assert.equal(overlap(short, long), 1);
  // Jaccard would have scored this around 0.4 and missed the match.
});

test('groups the same event reported by different outlets', () => {
  const clusters = clusterStories([
    item('Regulators open inquiry into internet outage', { channel: 'Reuters' }),
    item('Regulators open inquiry into this morning outage', { channel: 'AP News' }),
    item('Inquiry opened into internet outage by regulators', { channel: 'BBC' }),
  ]);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].lead.channel, 'Reuters');
  assert.equal(clusters[0].coverage.length, 2);
});

test('leaves unrelated headlines in their own clusters', () => {
  const clusters = clusterStories([
    item('Central bank holds rates steady'),
    item('Scientists map the deepest trench'),
    item('Storm system moves inland'),
  ]);

  assert.equal(clusters.length, 3);
  assert.ok(clusters.every((cluster) => cluster.coverage.length === 0));
});

test('does not group headlines that only share filler words', () => {
  // Both are "The <word> of the <word>" — every shared token is a stopword.
  const clusters = clusterStories([
    item('The future of the housing market'),
    item('The history of the coffee trade'),
  ]);
  assert.equal(clusters.length, 2);
});

test('needs more than one shared word to group short headlines', () => {
  // "Apple" alone is a coincidence, not a story.
  const clusters = clusterStories([
    item('Apple earnings beat'),
    item('Apple orchard festival'),
  ]);
  assert.equal(clusters.length, 2);
});

test('preserves feed order, so the top-ranked item leads its story', () => {
  const clusters = clusterStories([
    item('Storm system moves inland thousands lose power'),
    item('Regulators open inquiry into outage', { channel: 'Reuters' }),
    item('Storm moves inland as thousands lose power overnight'),
  ]);

  assert.equal(clusters.length, 2);
  assert.match(clusters[0].lead.title, /^Storm system/);
  assert.equal(clusters[0].coverage.length, 1);
  // The unrelated story keeps its position rather than being sorted away.
  assert.equal(clusters[1].lead.channel, 'Reuters');
});

test('an empty feed produces no clusters', () => {
  assert.deepEqual(clusterStories([]), []);
});

test('collapses syndicated copies to one row per outlet', () => {
  const coverage = [
    item('Same wire story', { channel: 'Reuters' }),
    item('Same wire story again', { channel: 'Reuters' }),
    item('Same wire story elsewhere', { channel: 'AP News' }),
  ];

  const outlets = distinctOutlets(coverage);
  assert.deepEqual(
    outlets.map((entry) => entry.channel),
    ['Reuters', 'AP News']
  );
});

test('falls back to the source name when an item has no publisher', () => {
  const outlets = distinctOutlets([
    item('One', { source: 'Reddit' }),
    item('Two', { source: 'Reddit' }),
    item('Three', { source: 'Hacker News' }),
  ]);
  assert.equal(outlets.length, 2);
});
