import { webSearch } from './search/providers';
import { gather } from './live';
import {
  dedupeByPlatform,
  listingsFromResults,
  rejectOutliers,
} from './priceExtract';
import { chat, supportsTools, type ChatMessage, type ToolSpec } from './ollamaServer';

/**
 * Tool-calling loop.
 *
 * Previously the app decided what to do by pattern-matching the message
 * ("draw" → image, "how much" → price scan). That works for phrasings it was
 * written for and silently mishandles everything else. Here the model is given
 * the tools and decides for itself, which is the difference between a router
 * and something that can reason about the request.
 *
 * Models that can't do tool calls fall back to the keyword router.
 */

export const TOOLS: ToolSpec[] = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description:
        'Search the public web for current facts, documentation, reviews or anything you are unsure about. Use whenever the answer depends on information after your training cutoff, or on specifics you might get wrong.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search terms to send.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trending',
      description:
        "Read what is being posted and discussed right now on Reddit, Hacker News, Bluesky, Mastodon and Google News. Use for 'what's happening', breaking news, or reactions to an event. Far fresher than a web search.",
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description:
              'Optional topic to filter by. Leave empty for a general digest of everything trending.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scan_prices',
      description:
        'Find what sellers are asking for a product, new and second-hand, across retailers and marketplaces. Use for any question about cost, price, value or where to buy something.',
      parameters: {
        type: 'object',
        properties: {
          product: {
            type: 'string',
            description: 'The product name, as specific as possible (brand and model).',
          },
        },
        required: ['product'],
      },
    },
  },
];

export interface ToolRun {
  name: string;
  args: Record<string, unknown>;
  /** Compact text handed back to the model. */
  result: string;
  /** Structured payload for the UI to render as a card. */
  data?: unknown;
  error?: string;
}

const runTool = async (
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal
): Promise<ToolRun> => {
  try {
    if (name === 'search_web') {
      const query = String(args.query ?? '').trim();
      if (!query) throw new Error('no query given');
      const { results, provider } = await webSearch(query, { limit: 6, signal });
      return {
        name,
        args,
        result:
          results.length === 0
            ? 'No results.'
            : results
                .map((r, i) => `[${i + 1}] ${r.title} (${r.site})\n${r.snippet}`)
                .join('\n\n'),
        data: { provider, results },
      };
    }

    if (name === 'get_trending') {
      const topic = String(args.topic ?? '').trim();
      const digest = await gather({ query: topic || undefined, limit: 14, signal });
      return {
        name,
        args,
        result:
          digest.items.length === 0
            ? 'Nothing on the live feeds right now.'
            : digest.items
                .map((item) => `[${item.source}] ${item.title}`)
                .join('\n'),
        data: digest,
      };
    }

    if (name === 'scan_prices') {
      const product = String(args.product ?? '').trim();
      if (!product) throw new Error('no product given');

      const searches = await Promise.allSettled([
        webSearch(`${product} price buy`, { limit: 15, signal }),
        webSearch(`${product} used refurbished for sale price`, { limit: 15, signal }),
      ]);
      const results = searches.flatMap((s) =>
        s.status === 'fulfilled' ? s.value.results : []
      );

      const listings = dedupeByPlatform(
        rejectOutliers(listingsFromResults(results, 'USD'))
      );
      if (listings.length === 0) {
        return { name, args, result: `No USD prices found for "${product}".` };
      }

      const prices = listings.map((l) => l.price);
      const average = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      return {
        name,
        args,
        result: listings
          .map((l) => `${l.platform} (${l.condition}): $${l.price}`)
          .join('\n'),
        data: {
          itemName: product,
          currency: 'USD',
          provider: 'web',
          resultsSearched: results.length,
          sources: listings.slice(0, 6),
          averagePrice: average,
          lowestPrice: Math.min(...prices),
          highestPrice: Math.max(...prices),
          newPrice: avgOf(listings, 'new'),
          usedPrice: avgOf(listings, 'used'),
          currentPrice: average,
        },
      };
    }

    return { name, args, result: `Unknown tool "${name}".`, error: 'unknown tool' };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'tool failed';
    // Report failure to the model as a result rather than throwing — it can
    // then say so, or try a different approach, instead of the turn dying.
    return { name, args, result: `That tool failed: ${reason}`, error: reason };
  }
};

const avgOf = (
  listings: { price: number; condition: string }[],
  condition: string
): number => {
  const matching = listings.filter((l) => l.condition === condition);
  if (matching.length === 0) return 0;
  return Math.round(
    matching.reduce((sum, l) => sum + l.price, 0) / matching.length
  );
};

export interface AgentResult {
  reply: string;
  runs: ToolRun[];
  /** False when the model can't do tool calls and the caller should fall back. */
  usedTools: boolean;
}

const SYSTEM = `You are Can Ai, a helpful assistant running on the user's own computer.

You have tools for searching the web, reading live social and news feeds, and finding product prices. Use them whenever the answer depends on current information, specific facts, or anything you might get wrong from memory — do not guess when a tool can tell you.

For ordinary conversation, opinions, writing and reasoning, just answer directly without calling anything.

When you have used a tool, base your answer only on what it returned, and say plainly if it did not answer the question. Be concise.`;

/** How many times the model may call tools before it must answer. */
const MAX_STEPS = 3;

export const runAgent = async (
  message: string,
  history: { role: string; content: string }[],
  model: string,
  signal?: AbortSignal
): Promise<AgentResult> => {
  if (!supportsTools(model)) {
    return { reply: '', runs: [], usedTools: false };
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM },
    ...history.map((turn) => ({
      role: turn.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: turn.content,
    })),
    { role: 'user', content: message },
  ];

  const runs: ToolRun[] = [];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const answer = await chat(messages, model, TOOLS, signal);

    const calls = answer.tool_calls ?? [];
    if (calls.length === 0) {
      return { reply: (answer.content ?? '').trim(), runs, usedTools: true };
    }

    messages.push(answer);

    for (const call of calls) {
      const run = await runTool(
        call.function.name,
        call.function.arguments ?? {},
        signal
      );
      runs.push(run);
      messages.push({
        role: 'tool',
        tool_name: run.name,
        content: run.result.slice(0, 6000),
      });
    }
  }

  // Out of steps: ask for a final answer with no tools available.
  const final = await chat(
    [...messages, { role: 'user', content: 'Answer now using what you have.' }],
    model,
    undefined,
    signal
  );
  return { reply: (final.content ?? '').trim(), runs, usedTools: true };
};
