'use client';

import { useState } from 'react';
import { scanPrice } from '@/lib/api';
import { useChatStore, type PriceData } from '@/store/useChatStore';
import PriceCard from '../PriceCard';

const SUGGESTIONS = ['PlayStation 5', 'iPhone 15 Pro', 'Steam Deck OLED', 'AirPods Pro 2'];

export default function ScanTab() {
  const { scannerConfig, updateScannerConfig } = useChatStore();
  const [item, setItem] = useState('');
  const [result, setResult] = useState<PriceData | null>(null);
  const [history, setHistory] = useState<PriceData[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (query: string) => {
    const target = query.trim();
    if (!target || busy) return;

    setBusy(true);
    setError('');
    try {
      const data = await scanPrice(target, scannerConfig);
      setResult(data);
      // Keep a short trail so comparing two products doesn't need a re-scan.
      setHistory((previous) => [data, ...previous.filter((p) => p.itemName !== data.itemName)].slice(0, 4));
    } catch (problem) {
      setResult(null);
      setError(problem instanceof Error ? problem.message : 'The scan failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 pt-3 pb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Scan</h1>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              run(item);
            }}
            className="flex gap-2"
          >
            <input
              value={item}
              onChange={(event) => setItem(event.target.value)}
              placeholder="What are you pricing?"
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={busy || !item.trim()}
              className="px-4 py-2.5 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
            >
              {busy ? 'Scanning…' : 'Scan'}
            </button>
          </form>

          <div className="flex items-center gap-3 mt-2.5 text-xs">
            <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <span>Currency</span>
              <select
                value={scannerConfig.currency}
                onChange={(event) =>
                  updateScannerConfig({
                    currency: event.target.value as typeof scannerConfig.currency,
                  })
                }
                className="px-1.5 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={scannerConfig.showNewItems}
                onChange={(event) => updateScannerConfig({ showNewItems: event.target.checked })}
                className="accent-primary"
              />
              New
            </label>

            <label className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={scannerConfig.showUsedItems}
                onChange={(event) => updateScannerConfig({ showUsedItems: event.target.checked })}
                className="accent-primary"
              />
              Used
            </label>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-3">
          {error && (
            <p className="text-sm px-3.5 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {error}
            </p>
          )}

          {!result && !busy && !error && (
            <div className="text-center py-10">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Search real listings and see what sellers are asking, new and used.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setItem(suggestion);
                      run(suggestion);
                    }}
                    className="px-3 py-1.5 rounded-full text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {busy && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              Searching retail and second-hand listings…
            </p>
          )}

          {result && <PriceCard priceData={result} />}

          {history.length > 1 && (
            <div className="mt-2">
              <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                Recent scans
              </p>
              <div className="flex flex-wrap gap-2">
                {history.slice(1).map((entry) => (
                  <button
                    key={entry.itemName}
                    onClick={() => setResult(entry)}
                    className="px-3 py-1.5 rounded-full text-sm border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary"
                  >
                    {entry.itemName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
