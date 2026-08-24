'use client';

import { useEffect, useState } from 'react';
import { fetchVisionStatus, identifyPhoto, scanPrice } from '@/lib/api';
import { useChatStore, type PriceData } from '@/store/useChatStore';
import PriceCard from '../PriceCard';
import CameraScanner from '../CameraScanner';

const SUGGESTIONS = ['PlayStation 5', 'iPhone 15 Pro', 'Steam Deck OLED', 'AirPods Pro 2'];

export default function ScanTab() {
  const { scannerConfig, updateScannerConfig } = useChatStore();

  const [item, setItem] = useState('');
  const [result, setResult] = useState<PriceData | null>(null);
  const [history, setHistory] = useState<PriceData[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [vision, setVision] = useState<{ available: boolean; suggested: string } | null>(null);

  useEffect(() => {
    fetchVisionStatus().then((state) =>
      setVision({ available: state.available, suggested: state.suggested })
    );
  }, []);

  const priceIt = async (query: string) => {
    const target = query.trim();
    if (!target) return;

    setStatus(`Searching listings for “${target}”…`);
    try {
      const data = await scanPrice(target, scannerConfig);
      setResult(data);
      setHistory((prev) => [data, ...prev.filter((p) => p.itemName !== data.itemName)].slice(0, 4));
    } catch (problem) {
      setResult(null);
      setError(problem instanceof Error ? problem.message : 'The scan failed.');
    }
  };

  const runTyped = async (query: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    await priceIt(query);
    setBusy(false);
    setStatus('');
  };

  /** Photo → vision model names the product → price that name. */
  const onCapture = async (dataUri: string) => {
    setBusy(true);
    setError('');
    setStatus('Looking at your photo…');

    try {
      const { name } = await identifyPhoto(dataUri);
      setItem(name);
      setCameraOpen(false);
      await priceIt(name);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not read that photo.');
      setCameraOpen(false);
    } finally {
      setBusy(false);
      setStatus('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      <header className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-3">
            Scan
          </h1>

          <button
            onClick={() => setCameraOpen(true)}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 hover:brightness-110 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            Scan with camera
          </button>

          <div className="flex items-center gap-3 my-3">
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            <span className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
              or type it
            </span>
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              runTyped(item);
            }}
            className="flex gap-2"
          >
            <input
              value={item}
              onChange={(event) => setItem(event.target.value)}
              placeholder="What are you pricing?"
              className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={busy || !item.trim()}
              className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium disabled:opacity-50"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-4 mt-3 text-xs text-gray-600 dark:text-gray-400">
            <label className="flex items-center gap-1.5">
              <span>Currency</span>
              <select
                value={scannerConfig.currency}
                onChange={(event) =>
                  updateScannerConfig({
                    currency: event.target.value as typeof scannerConfig.currency,
                  })
                }
                className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={scannerConfig.showNewItems}
                onChange={(event) => updateScannerConfig({ showNewItems: event.target.checked })}
                className="accent-primary"
              />
              New
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
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
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col gap-3">
          {vision && !vision.available && (
            <p className="text-xs px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Camera scanning needs a vision model. Run{' '}
              <code className="font-mono">ollama pull {vision.suggested}</code> to enable it —
              typing a product name works either way.
            </p>
          )}

          {error && (
            <p className="text-sm px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {error}
            </p>
          )}

          {busy && status && (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{status}</p>
          )}

          {!result && !busy && !error && (
            <div className="text-center py-8">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Point your camera at a product, or type its name.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setItem(suggestion);
                      runTyped(suggestion);
                    }}
                    className="px-3.5 py-1.5 rounded-full text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary transition"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {result && <PriceCard priceData={result} />}

          {history.length > 1 && (
            <div className="mt-1">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                Recent scans
              </p>
              <div className="flex flex-wrap gap-2">
                {history.slice(1).map((entry) => (
                  <button
                    key={entry.itemName}
                    onClick={() => setResult(entry)}
                    className="px-3.5 py-1.5 rounded-full text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary transition"
                  >
                    {entry.itemName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {cameraOpen && (
        <CameraScanner
          onCapture={onCapture}
          onClose={() => setCameraOpen(false)}
          busy={busy}
          statusText={status}
        />
      )}
    </div>
  );
}
