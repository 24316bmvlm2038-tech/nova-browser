'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatStore, Message } from '@/store/useChatStore';
import {
  fetchLive,
  fetchLiveSources,
  fetchOllamaStatus,
  generateImage,
  scanPrice,
  sendChat,
} from '@/lib/api';
import {
  extractImagePrompt,
  extractProductName,
  extractTrendingTopic,
  isImageQuery,
  isPriceQuery,
  isTrendingQuery,
} from '@/lib/searchIntent';
import ChatMessage from './ChatMessage';
import SettingsPanel from './SettingsPanel';

const EXAMPLES = [
  "What's trending right now?",
  'Draw a fox asleep in falling snow',
  'How much is an iPhone 15 Pro?',
  'What are people saying about AI on Reddit?',
];

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function ChatInterface() {
  const {
    messages,
    isLoading,
    statusText,
    ollamaConnected,
    selectedModel,
    scannerConfig,
    addMessage,
    clearMessages,
    setLoading,
    setStatusText,
    setOllamaConnected,
    setAvailableModels,
    setSelectedModel,
    setLiveSources,
  } = useChatStore();

  const [inputValue, setInputValue] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, statusText]);

  const refreshStatus = useCallback(async () => {
    const status = await fetchOllamaStatus();
    setOllamaConnected(status.connected);
    setAvailableModels(status.models);
    // Adopt a model only if the user hasn't chosen one, or theirs is now gone.
    setSelectedModel(
      useChatStore.getState().selectedModel &&
        status.models.includes(useChatStore.getState().selectedModel)
        ? useChatStore.getState().selectedModel
        : status.models.includes(status.defaultModel)
          ? status.defaultModel
          : (status.models[0] ?? '')
    );
  }, [setOllamaConnected, setAvailableModels, setSelectedModel]);

  useEffect(() => {
    refreshStatus();
    fetchLiveSources().then(setLiveSources);
  }, [refreshStatus, setLiveSources]);

  const pushAssistant = (content: string, extra: Partial<Message> = {}) =>
    addMessage({
      id: newId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      ...extra,
    });

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    addMessage({
      id: newId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    });
    setInputValue('');
    setLoading(true);

    // Snapshot the history before this turn so the model sees prior context.
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));

    try {
      // Images first: "draw me what's trending" is a picture request, not a
      // trending question. Then trending, since a search engine's index lags
      // hours behind the live feeds.
      if (isImageQuery(trimmed)) {
        await runImage(trimmed);
      } else if (isTrendingQuery(trimmed) && scannerConfig.searchMode !== 'never') {
        await runTrending(trimmed, history);
      } else if (isPriceQuery(trimmed) && scannerConfig.searchMode !== 'never') {
        await runPriceScan(trimmed, history);
      } else {
        await runChat(trimmed, history);
      }
    } catch (error) {
      pushAssistant(
        error instanceof Error ? error.message : 'Something went wrong.',
        { error: true }
      );
    } finally {
      setLoading(false);
      setStatusText('');
      inputRef.current?.focus();
    }
  };

  const runImage = async (message: string) => {
    const prompt = extractImagePrompt(message);
    setStatusText(`Generating “${prompt}”… this can take a minute.`);

    try {
      const image = await generateImage(prompt);
      pushAssistant(`Here's “${image.prompt}”.`, { image });
    } catch (error) {
      pushAssistant(
        error instanceof Error ? error.message : 'Image generation failed.',
        { error: true }
      );
    }
  };

  const runTrending = async (
    message: string,
    history: { role: string; content: string }[]
  ) => {
    const topic = extractTrendingTopic(message);
    setStatusText(
      topic
        ? `Checking live sources for “${topic}”…`
        : 'Checking what’s trending across social and news…'
    );

    let digest;
    try {
      digest = await fetchLive(topic, scannerConfig.liveSources);
    } catch (error) {
      pushAssistant(
        error instanceof Error ? error.message : 'Could not reach the live sources.',
        { error: true }
      );
      return;
    }

    if (digest.items.length === 0) {
      pushAssistant(
        topic
          ? `Nothing recent about “${topic}” on the sources I can reach.`
          : 'The live sources returned nothing just now. Try again in a moment.',
        { error: true, liveDigest: digest }
      );
      return;
    }

    const summary = describeDigest(digest, topic);

    if (!ollamaConnected) {
      pushAssistant(summary, { liveDigest: digest });
      return;
    }

    setStatusText('Summarizing…');
    try {
      const { reply } = await sendChat(
        `${summary}\n\nIn three sentences, tell the user what's happening ${
          topic ? `with ${topic}` : 'right now'
        } based only on these headlines. Note any story appearing on more than one platform. Do not invent details.`,
        selectedModel,
        history,
        'never'
      );
      pushAssistant(reply || summary, { liveDigest: digest });
    } catch {
      // The feed is the valuable part; a model failure shouldn't lose it.
      pushAssistant(summary, { liveDigest: digest });
    }
  };

  const runPriceScan = async (
    message: string,
    history: { role: string; content: string }[]
  ) => {
    const product = extractProductName(message) || message;
    setStatusText(`Searching the web for “${product}” prices…`);

    let priceData;
    try {
      priceData = await scanPrice(product, scannerConfig);
    } catch (error) {
      // No prices found is a normal outcome, not a crash — say what happened
      // and still give the model a chance to answer conversationally.
      pushAssistant(
        error instanceof Error ? error.message : 'The price scan failed.',
        { error: true }
      );
      return;
    }

    if (priceData.sources.length === 0) {
      pushAssistant(
        `I found prices for “${product}”, but your filters hid all of them. Re-enable new or used items in settings.`,
        { error: true }
      );
      return;
    }

    const summary = describeScan(priceData);

    if (!ollamaConnected) {
      pushAssistant(summary, { priceData });
      return;
    }

    setStatusText('Asking the model to summarize…');
    try {
      const { reply } = await sendChat(
        `${summary}\n\nIn two sentences, tell the user what this means — whether it's a good time to buy and where the best deal is. Do not invent prices beyond the ones above.`,
        selectedModel,
        history,
        'never'
      );
      pushAssistant(reply || summary, { priceData });
    } catch {
      // The scan is the valuable part; a model failure shouldn't lose it.
      pushAssistant(summary, { priceData });
    }
  };

  const runChat = async (
    message: string,
    history: { role: string; content: string }[]
  ) => {
    if (!ollamaConnected) {
      pushAssistant(
        'Ollama is not running, so I can only scan prices right now. Start it with `ollama serve`, then click the status dot to reconnect.',
        { error: true }
      );
      return;
    }

    setStatusText(
      scannerConfig.searchMode === 'never'
        ? 'Thinking…'
        : 'Searching the web and thinking…'
    );

    const { reply, sources, searchError } = await sendChat(
      message,
      selectedModel,
      history,
      scannerConfig.searchMode
    );

    pushAssistant(
      searchError ? `${reply}\n\n_(Web search failed: ${searchError})_` : reply,
      { citations: sources }
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            Can Ai
          </h1>
          <button
            onClick={refreshStatus}
            className="flex items-center gap-2 text-xs px-2 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title="Click to re-check the connection"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                ollamaConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-gray-600 dark:text-gray-400">
              {ollamaConnected ? selectedModel || 'Ollama' : 'Ollama offline'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Clear chat"
              aria-label="Clear chat"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-5xl mb-4">🔎</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Ask me anything, or ask what something costs
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
              I search the live web from your laptop and compare what sellers are
              asking, new and used.
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setInputValue(example);
                    inputRef.current?.focus();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            {statusText && (
              <div className="flex gap-4 px-4 py-6">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500" />
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {statusText}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask a question, or “how much is a Steam Deck?”"
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 resize-none max-h-40"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-3 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            aria-label="Send message"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.429 5.951 1.429a1 1 0 001.169-1.409l-7-14z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

const describeDigest = (
  digest: { items: { title: string; source: string; channel?: string; score?: number }[] },
  topic: string
): string => {
  const lines = digest.items
    .slice(0, 12)
    .map((item) => {
      const where = item.channel ? `${item.source}/${item.channel}` : item.source;
      return `• [${where}] ${item.title}`;
    })
    .join('\n');

  return `${topic ? `Live posts about "${topic}"` : "What's trending right now"}:\n${lines}`;
};

const describeScan = (priceData: {
  itemName: string;
  currency: string;
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  newPrice: number;
  usedPrice: number;
  sources: { platform: string; price: number; condition: string }[];
}): string => {
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: priceData.currency,
      maximumFractionDigits: 0,
    }).format(value);

  const lines = [
    `Here's what I found for "${priceData.itemName}" across ${priceData.sources.length} seller${priceData.sources.length === 1 ? '' : 's'}:`,
    `• Average asking price: ${money(priceData.averagePrice)}`,
    `• Range: ${money(priceData.lowestPrice)} – ${money(priceData.highestPrice)}`,
  ];

  if (priceData.newPrice > 0) lines.push(`• New, typically: ${money(priceData.newPrice)}`);
  if (priceData.usedPrice > 0) lines.push(`• Used, typically: ${money(priceData.usedPrice)}`);

  return lines.join('\n');
};
