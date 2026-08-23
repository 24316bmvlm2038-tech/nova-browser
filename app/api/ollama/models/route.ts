import { NextResponse } from 'next/server';
import { DEFAULT_MODEL, listModels } from '@/lib/ollamaServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Connection status + installed models, proxied so the browser avoids CORS. */
export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const models = await listModels(controller.signal);
    return NextResponse.json({
      connected: true,
      defaultModel: DEFAULT_MODEL,
      models: models.map((m) => m.name),
    });
  } catch (error) {
    // `fetch failed` on its own tells the user nothing — name the likely cause.
    const detail = error instanceof Error ? error.message : String(error);
    const unreachable = /fetch failed|ECONNREFUSED|abort/i.test(detail);
    return NextResponse.json({
      connected: false,
      defaultModel: DEFAULT_MODEL,
      models: [],
      error: unreachable
        ? 'Could not reach Ollama. Start it with `ollama serve`.'
        : detail,
    });
  } finally {
    clearTimeout(timeout);
  }
}
