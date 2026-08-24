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

/** An image the assistant generated. */
export interface GeneratedImage {
  dataUri: string;
  width: number;
  height: number;
  provider: string;
  model?: string;
  prompt: string;
}

/** The signed-in account, as the server reports it. Never carries secrets. */
export interface AccountUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  linkedGoogle: boolean;
  createdAt: string;
}

export type Tab = 'chat' | 'news' | 'scan' | 'profile';

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
  image?: string;
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
  image?: GeneratedImage;
  /** A photo the user attached, as a data URI. */
  attachment?: string;
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
  activeTab: Tab;
  user: AccountUser | null;
  /** False until /api/auth/me has answered, so the UI can hold the splash. */
  authReady: boolean;
  googleEnabled: boolean;
  /** 'console' means codes print to the terminal because SMTP isn't set. */
  emailDelivery: 'email' | 'console';
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
  setActiveTab: (tab: Tab) => void;
  setUser: (user: AccountUser | null) => void;
  setAuthMeta: (meta: {
    authReady?: boolean;
    googleEnabled?: boolean;
    emailDelivery?: 'email' | 'console';
  }) => void;
  updateScannerConfig: (config: Partial<ScannerConfig>) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeTab: 'chat',
  user: null,
  authReady: false,
  googleEnabled: false,
  emailDelivery: 'console',
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
  setActiveTab: (tab) => set({ activeTab: tab }),
  setUser: (user) => set({ user }),
  setAuthMeta: (meta) => set((state) => ({ ...state, ...meta })),
  updateScannerConfig: (config) =>
    set((state) => ({
      scannerConfig: { ...state.scannerConfig, ...config },
    })),
}));
