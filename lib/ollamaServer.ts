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

/** Models that can read an image. Ollama rejects `images` on text-only models. */
export const VISION_MODEL_PATTERN =
  /^(llava|llama3\.2-vision|llama3-vision|bakllava|moondream|minicpm-v|qwen2?-vl|granite3\.2-vision|gemma3)/i;

export const DEFAULT_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision';

/** Pick an installed vision model, preferring the configured one. */
export const pickVisionModel = (installed: string[]): string | null => {
  if (installed.includes(DEFAULT_VISION_MODEL)) return DEFAULT_VISION_MODEL;
  // Tags vary (llava:13b, llava:latest), so match on the family prefix.
  return installed.find((name) => VISION_MODEL_PATTERN.test(name)) ?? null;
};

export interface ToolSpec {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[];
  tool_name?: string;
}

/** Models known to support Ollama's tool-calling API. */
const TOOL_CAPABLE =
  /^(llama3\.[123]|llama3\.[123]:|qwen2\.5|qwen3|mistral|mistral-nemo|firefunction|command-r|hermes3|deepseek-r1|granite3|smollm2)/i;

export const supportsTools = (model: string): boolean => TOOL_CAPABLE.test(model);

/**
 * The /api/chat endpoint, which unlike /api/generate accepts a tool manifest
 * and can answer with a tool call instead of prose. This is what lets the model
 * decide to search rather than the app guessing from keywords.
 */
export const chat = async (
  messages: ChatMessage[],
  model: string = DEFAULT_MODEL,
  tools?: ToolSpec[],
  signal?: AbortSignal
): Promise<ChatMessage> => {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...(tools && tools.length > 0 ? { tools } : {}),
      options: { temperature: 0.6, top_p: 0.9 },
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
  return (data.message ?? { role: 'assistant', content: '' }) as ChatMessage;
};

export const generate = async (
  prompt: string,
  model: string = DEFAULT_MODEL,
  signal?: AbortSignal,
  /** Base64 image data (no data: prefix) for a vision model. */
  images?: string[]
): Promise<string> => {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      ...(images && images.length > 0 ? { images } : {}),
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
