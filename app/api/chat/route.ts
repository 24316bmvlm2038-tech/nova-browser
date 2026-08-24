import { NextResponse } from 'next/server';
import { webSearch } from '@/lib/search/providers';
import { DEFAULT_MODEL, generate, supportsTools } from '@/lib/ollamaServer';
import { runAgent } from '@/lib/agent';
import { needsWebSearch } from '@/lib/searchIntent';
import type { SearchResult } from '@/lib/search/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 90_000;
const CONTEXT_RESULTS = 6;

const SYSTEM_PROMPT = `You are Can Ai, a helpful assistant that can search the web, read live social and news feeds, and compare product prices.
Answer clearly and concisely. When search results are provided, base your answer on them and cite sources as [1], [2] matching the numbered results.
If the results do not answer the question, say so plainly rather than guessing.`;

/**
 * Chat with optional web grounding: search first, then hand the results to the
 * local model as context so answers cite real pages instead of recalled ones.
 */
export async function POST(request: Request) {
  let message: string;
  let model: string;
  let history: { role: string; content: string }[];
  let searchMode: 'auto' | 'always' | 'never';

  try {
    const body = await request.json();
    message = typeof body.message === 'string' ? body.message.trim() : '';
    model = typeof body.model === 'string' && body.model ? body.model : DEFAULT_MODEL;
    history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    searchMode = ['auto', 'always', 'never'].includes(body.searchMode)
      ? body.searchMode
      : 'auto';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: 'A "message" string is required' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // First choice: let the model pick its own tools. That is the difference
    // between reasoning about the request and pattern-matching it.
    if (searchMode !== 'never' && supportsTools(model)) {
      const agent = await runAgent(message, history, model, controller.signal);
      if (agent.usedTools && agent.reply) {
        return NextResponse.json({
          reply: agent.reply,
          model,
          searched: agent.runs.length > 0,
          searchError: null,
          toolRuns: agent.runs.map((run) => ({
            name: run.name,
            args: run.args,
            error: run.error ?? null,
            data: run.data ?? null,
          })),
          sources: citationsFrom(agent.runs),
        });
      }
    }

    // Fallback for models with no tool support: the keyword router.
    const shouldSearch =
      searchMode === 'always' ||
      (searchMode === 'auto' && needsWebSearch(message));

    let sources: SearchResult[] = [];
    let searchError: string | null = null;

    if (shouldSearch) {
      try {
        const { results } = await webSearch(message, {
          limit: CONTEXT_RESULTS,
          signal: controller.signal,
        });
        sources = results.slice(0, CONTEXT_RESULTS);
      } catch (error) {
        // A failed search shouldn't kill the reply — answer without grounding
        // and tell the caller the context is missing.
        searchError = error instanceof Error ? error.message : 'Search failed';
      }
    }

    const reply = await generate(
      buildPrompt(message, history, sources),
      model,
      controller.signal
    );

    return NextResponse.json({
      reply,
      model,
      searched: sources.length > 0,
      searchError,
      toolRuns: [],
      sources: sources.map((source, index) => ({
        index: index + 1,
        title: source.title,
        url: source.url,
        site: source.site,
      })),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json(
      { error: aborted ? 'The model took too long to respond' : message },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Pull citable pages out of whatever the model actually looked at. */
const citationsFrom = (runs: { data?: unknown }[]) => {
  const cites: { index: number; title: string; url: string; site: string }[] = [];

  for (const run of runs) {
    const payload = run.data as { results?: SearchResult[] } | null | undefined;
    for (const result of payload?.results ?? []) {
      if (cites.some((c) => c.url === result.url)) continue;
      cites.push({
        index: cites.length + 1,
        title: result.title,
        url: result.url,
        site: result.site,
      });
    }
  }

  return cites.slice(0, 6);
};

const buildPrompt = (
  message: string,
  history: { role: string; content: string }[],
  sources: SearchResult[]
): string => {
  const parts = [SYSTEM_PROMPT];

  if (sources.length > 0) {
    const context = sources
      .map(
        (source, index) =>
          `[${index + 1}] ${source.title} (${source.site})\n${source.snippet}`
      )
      .join('\n\n');
    parts.push(`Web search results:\n${context}`);
  }

  if (history.length > 0) {
    const transcript = history
      .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content}`)
      .join('\n');
    parts.push(`Conversation so far:\n${transcript}`);
  }

  parts.push(`User: ${message}\nAssistant:`);
  return parts.join('\n\n');
};
