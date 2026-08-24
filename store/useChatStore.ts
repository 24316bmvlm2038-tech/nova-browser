import { create } from 'zustand';

export type Condition = 'new' | 'used';

export interface PriceSource {
  platform: string;
  price: number;
  url: string;
  condition: Condition;
  title: string;
}

export interface PriceData {
  itemName: string;
  currency: string;
  /** Which search backend produced these listings. */
  provider: string;
  /** How many search results were scanned to produce them. */
  resultsSearched: number;
  currentPrice: number;
  newPrice: number;
  usedPrice: number;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  sources: PriceSource[];
  timestamp: Date;
}

/** A web page the assistant used to answer, rendered as a numbered citation. */
export interface Citation {
  index: number;
  title: string;
  url: string;
  site: string;
}

/** One post or story pulled from a live social/news source. */
export interface LiveItem {
  id: string;
  title: string;
  url: string;
  source: string;
  channel?: string;
  author?: string;
  score?: number;
  comments?: number;
  publishedAt?: string;
  summary?: string;
}

export interface LiveTopic {
  name: string;
  source: string;
  url?: string;
  volume?: number;
}

export interface LiveDigest {
  /** The topic searched for, or null for the general trending digest. */
  query: string | null;
  items: LiveItem[];
  topics: LiveTopic[];
  sources: string[];
  failures: { source: string; reason: string }[];
  fetchedAt: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  priceData?: PriceData;
  liveDigest?: LiveDigest;
  citations?: Citation[];
  /** Set when the turn failed, so the bubble can render as an error. */
  error?: boolean;
  timestamp: Date;
}

export type SearchMode = 'auto' | 'always' | 'never';

export interface ScannerConfig {
  showNewItems: boolean;
  showUsedItems: boolean;
  currency: 'USD' | 'EUR' | 'GBP';
  maxResults: number;
  searchMode: SearchMode;
  /** Source ids to pull live data from; empty means every available source. */
  liveSources: string[];
}

export interface SourceInfo {
  id: string;
  label: string;
  kind: 'social' | 'news';
  available: boolean;
  canSearch: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  /** What the app is doing right now, shown in the composer. */
  statusText: string;
  ollamaConnected: boolean;
  availableModels: string[];
  selectedModel: string;
  searchProvider: string;
  /** Live sources the server reports, with availability. */
  liveSources: SourceInfo[];
  scannerConfig: ScannerConfig;
  addMessage: (message: Message) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setStatusText: (text: string) => void;
  setOllamaConnected: (connected: boolean) => void;
  setAvailableModels: (models: string[]) => void;
  setSelectedModel: (model: string) => void;
  setSearchProvider: (provider: string) => void;
  setLiveSources: (sources: SourceInfo[]) => void;
  updateScannerConfig: (config: Partial<ScannerConfig>) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  statusText: '',
  ollamaConnected: false,
  availableModels: [],
  selectedModel: '',
  searchProvider: '',
  liveSources: [],
  scannerConfig: {
    showNewItems: true,
    showUsedItems: true,
    currency: 'USD',
    maxResults: 5,
    searchMode: 'auto',
    liveSources: [],
  },
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== id),
    })),
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  setStatusText: (text) => set({ statusText: text }),
  setOllamaConnected: (connected) => set({ ollamaConnected: connected }),
  setAvailableModels: (models) => set({ availableModels: models }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSearchProvider: (provider) => set({ searchProvider: provider }),
  setLiveSources: (sources) => set({ liveSources: sources }),
  updateScannerConfig: (config) =>
    set((state) => ({
      scannerConfig: { ...state.scannerConfig, ...config },
    })),
}));
