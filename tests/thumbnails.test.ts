import assert from 'node:assert/strict';
import test from 'node:test';

import { extractOgImage } from '../lib/live/thumbnails';

const PAGE = 'https://www.example-news.com/world/2026/08/story.html';

test('reads a plain og:image', () => {
  assert.equal(
    extractOgImage(
      '<meta property="og:image" content="https://cdn.example-news.com/hero.jpg">',
      PAGE
    ),
    'https://cdn.example-news.com/hero.jpg'
  );
});

test('reads og:image when content comes before property', () => {
  // Reuters and others emit the attributes in this order.
  assert.equal(
    extractOgImage(
      '<meta content="https://cdn.example-news.com/a.jpg" property="og:image"/>',
      PAGE
    ),
    'https://cdn.example-news.com/a.jpg'
  );
});

test('accepts og:image:secure_url', () => {
  assert.equal(
    extractOgImage(
      '<meta property="og:image:secure_url" content="https://cdn.example-news.com/s.jpg">',
      PAGE
    ),
    'https://cdn.example-news.com/s.jpg'
  );
});

test('falls back to twitter:image, then image_src', () => {
  assert.equal(
    extractOgImage('<meta name="twitter:image" content="https://cdn.x.com/t.jpg">', PAGE),
    'https://cdn.x.com/t.jpg'
  );
  assert.equal(
    extractOgImage('<meta name="twitter:image:src" content="https://cdn.x.com/ts.jpg">', PAGE),
    'https://cdn.x.com/ts.jpg'
  );
  assert.equal(
    extractOgImage('<link rel="image_src" href="https://cdn.x.com/l.jpg">', PAGE),
    'https://cdn.x.com/l.jpg'
  );
});

test('prefers og:image over the fallbacks', () => {
  const html = `
    <meta name="twitter:image" content="https://cdn.example-news.com/twitter.jpg">
    <meta property="og:image" content="https://cdn.example-news.com/og.jpg">
  `;
  assert.equal(extractOgImage(html, PAGE), 'https://cdn.example-news.com/og.jpg');
});

test('resolves protocol-relative and root-relative URLs against the article', () => {
  assert.equal(
    extractOgImage('<meta property="og:image" content="//cdn.example-news.com/p.jpg">', PAGE),
    'https://cdn.example-news.com/p.jpg'
  );
  assert.equal(
    extractOgImage('<meta property="og:image" content="/img/hero.jpg">', PAGE),
    'https://www.example-news.com/img/hero.jpg'
  );
  // Relative to the article's directory.
  assert.equal(
    extractOgImage('<meta property="og:image" content="hero.jpg">', PAGE),
    'https://www.example-news.com/world/2026/08/hero.jpg'
  );
});

test('decodes entities in the URL', () => {
  assert.equal(
    extractOgImage(
      '<meta property="og:image" content="https://cdn.x.com/i.jpg?w=800&amp;h=600&amp;fit=crop">',
      PAGE
    ),
    'https://cdn.x.com/i.jpg?w=800&h=600&fit=crop'
  );
});

test('handles single quotes and extra attributes', () => {
  assert.equal(
    extractOgImage(
      "<meta data-rh='true' property='og:image' content='https://cdn.x.com/q.jpg' />",
      PAGE
    ),
    'https://cdn.x.com/q.jpg'
  );
});

test('ignores non-http schemes', () => {
  // Some CMSes emit a data: placeholder; hotlinking that is pointless.
  assert.equal(
    extractOgImage(
      '<meta property="og:image" content="data:image/gif;base64,R0lGODlhAQAB">',
      PAGE
    ),
    null
  );
});

test('returns null when there is no image at all', () => {
  assert.equal(extractOgImage('<html><head><title>No image</title></head>', PAGE), null);
  assert.equal(extractOgImage('', PAGE), null);
});

test('skips an empty content attribute rather than returning the page URL', () => {
  assert.equal(extractOgImage('<meta property="og:image" content="">', PAGE), null);
});

test('reads a realistic publisher head', () => {
  // Shaped like a real article: og:image sits among many other meta tags.
  const html = `<!DOCTYPE html><html lang="en"><head>
    <meta charset="utf-8">
    <title>Central bank holds rates steady — Example News</title>
    <meta name="description" content="The decision was widely expected.">
    <meta property="og:type" content="article">
    <meta property="og:title" content="Central bank holds rates steady">
    <meta property="og:url" content="${PAGE}">
    <meta property="og:image" content="https://cdn.example-news.com/2026/08/rates-1024x576.jpg">
    <meta property="og:image:width" content="1024">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="canonical" href="${PAGE}">
  </head><body><p>…</p></body></html>`;

  assert.equal(
    extractOgImage(html, PAGE),
    'https://cdn.example-news.com/2026/08/rates-1024x576.jpg'
  );
});
