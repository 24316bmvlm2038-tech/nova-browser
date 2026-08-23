export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Hostname the result came from, e.g. "amazon.com" */
  site: string;
}

export interface SearchOptions {
  /** Max results to return. Providers may return fewer. */
  limit?: number;
  /** Abort signal so a slow provider can't hang a request forever. */
  signal?: AbortSignal;
}

export type ProviderName = 'duckduckgo' | 'brave' | 'serper' | 'searxng';

export interface SearchProvider {
  name: ProviderName;
  /** True when the provider has whatever config/keys it needs. */
  isConfigured(): boolean;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
