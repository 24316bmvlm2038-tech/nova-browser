import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { parseDuckDuckGoHtml } from '../lib/search/providers';
import {
  dedupeByPlatform,
  extractPrices,
  listingsFromResults,
  parseAmount,
  rejectOutliers,
  retailerName,
  detectCondition,
} from '../lib/priceExtract';
import { extractProductName, isPriceQuery, needsWebSearch } from '../lib/searchIntent';

const fixture = readFileSync(join(__dirname, 'fixtures/duckduckgo.html'), 'utf8');

test('parses results out of DuckDuckGo markup', () => {
  const results = parseDuckDuckGoHtml(fixture, 20);

  assert.equal(results.length, 8);

  const first = results[0];
  // The redirect wrapper must be unwrapped into the real destination.
  assert.equal(first.url, 'https://www.apple.com/shop/buy-iphone/iphone-15');
  assert.equal(first.site, 'apple.com');
  // Tags stripped, entities decoded, whitespace collapsed.
  assert.equal(first.title, 'Buy iPhone 15 - Apple');
  assert.match(first.snippet, /From \$799/);

  assert.equal(results[1].title, 'Apple iPhone 15 128GB Black – Amazon.com');
  assert.equal(results[1].site, 'amazon.com');
});

test('respects the result limit', () => {
  assert.equal(parseDuckDuckGoHtml(fixture, 3).length, 3);
});

test('parses US and EU number formats', () => {
  assert.equal(parseAmount('1,059.00'), 1059);
  assert.equal(parseAmount('1.299,99'), 1299.99);
  assert.equal(parseAmount('799'), 799);
  assert.equal(parseAmount('14.99'), 14.99);
  assert.equal(parseAmount('abc'), null);
  // Implausibly large values are model numbers, not prices.
  assert.equal(parseAmount('9,999,999'), null);
});

test('extracts only the requested currency', () => {
  assert.deepEqual(extractPrices('Buy new: $1,059.00 List Price: $1,199.00', 'USD'), [
    1059, 1199,
  ]);
  assert.deepEqual(extractPrices('Now £699.00 — save £100', 'USD'), []);
  // The trailing "save £100" is a discount, not a second asking price.
  assert.deepEqual(extractPrices('Now £699.00 — save £100', 'GBP'), [699]);
  assert.deepEqual(extractPrices('1.299,00 EUR today', 'EUR'), [1299]);
});

test('ignores financing installments', () => {
  // "From $799 or $33.29/mo." must read as $799, not the monthly payment.
  assert.deepEqual(extractPrices('From $799 or $33.29/mo. for 24 mo.', 'USD'), [799]);
  assert.deepEqual(extractPrices('$45 per month for 36 months', 'USD'), []);
});

test('ignores discounts, fees and struck-through prices', () => {
  assert.deepEqual(extractPrices('Now $899 — save $100', 'USD'), [899]);
  assert.deepEqual(extractPrices('$1,299 plus $25 shipping', 'USD'), [1299]);
  assert.deepEqual(extractPrices('Up to $200 off select models', 'USD'), []);
  assert.deepEqual(extractPrices('$729.99 (was $849.99)', 'USD'), [729.99]);
});

test('flags used and refurbished listings', () => {
  assert.equal(detectCondition('Pre-owned iPhone 15 from $525.00'), 'used');
  assert.equal(detectCondition('Refurbished MacBook Pro'), 'used');
  assert.equal(detectCondition('Open box, excellent condition'), 'used');
  assert.equal(detectCondition('Buy new: $1,059.00'), 'new');
});

test('names known retailers and falls back for unknown ones', () => {
  assert.equal(retailerName('amazon.com'), 'Amazon');
  assert.equal(retailerName('bhphotovideo.com'), 'B&H Photo');
  assert.equal(retailerName('some-shop.example'), 'Some-shop');
});

test('builds listings from results, taking the lowest price per page', () => {
  const results = parseDuckDuckGoHtml(fixture, 20);
  const listings = listingsFromResults(results, 'USD');

  // Wikipedia (no price) and Currys (GBP only) contribute nothing.
  const platforms = listings.map((l) => l.platform);
  assert.ok(!platforms.includes('Wikipedia'));
  assert.ok(!platforms.includes('Currys'));

  // Amazon's snippet has both $1,059 and a $1,199 list price; keep the lower.
  const amazon = listings.find((l) => l.platform === 'Amazon');
  assert.equal(amazon?.price, 1059);
  assert.equal(amazon?.condition, 'new');

  const ebay = listings.find((l) => l.platform === 'eBay');
  assert.equal(ebay?.price, 525);
  assert.equal(ebay?.condition, 'used');
});

test('drops accessory-priced outliers', () => {
  const results = parseDuckDuckGoHtml(fixture, 20);
  const listings = rejectOutliers(listingsFromResults(results, 'USD'));

  // The $14.99 phone case is far below the median and must not skew the average.
  assert.ok(!listings.some((l) => l.price === 14.99));
  assert.ok(listings.some((l) => l.price === 1059));
});

test('keeps the cheapest listing per platform and condition', () => {
  const listings = dedupeByPlatform([
    { platform: 'Amazon', price: 900, url: 'a', title: 't', condition: 'new' },
    { platform: 'Amazon', price: 850, url: 'b', title: 't', condition: 'new' },
    { platform: 'Amazon', price: 600, url: 'c', title: 't', condition: 'used' },
  ]);

  assert.equal(listings.length, 2);
  // Sorted cheapest first.
  assert.deepEqual(
    listings.map((l) => l.price),
    [600, 850]
  );
});

test('routes price questions to the scanner', () => {
  assert.equal(isPriceQuery('how much is an iPhone 15?'), true);
  assert.equal(isPriceQuery('what do people sell a PS5 for'), true);
  assert.equal(isPriceQuery('write me a haiku'), false);
});

test('routes fact questions to web search', () => {
  assert.equal(needsWebSearch('what is the latest news on framework laptops'), true);
  assert.equal(needsWebSearch('hello there'), false);
});

test('reduces a price question to the product name', () => {
  assert.equal(extractProductName('how much does an iPhone 15 Pro cost?'), 'iPhone 15 Pro');
  assert.equal(extractProductName("what's the price of a Steam Deck"), 'Steam Deck');
  assert.equal(extractProductName('scan MacBook Pro 16'), 'MacBook Pro 16');
});
