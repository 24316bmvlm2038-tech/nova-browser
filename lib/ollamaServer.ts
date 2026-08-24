/**
 * Server-side Ollama client. The browser cannot call Ollama directly — it
 * rejects cross-origin requests from the app's origin unless OLLAMA_ORIGINS is
 * set — so every call is routed through the Next.js server on the same laptop.
 */
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');

export const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

export interface OllamaModel {
  name: string;
  size?: number;
}

export const listModels = async (signal?: AbortSignal): Promise<OllamaModel[]> => {
  const response = await fetch(`${OLLAMA_URL}/api/tags`, { signal });
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status} listing models`);
  }
  const data = await response.json();
  return (data.models ?? []).map((model: any) => ({
    name: model.name,
    size: model.size,
  }));
};

export const generate = async (
  prompt: string,
  model: string = DEFAULT_MODEL,
  signal?: AbortSignal
): Promise<string> => {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0.7, top_k: 40, top_p: 0.9 },
    }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Ollama returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`
    );
  }

  const data = await response.json();
  return (data.response ?? '').trim();
};
