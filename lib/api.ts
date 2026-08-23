import type { Citation, PriceData, ScannerConfig } from '@/store/useChatStore';

/**
 * Browser-side client for the app's own API routes. Nothing here talks to
 * Ollama or a search engine directly — those calls happen on the Next.js
 * server so the browser is never blocked by CORS and keys stay server side.
 */

export class ApiError extends Error {}

const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error || `Request failed (${response.status})`);
  }
  return data as T;
};

export interface OllamaStatus {
  connected: boolean;
  models: string[];
  defaultModel: string;
  error?: string;
}

export const fetchOllamaStatus = async (): Promise<OllamaStatus> => {
  try {
    const response = await fetch('/api/ollama/models');
    return (await response.json()) as OllamaStatus;
  } catch (error) {
    return {
      connected: false,
      models: [],
      defaultModel: '',
      error: error instanceof Error ? error.message : 'Could not reach the server',
    };
  }
};

export interface ChatReply {
  reply: string;
  model: string;
  searched: boolean;
  searchError: string | null;
  sources: Citation[];
}

export const sendChat = (
  message: string,
  model: string,
  history: { role: string; content: string }[],
  searchMode: ScannerConfig['searchMode']
): Promise<ChatReply> =>
  postJson<ChatReply>('/api/chat', { message, model, history, searchMode });

interface ScanResponse extends Omit<PriceData, 'timestamp'> {}

export const scanPrice = async (
  item: string,
  config: ScannerConfig
): Promise<PriceData> => {
  const data = await postJson<ScanResponse>('/api/scan', {
    item,
    currency: config.currency,
    maxResults: config.maxResults,
  });

  const sources = data.sources.filter(
    (source) =>
      (source.condition === 'new' && config.showNewItems) ||
      (source.condition === 'used' && config.showUsedItems)
  );

  return { ...data, sources, timestamp: new Date() };
};

export interface WebSearchResponse {
  query: string;
  provider: string;
  results: { title: string; url: string; snippet: string; site: string }[];
}

export const webSearch = (query: string, limit = 10): Promise<WebSearchResponse> =>
  postJson<WebSearchResponse>('/api/search', { query, limit });
