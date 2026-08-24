'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChatStore, Message } from '@/store/useChatStore';
import {
  fetchLive,
  fetchLiveSources,
  fetchOllamaStatus,
  generateImage,
  identifyPhoto,
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
import { useSpeech } from '@/lib/useSpeech';
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
  const photoRef = useRef<HTMLInputElement>(null);

  // Dictation appends, so you can speak in several bursts.
  const speech = useSpeech((text) =>
    setInputValue((current) => (current ? `${current} ${text}` : text))
  );

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

  const onPhotoPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
    if (!file || isLoading) return;

    const dataUri = await downscale(file);

    addMessage({
      id: newId(),
      role: 'user',
      content: 'What is this?',
      attachment: dataUri,
      timestamp: new Date(),
    });
    setLoading(true);
    setStatusText('Looking at your photo…');

    try {
      const { name } = await identifyPhoto(dataUri);
      setStatusText(`Searching listings for “${name}”…`);
      const priceData = await scanPrice(name, scannerConfig);
      pushAssistant(
        priceData.sources.length > 0
          ? `That looks like ${name}. Here's what sellers are asking.`
          : `That looks like ${name}, but I couldn't find prices for it.`,
        priceData.sources.length > 0 ? { priceData } : { error: true }
      );
    } catch (error) {
      pushAssistant(
        error instanceof Error ? error.message : 'Could not read that photo.',
        { error: true }
      );
    } finally {
      setLoading(false);
      setStatusText('');
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">
            Can Ai
          </h1>
          <button
            onClick={refreshStatus}
            className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-primary transition-colors"
            title="Click to re-check the connection"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                ollamaConnected ? 'bg-primary' : 'bg-amber-500'
              }`}
            />
            {ollamaConnected ? selectedModel || 'Ollama' : 'Ollama offline'}
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
          <div className="flex flex-col justify-center h-full px-5 max-w-lg mx-auto w-full">
            <h2 className="text-[26px] leading-tight font-bold text-gray-900 dark:text-white tracking-tight mb-2">
              What can I do for you?
            </h2>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-6">
              Everything runs on your own machine.
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setInputValue(example);
                    inputRef.current?.focus();
                  }}
                  className="text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-[14px] text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary transition-colors"
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
              <div className="max-w-2xl mx-auto flex gap-3 px-4 py-4">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary" />
                <div className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  {statusText}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-1 p-1.5 pl-2 rounded-[22px] border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus-within:border-primary transition-colors">
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            onChange={onPhotoPicked}
            className="hidden"
          />
          <button
            onClick={() => photoRef.current?.click()}
            disabled={isLoading}
            className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition"
            aria-label="Add a photo"
            title="Add a photo"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask anything"
            disabled={isLoading}
            className="flex-1 min-w-0 bg-transparent py-2.5 text-[15px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none disabled:opacity-50 resize-none max-h-40"
          />
          {speech.state !== 'unsupported' && (
            <button
              onClick={() => (speech.state === 'listening' ? speech.stop() : speech.start())}
              disabled={isLoading}
              className={`w-9 h-9 flex-shrink-0 grid place-items-center rounded-full transition disabled:opacity-40 ${
                speech.state === 'listening'
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              aria-label={speech.state === 'listening' ? 'Stop dictating' : 'Dictate'}
              title={speech.state === 'listening' ? 'Stop dictating' : 'Dictate'}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
              </svg>
            </button>
          )}
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-full bg-primary text-white disabled:opacity-30 disabled:cursor-not-allowed transition hover:brightness-110"
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

        {(speech.state === 'listening' || speech.error) && (
          <p className="max-w-2xl mx-auto mt-1.5 px-4 text-[13px] text-gray-500 dark:text-gray-400">
            {speech.error || (speech.interim ? `“${speech.interim}”` : 'Listening…')}
          </p>
        )}
      </div>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/**
 * Photos out of a phone gallery are many megapixels. The vision model gains
 * nothing above ~1024px and base64 of a full-size frame is slow to send.
 */
const downscale = (file: File, maxEdge = 1024): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('That file is not an image.'));
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Could not process that image.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

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
