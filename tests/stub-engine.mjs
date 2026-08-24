/**
 * A stand-in search engine speaking SearXNG's JSON format, so the API routes
 * can be exercised end to end without hitting the network. Start it, point
 * SEARXNG_URL at it, and the app treats it as a real provider.
 */
import { createServer } from 'node:http';

const RESULTS = [
  {
    title: 'Buy iPhone 15 - Apple',
    url: 'https://www.apple.com/shop/buy-iphone/iphone-15',
    content: 'From $799 or $33.29/mo. for 24 mo.',
  },
  {
    title: 'Apple iPhone 15 128GB Black - Amazon.com',
    url: 'https://www.amazon.com/dp/B0CHX1W1XY',
    content: 'Buy new: $1,059.00  List Price: $1,199.00. FREE delivery.',
  },
  {
    title: 'iPhone 15 for sale - Used & Refurbished | eBay',
    url: 'https://www.ebay.com/b/Apple-iPhone-15',
    content: 'Pre-owned iPhone 15 from $525.00 with free shipping.',
  },
  {
    title: 'Apple - iPhone 15 - Best Buy',
    url: 'https://www.bestbuy.com/site/apple-iphone-15',
    content: 'Shop iPhone 15. Price $729.99 with activation today.',
  },
  {
    title: 'Buy Used iPhone 15 | Swappa',
    url: 'https://swappa.com/buy/apple-iphone-15',
    content: 'Used iPhone 15 starting at $480 - verified sellers.',
  },
  {
    title: 'Silicone Case for iPhone 15 - Target',
    url: 'https://www.target.com/p/case',
    content: 'Only $14.99 at Target.',
  },
  {
    title: 'iPhone 15 - Wikipedia',
    url: 'https://en.wikipedia.org/wiki/IPhone_15',
    content: 'The iPhone 15 is a smartphone developed by Apple Inc.',
  },
];

const port = Number(process.argv[2] ?? 8899);

createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (!url.pathname.endsWith('/search')) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ results: RESULTS }));
}).listen(port, () => console.log(`stub engine on :${port}`));
