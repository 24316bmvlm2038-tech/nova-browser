/**
 * Stand-in for Reddit, Hacker News, Bluesky, Mastodon and Google News, so
 * /api/live can be driven end to end without network access. Point the app at
 * it by overriding each source's base URL is not supported, so this is used via
 * a fetch interceptor in tests/live-route.mjs rather than as a live server.
 *
 * Kept as a plain data module so both the route harness and any manual probing
 * share one set of fixtures.
 */

export const redditListing = {
  data: {
    children: [
      {
        data: {
          id: 'p1',
          title: 'Major outage takes down half the internet',
          permalink: '/r/technology/comments/p1/major_outage/',
          subreddit_name_prefixed: 'r/technology',
          author: 'netwatcher',
          ups: 48_200,
          num_comments: 3_100,
          created_utc: Math.floor(Date.now() / 1000) - 3600,
        },
      },
      {
        data: {
          id: 'p2',
          title: 'Scientists confirm new deep-sea species',
          permalink: '/r/science/comments/p2/new_species/',
          subreddit_name_prefixed: 'r/science',
          author: 'marinebio',
          ups: 12_400,
          num_comments: 640,
          created_utc: Math.floor(Date.now() / 1000) - 7200,
        },
      },
      {
        data: { id: 'p3', title: 'Pinned: rules', permalink: '/r/x/', stickied: true },
      },
    ],
  },
};

export const hnTopStories = [101, 102];

export const hnItems = {
  101: {
    id: 101,
    title: 'Show HN: I built a local-first search engine',
    url: 'https://example.dev/local-search',
    by: 'builder',
    score: 820,
    descendants: 210,
    time: Math.floor(Date.now() / 1000) - 5400,
  },
  102: {
    id: 102,
    title: 'Major outage takes down half the internet',
    url: 'https://status.example.com/incident',
    by: 'reporter',
    score: 640,
    descendants: 180,
    time: Math.floor(Date.now() / 1000) - 3000,
  },
};

export const blueskyFeed = {
  feed: [
    {
      post: {
        uri: 'at://did:plc:abc/app.bsky.feed.post/3k1',
        author: { handle: 'alice.bsky.social' },
        record: {
          text: 'Everything is down. Again. This is fine.',
          createdAt: new Date(Date.now() - 1_800_000).toISOString(),
        },
        likeCount: 2_400,
        repostCount: 810,
        replyCount: 96,
      },
    },
  ],
};

export const mastodonTrends = [
  {
    id: 'm1',
    url: 'https://mastodon.social/@bob/1',
    content: '<p>The outage is affecting DNS resolvers across three regions.</p>',
    created_at: new Date(Date.now() - 2_400_000).toISOString(),
    account: { acct: 'bob@mastodon.social' },
    reblogs_count: 340,
    favourites_count: 190,
    replies_count: 44,
  },
];

export const mastodonTags = [
  { name: 'outage', url: 'https://mastodon.social/tags/outage', history: [{ uses: '4210' }] },
  { name: 'dns', url: 'https://mastodon.social/tags/dns', history: [{ uses: '980' }] },
];

export const googleNewsXml = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Widespread internet outage hits major providers - Reuters</title>
<link>https://news.google.com/rss/articles/OUTAGE1</link>
<pubDate>${new Date(Date.now() - 1_200_000).toUTCString()}</pubDate></item>
<item><title>Regulators open inquiry into outage - AP News</title>
<link>https://news.google.com/rss/articles/OUTAGE2</link>
<pubDate>${new Date(Date.now() - 3_000_000).toUTCString()}</pubDate></item>
</channel></rss>`;

/** Route a request URL to the right fixture, mimicking each real endpoint. */
export const respondTo = (url) => {
  if (url.includes('reddit.com')) return { json: redditListing };
  if (url.includes('topstories.json')) return { json: hnTopStories };

  const hnItem = url.match(/\/item\/(\d+)\.json/);
  if (hnItem) return { json: hnItems[hnItem[1]] ?? null };

  if (url.includes('app.bsky.feed.getFeed')) return { json: blueskyFeed };
  if (url.includes('trends/statuses')) return { json: mastodonTrends };
  if (url.includes('trends/tags')) return { json: mastodonTags };
  if (url.includes('news.google.com')) return { text: googleNewsXml };

  return null;
};
