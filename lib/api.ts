import type {
  AccountUser,
  Citation,
  GeneratedImage,
  LiveDigest,
  PriceData,
  ScannerConfig,
  SourceInfo,
} from '@/store/useChatStore';

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

/** Trending across live sources, or a cross-source search when `query` is set. */
export const fetchLive = (
  query: string | undefined,
  sources: string[],
  limit = 18,
  withImages = false
): Promise<LiveDigest> =>
  postJson<LiveDigest>('/api/live', {
    query: query || undefined,
    sources: sources.length > 0 ? sources : undefined,
    limit,
    withImages,
  });

export const fetchLiveSources = async (): Promise<SourceInfo[]> => {
  try {
    const response = await fetch('/api/live');
    if (!response.ok) return [];
    const data = await response.json();
    return (data.sources ?? []) as SourceInfo[];
  } catch {
    return [];
  }
};

/* ------------------------------- auth ---------------------------------- */

export interface AuthMeta {
  user: AccountUser | null;
  providers: { google: boolean; emailDelivery: 'email' | 'console' };
}

export const fetchAuth = async (): Promise<AuthMeta> => {
  try {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    return (await response.json()) as AuthMeta;
  } catch {
    return { user: null, providers: { google: false, emailDelivery: 'console' } };
  }
};

/** Signup and login share a shape: either a session, or a pending code step. */
export type AuthOutcome =
  | { user: AccountUser }
  | { step: 'verify'; email: string; delivery: 'email' | 'console'; deliveryError: string | null };

export const signUp = (
  name: string,
  email: string,
  password: string,
  acceptedTerms: boolean
) => postJson<AuthOutcome>('/api/auth/signup', { name, email, password, acceptedTerms });

export const logIn = (email: string, password: string) =>
  postJson<AuthOutcome>('/api/auth/login', { email, password });

export const verifyEmail = (email: string, code: string) =>
  postJson<{ user: AccountUser }>('/api/auth/verify', { email, code });

export const resendCode = (email: string) =>
  postJson<{ sent: boolean; delivery: 'email' | 'console' }>('/api/auth/resend', { email });

export const logOut = () => postJson<{ ok: boolean }>('/api/auth/logout', {});

/* ------------------------------- images -------------------------------- */

export const generateImage = (prompt: string, size: '512' | '768' | '1024' = '768') =>
  postJson<GeneratedImage>('/api/image', { prompt, size });

export interface ImageProviderInfo {
  id: string;
  label: string;
  local: boolean;
  configured: boolean;
}

export const fetchImageProviders = async (): Promise<ImageProviderInfo[]> => {
  try {
    const response = await fetch('/api/image');
    if (!response.ok) return [];
    return ((await response.json()).providers ?? []) as ImageProviderInfo[];
  } catch {
    return [];
  }
};

/* ------------------------------- vision -------------------------------- */

export const identifyPhoto = (image: string) =>
  postJson<{ name: string; model: string }>('/api/vision', { image });

export const fetchVisionStatus = async (): Promise<{
  available: boolean;
  model: string | null;
  suggested: string;
}> => {
  try {
    const response = await fetch('/api/vision');
    return await response.json();
  } catch {
    return { available: false, model: null, suggested: 'llama3.2-vision' };
  }
};

export interface WebSearchResponse {
  query: string;
  provider: string;
  results: { title: string; url: string; snippet: string; site: string }[];
}

export const webSearch = (query: string, limit = 10): Promise<WebSearchResponse> =>
  postJson<WebSearchResponse>('/api/search', { query, limit });
