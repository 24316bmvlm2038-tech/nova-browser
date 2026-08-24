# Can Ai

A ChatGPT-style chat app that runs entirely on your laptop. It reads live social
and news feeds, searches the web, and when you ask what something costs it scans
real listings and shows what sellers are asking — new and used, with links.

The model is [Ollama](https://ollama.ai) running locally. Nothing is sent to a
hosted AI service.

## What it does

- **Four tabs** — Chat, News, Scan, Profile, on a bottom nav.
- **Camera scanning** — point your phone at a product; a local vision model
  names it and the app prices it. Photos never leave your machine.
- **News with pictures** — headlines carry the publisher's own image, pulled
  from each article's Open Graph tags.
- **Accounts** — sign up with name + email + password and confirm a real 6-digit
  emailed code, or continue with Google. Sessions are httpOnly cookies.
- **Normal chat** — ask anything, answered by your local model.
- **Image generation** — "draw a fox asleep in falling snow" renders through a
  local Stable Diffusion server, or Replicate if you'd rather not run one.
- **What's trending** — "what's happening right now?" pulls live posts from
  Reddit, Hacker News, Bluesky, Mastodon and Google News, merges them, and shows
  a ranked feed with trending hashtags.
- **Grounded answers** — when a question needs current facts, it searches the web
  first and cites the pages it used.
- **Price scanning** — "how much is a Steam Deck?" or "what do people sell a PS5
  for?" runs two searches (retail and second-hand), pulls prices out of the
  results, and shows a comparison card with links to each seller.
- **Customisable** — model, search behaviour, which live sources to use,
  currency, new/used filters, all in Settings and all held in a Zustand store.

## Live sources

| Source | Key needed | Trending | Search |
|---|---|---|---|
| Reddit | no | r/popular | yes |
| Hacker News | no | top stories | yes |
| Bluesky | no | What's Hot | yes |
| Mastodon | no | trends + hashtags | by hashtag |
| Google News | no | top stories | yes |
| YouTube | `YOUTUBE_API_KEY` | most popular | yes |

**Not included, and why.** X/Twitter's API starts at $100/month with no free read
tier. Instagram, TikTok and Facebook have no public read API, and scraping them
breaks their terms of service. Rather than ship something that silently returns
nothing, those are left out. Big stories from those platforms still surface here
second-hand, since Reddit and news outlets cover them.

Adding a source is one file implementing the `LiveSource` interface in
`lib/live/sources/`, then one line in `lib/live/index.ts`. If you have paid X API
access, that's where it goes.

## Setup

### 1. Install and start Ollama

```bash
# macOS: download from https://ollama.ai/download
# Linux:
curl -fsSL https://ollama.ai/install.sh | sh

ollama pull llama3.2     # ~2GB, good default
ollama serve
```

### 2. Run the app

```bash
npm install
npm run dev
```

Open http://localhost:3000 and create an account. Your verification code is
printed in the terminal running the app until you configure SMTP — it's a real
code either way, just delivered to your console instead of your inbox.

Search and all five live feeds work with no API key and no config.

### 3. Optional: real emails and Google sign-in

Both are off until you configure them. The Google button stays disabled rather
than sending you at a broken redirect, and the login screen tells you where
codes are going.

**Emailed codes** — any SMTP account. For Gmail, create an App Password (needs
2FA on); your normal password won't work:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-16-char-app-password
```

**Google sign-in** — in the [Google Cloud console](https://console.cloud.google.com),
create an OAuth client ID of type *Web application*, and add this exact redirect URI:

```
http://localhost:3000/api/auth/google/callback
```

Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

### 4. Optional: camera scanning

The Scan tab can photograph a product and identify it. That needs a vision model:

```bash
ollama pull llama3.2-vision   # or: llava, or moondream for something small
```

**On iPhone**, Safari only exposes the camera over HTTPS or on localhost. To scan
from your phone, put the app behind HTTPS — the quickest way is a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Then open the https URL it prints, and add it to your home screen for a
fullscreen app with no Safari chrome.

### 5. Optional: image generation

Either run [Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
with `--api` (found automatically on port 7860, costs nothing, prompts never
leave the machine), or set `REPLICATE_API_TOKEN` for a hosted fallback.

### 6. Optional: a better search backend

DuckDuckGo is the default because it needs no key, but it's scraped and gets rate
limited. For heavier use, copy `.env.example` to `.env.local` and set one key:

| Provider | Free tier | Env var |
|---|---|---|
| [Serper.dev](https://serper.dev) | 2,500 credits | `SERPER_API_KEY` |
| [Brave Search](https://brave.com/search/api/) | 2,000/month | `BRAVE_SEARCH_API_KEY` |
| [SearXNG](https://docs.searxng.org) (self-hosted) | unlimited | `SEARXNG_URL` |

Serper gives the best price results — it returns a dedicated shopping block.
The app picks up whichever you configure automatically.

## How it fits together

```
Browser ──► Next.js API routes (your laptop) ──► Ollama  (127.0.0.1:11434)
                                            └─► Search provider (web)
```

Every outbound call goes through the server, never the browser. That matters for
two reasons: Ollama rejects cross-origin browser requests unless you set
`OLLAMA_ORIGINS`, and API keys never reach the client bundle.

| Route | Does |
|---|---|
| `POST /api/auth/signup` | name + email + password, issues a code |
| `POST /api/auth/verify` | checks the code, starts a session |
| `POST /api/auth/login` | email + password |
| `POST /api/auth/resend` | new code, throttled to 1/minute |
| `GET /api/auth/google` → `/callback` | real OAuth 2.0 with PKCE |
| `GET /api/auth/me` · `POST /api/auth/logout` | session state |
| `POST /api/image` | generates an image (signed in only) |
| `POST /api/vision` | names the product in a photo (signed in only) |
| `POST /api/chat` | Searches if needed, prompts Ollama with the results, returns the reply plus citations |
| `POST /api/live` | Trending across live sources, or a cross-source search for a topic |
| `GET /api/live` | Which sources exist and which are usable right now |
| `POST /api/scan` | Runs retail + second-hand searches, extracts prices, returns a comparison |
| `POST /api/search` | Raw web search |
| `GET /api/ollama/models` | Connection status and installed models |

```
lib/
  auth/db.ts           SQLite: users, sessions, verification codes
  auth/password.ts     scrypt hashing (node:crypto, no native dep)
  auth/session.ts      httpOnly cookie sessions, tokens stored hashed
  auth/codes.ts        6-digit codes: single-use, expiring, attempt-limited
  auth/google.ts       OAuth 2.0 + PKCE
  images/providers.ts  Stable Diffusion / ComfyUI / Replicate behind one interface
  live/thumbnails.ts   og:image extraction for news pictures, cached and bounded
  legal.ts             Terms, Privacy and Cookie text in one place
  live/index.ts        fans out across sources, dedupes, ranks, interleaves
  live/sources/*.ts    one adapter per platform, all behind LiveSource
  live/rss.ts          minimal RSS/Atom parser for news feeds
  search/providers.ts  DuckDuckGo / Brave / Serper / SearXNG behind one interface
  search/html.ts       entity decoding and tag stripping for scraped markup
  priceExtract.ts      pulls prices out of result text, filters the noise
  searchIntent.ts      routes a message to trending / price scan / search / chat
  ollamaServer.ts      server-side Ollama client
  api.ts               browser-side client for the routes above
store/useChatStore.ts  Zustand: messages, config, connection state
```

A message is routed in that order — trending first, because a search engine's
index lags hours behind these feeds, so "what's happening" belongs on the live
sources rather than `/api/search`.

## Merging feeds that don't agree on numbers

A Reddit post with 30,000 upvotes and a Mastodon post with 20 boosts both mean
"top of that feed", so raw scores can't be compared. `lib/live/index.ts`:

- **Ranks within each source first** — an item's position in its own feed becomes
  its score, blended 60/40 with recency, so one high-volume platform can't crowd
  out the rest.
- **Interleaves** — takes from each source in turn, so the top of the digest shows
  a spread of platforms rather than five Reddit posts.
- **Dedupes by URL**, ignoring `utm_*` params and trailing slashes, keeping the
  copy with more engagement.
- **Isolates failures** — sources are fetched in parallel and a broken one is
  reported by name in the card footer instead of sinking the whole digest.

## Getting prices out of search results

This is the part that does the real work. Result snippets are messy, so
`lib/priceExtract.ts` filters aggressively:

- **Financing** — "From $799 or $33.29/mo." reads as $799, not $33.29.
- **Discounts and fees** — "save $100", "$25 shipping", "was $849" are skipped.
- **Wrong currency** — a USD scan ignores £ and € listings entirely.
- **Accessories** — a $14.99 phone case in results for a $799 phone is dropped as
  an outlier (anything below 15% or above 4× the median).
- **Condition** — "pre-owned", "refurbished", "open box" mark a listing as used,
  so new and used get averaged separately.
- **Duplicates** — one listing per retailer per condition, the cheapest.

Both US (`1,059.00`) and European (`1.299,99`) number formats parse correctly.

**These are asking prices scraped from search results, not verified offers.**
Treat them as a ballpark and click through before buying.

## Tests

```bash
npm test
```

42 tests over the HTML and RSS parsers, price extraction, feed merging, intent
routing, and the auth primitives — password hashing, code issue/verify, attempt
limits, expiry and resend throttling.

`tests/gather.test.ts` intercepts `fetch` to run the whole live pipeline — every
source adapter, dedupe, ranking, interleaving, and failure isolation — against
fixtures, with only the network hop stubbed.

To exercise the search routes over HTTP, run the stub engine:

```bash
npm run stub-engine                                    # terminal 1
SEARCH_PROVIDER=searxng SEARXNG_URL=http://127.0.0.1:8899 npm run dev   # terminal 2
```

## Configuration

All optional — see `.env.example`.

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Where Ollama listens |
| `OLLAMA_MODEL` | `llama3.2` | Fallback model |
| `SEARCH_PROVIDER` | auto | Force `duckduckgo`/`brave`/`serper`/`searxng` |
| `SERPER_API_KEY` | — | Serper.dev key |
| `BRAVE_SEARCH_API_KEY` | — | Brave Search key |
| `SEARXNG_URL` | — | Your SearXNG instance |
| `MASTODON_INSTANCE` | `mastodon.social` | Whose Mastodon trends to read |
| `NEWS_COUNTRY` / `NEWS_LANGUAGE` | `US` / `en-US` | Region for news and YouTube |
| `YOUTUBE_API_KEY` | — | Enables the YouTube source |
| `SMTP_*` | — | Emails verification codes instead of printing them |
| `GOOGLE_CLIENT_ID` / `SECRET` | — | Enables Google sign-in |
| `SD_WEBUI_URL` | `127.0.0.1:7860` | Local Stable Diffusion |
| `REPLICATE_API_TOKEN` | — | Hosted image generation |
| `DATABASE_PATH` | `.data/can-ai.db` | Account store |

## Troubleshooting

**Dot stays red** — Ollama isn't running. `ollama serve`, then click the dot.
Check `curl http://127.0.0.1:11434/api/tags` returns JSON.

**"Could not reach Ollama"** — you have Ollama but no models. `ollama pull llama3.2`.

**Search returns 403 or 202** — DuckDuckGo is rate limiting you. Wait a few
minutes, or set a `SERPER_API_KEY`.

**"none listed a USD price"** — the results had no prices in your currency. Try a
more specific product name, or check the currency in Settings.

**"No image generator is reachable"** — nothing is running on port 7860. Start
Stable Diffusion WebUI with `--api`, or set `REPLICATE_API_TOKEN`.

**Verification code never arrives** — with no SMTP configured it's in your
terminal, not your inbox. With SMTP configured and a Gmail account, check you
used an App Password rather than your login password.

**Google sign-in says "redirect_uri_mismatch"** — the URI in the Google console
must match `APP_URL` exactly, including the port and the `/api/auth/google/callback`
path.

**A source shows as unavailable in the trending card** — Reddit rate limits by IP
and returns 429 if you refresh hard; it recovers on its own in a few minutes. The
other four are steadier. Turn any source off in Settings if it's noisy.

**Slow replies** — the first message after starting Ollama loads the model into
RAM. Later ones are faster. On 8GB, `llama3.2` or `phi3` are comfortable;
larger models will swap.

## Adding a real product API

`lib/search/providers.ts` defines a `SearchProvider` interface — `isConfigured()`
and `search()`. Add an eBay or Amazon Product Advertising client there and it
plugs into the scan route with no other changes.

## Account security

- Passwords are hashed with scrypt (N=2^15) and a per-user salt, never stored or
  logged in plaintext.
- Session tokens are 256-bit random values; only their SHA-256 is stored, so a
  copied database file yields no usable sessions. The cookie is httpOnly, so
  page JavaScript can never read it.
- Verification codes come from `crypto.randomInt`, are stored hashed, expire in
  15 minutes, are single-use, and are burned after 5 wrong attempts.
- Login answers identically for a wrong password and an unknown address, so the
  endpoint can't be used to discover which emails have accounts.
- Google sign-in uses PKCE and a state cookie, so an intercepted authorization
  code is unusable and a forged callback is rejected.

The database sits at `.data/can-ai.db` and is gitignored.

## Legal

Terms of Service, Privacy Policy and a Cookie Policy live in `lib/legal.ts` and
are reachable from the login screen, the Profile tab, and a first-run notice.
Accepting them is required to create an account, and the version accepted is
stored on the user row.

They are written to describe what this code actually does — everything local, no
analytics, one session cookie. That makes them accurate, not authoritative: have
a lawyer review them before you distribute the app to other people.
