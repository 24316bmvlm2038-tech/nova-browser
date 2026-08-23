'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore, Message } from '@/store/useChatStore';
import { scanPrice } from '@/lib/priceScanner';
import ChatMessage from './ChatMessage';
import SettingsPanel from './SettingsPanel';

export default function ChatInterface() {
  const {
    messages,
    isLoading,
    addMessage,
    clearMessages,
    setLoading,
  } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const isScannableQuery = (query: string): boolean => {
    const scanKeywords = [
      'price',
      'cost',
      'how much',
      'scan',
      'check',
      'find',
      'what is',
      'what does',
    ];
    return scanKeywords.some((keyword) =>
      query.toLowerCase().includes(keyword)
    );
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Math.random().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setInputValue('');
    setLoading(true);

    try {
      // Check if the message is asking for price scanning
      if (isScannableQuery(inputValue)) {
        // Extract item name from the query
        const itemName = inputValue
          .replace(/(?:price|cost|scan|check|find|of|for|what is)\s+/gi, '')
          .trim();

        if (itemName.length > 0) {
          // Scan for price
          const priceData = await scanPrice(itemName);

          const assistantMessage: Message = {
            id: Math.random().toString(),
            role: 'assistant',
            content: `I found price information for "${itemName}". The average price across major retailers is ${new Intl.NumberFormat(
              'en-US',
              {
                style: 'currency',
                currency: 'USD',
              }
            ).format(
              Math.round(
                priceData.sources.reduce((sum, s) => sum + s.price, 0) /
                  priceData.sources.length
              )
            )}. I've listed all available sellers and their prices below.`,
            priceData,
            timestamp: new Date(),
          };

          addMessage(assistantMessage);
        }
      } else {
        // Regular chat response
        const responses = [
          'I can help you find the best prices! Try asking me "What is the price of iPhone 15?" or "Scan MacBook Pro prices".',
          'Feel free to ask me about prices for any product. I can check multiple sellers and show you the best deals!',
          'To get started, tell me what product you want to check the price for. For example: "What is the price of AirPods Pro?"',
          'I specialize in price scanning! Ask me about the cost of any item and I\'ll find it for you across different sellers.',
        ];

        const assistantMessage: Message = {
          id: Math.random().toString(),
          role: 'assistant',
          content:
            responses[Math.floor(Math.random() * responses.length)],
          timestamp: new Date(),
        };

        addMessage(assistantMessage);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: Message = {
        id: Math.random().toString(),
        role: 'assistant',
        content:
          'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          💰 Price Scanner Chat
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Settings"
          >
            <svg
              className="w-6 h-6 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => clearMessages()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Clear Chat"
            >
              <svg
                className="w-6 h-6 text-gray-600 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to Price Scanner
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
              Ask me about prices for any product! I'll scan multiple sellers
              and show you the best deals and price comparisons.
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-gray-500 dark:text-gray-400">
                💡 Try asking:
              </p>
              <div className="space-y-2">
                {[
                  'What is the price of iPhone 15?',
                  'Scan prices for MacBook Pro 16',
                  'Check AirPods Pro cost',
                ].map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputValue(example);
                      inputRef.current?.focus();
                    }}
                    className="block text-primary hover:underline font-medium"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about prices... (e.g., 'What is the price of iPhone 15?')"
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 resize-none"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-3 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.429 5.951 1.429a1 1 0 001.169-1.409l-7-14z" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
