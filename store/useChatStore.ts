import { create } from 'zustand';

export interface PriceData {
  itemName: string;
  currentPrice: number;
  newPrice: number;
  usedPrice: number;
  sources: {
    platform: string;
    price: number;
    url?: string;
  }[];
  timestamp: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  priceData?: PriceData;
  timestamp: Date;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  scannerConfig: {
    showNewItems: boolean;
    showUsedItems: boolean;
    currency: 'USD' | 'EUR' | 'GBP';
    maxResults: number;
  };
  addMessage: (message: Message) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  updateScannerConfig: (config: Partial<ChatState['scannerConfig']>) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  scannerConfig: {
    showNewItems: true,
    showUsedItems: true,
    currency: 'USD',
    maxResults: 5,
  },
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== id),
    })),
  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  updateScannerConfig: (config) =>
    set((state) => ({
      scannerConfig: { ...state.scannerConfig, ...config },
    })),
}));
