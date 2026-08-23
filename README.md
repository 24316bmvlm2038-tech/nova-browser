# Nova

A ChatGPT-style chat app that runs entirely on your laptop. It searches the live
web, and when you ask what something costs it scans real listings and shows you
what sellers are asking — new and used, side by side, with links.

The model is [Ollama](https://ollama.ai) running locally. Nothing is sent to a
hosted AI service.

## What it does

- **Normal chat** — ask anything, answered by your local model.
- **Grounded answers** — when a question needs current facts, it searches the web
  first and cites the pages it used.
- **Price scanning** — "how much is a Steam Deck?" or "what do people sell a PS5
  for?" runs two searches (retail and second-hand), pulls prices out of the
  results, and shows a comparison card with links to each seller.
- **Customisable** — model, search behaviour, currency, new/used filters, and how
  many sellers to show, all in Settings and all held in a Zustand store.

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

Open http://localhost:3000. The dot next to "Nova" turns green when Ollama is
reachable — click it to re-check.

That's it. Search works with no API key and no extra config.

### 3. Optional: a better search backend

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
| `POST /api/chat` | Searches if needed, prompts Ollama with the results, returns the reply plus citations |
| `POST /api/scan` | Runs retail + second-hand searches, extracts prices, returns a comparison |
| `POST /api/search` | Raw web search |
| `GET /api/ollama/models` | Connection status and installed models |

```
lib/
  search/providers.ts  DuckDuckGo / Brave / Serper / SearXNG behind one interface
  search/html.ts       entity decoding and tag stripping for scraped markup
  priceExtract.ts      pulls prices out of result text, filters the noise
  searchIntent.ts      routes a message to chat / search / price scan
  ollamaServer.ts      server-side Ollama client
  api.ts               browser-side client for the routes above
store/useChatStore.ts  Zustand: messages, config, connection state
```

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

14 tests covering the HTML parser, price extraction, and intent routing, run
against a fixture of real search markup.

To exercise the API routes without hitting the network, run the stub engine:

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

## Troubleshooting

**Dot stays red** — Ollama isn't running. `ollama serve`, then click the dot.
Check `curl http://127.0.0.1:11434/api/tags` returns JSON.

**"Could not reach Ollama"** — you have Ollama but no models. `ollama pull llama3.2`.

**Search returns 403 or 202** — DuckDuckGo is rate limiting you. Wait a few
minutes, or set a `SERPER_API_KEY`.

**"none listed a USD price"** — the results had no prices in your currency. Try a
more specific product name, or check the currency in Settings.

**Slow replies** — the first message after starting Ollama loads the model into
RAM. Later ones are faster. On 8GB, `llama3.2` or `phi3` are comfortable;
larger models will swap.

## Adding a real product API

`lib/search/providers.ts` defines a `SearchProvider` interface — `isConfigured()`
and `search()`. Add an eBay or Amazon Product Advertising client there and it
plugs into the scan route with no other changes.
