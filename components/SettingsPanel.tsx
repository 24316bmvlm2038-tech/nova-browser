'use client';

import { useEffect, useState } from 'react';
import { useChatStore, type SearchMode } from '@/store/useChatStore';
import { fetchOllamaStatus } from '@/lib/api';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEARCH_MODES: { value: SearchMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Search when the question looks like it needs current facts' },
  { value: 'always', label: 'Always', hint: 'Search the web on every message' },
  { value: 'never', label: 'Never', hint: 'Answer from the model alone, no web access' },
];

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    scannerConfig,
    updateScannerConfig,
    ollamaConnected,
    availableModels,
    selectedModel,
    setSelectedModel,
    setOllamaConnected,
    setAvailableModels,
  } = useChatStore();

  const [draft, setDraft] = useState(scannerConfig);
  const [checking, setChecking] = useState(false);

  // Re-sync the draft each time the panel opens so a cancelled edit is discarded.
  useEffect(() => {
    if (isOpen) setDraft(scannerConfig);
  }, [isOpen, scannerConfig]);

  const recheckOllama = async () => {
    setChecking(true);
    const status = await fetchOllamaStatus();
    setOllamaConnected(status.connected);
    setAvailableModels(status.models);
    if (!selectedModel && status.models.length > 0) {
      setSelectedModel(status.models[0]);
    }
    setChecking(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-5">Settings</h2>

        <section className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">
            Local model
          </h3>

          <div
            className={`mb-3 p-3 rounded-lg text-xs border ${
              ollamaConnected
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}
          >
            {ollamaConnected ? (
              <>Connected — {availableModels.length} model{availableModels.length === 1 ? '' : 's'} installed.</>
            ) : (
              <>
                Not reachable. Run <code className="px-1 rounded bg-white dark:bg-gray-800">ollama serve</code>,
                then pull a model with <code className="px-1 rounded bg-white dark:bg-gray-800">ollama pull llama3.2</code>.
              </>
            )}
            <button
              onClick={recheckOllama}
              disabled={checking}
              className="ml-2 underline hover:no-underline disabled:opacity-50"
            >
              {checking ? 'Checking…' : 'Re-check'}
            </button>
          </div>

          {availableModels.length > 0 && (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Model
              </span>
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
              >
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        <section className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">
            Web search
          </h3>
          <div className="space-y-2">
            {SEARCH_MODES.map((mode) => (
              <label
                key={mode.value}
                className="flex items-start gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <input
                  type="radio"
                  name="searchMode"
                  checked={draft.searchMode === mode.value}
                  onChange={() => setDraft({ ...draft, searchMode: mode.value })}
                  className="mt-1 accent-primary"
                />
                <span>
                  <span className="block text-sm text-gray-800 dark:text-gray-200">
                    {mode.label}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {mode.hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">
            Price scanner
          </h3>

          <div className="space-y-2 mb-4">
            <Toggle
              label="Show new listings"
              checked={draft.showNewItems}
              onChange={(showNewItems) => setDraft({ ...draft, showNewItems })}
            />
            <Toggle
              label="Show used & refurbished listings"
              checked={draft.showUsedItems}
              onChange={(showUsedItems) => setDraft({ ...draft, showUsedItems })}
            />
          </div>

          <label className="block mb-4">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Currency
            </span>
            <select
              value={draft.currency}
              onChange={(event) =>
                setDraft({ ...draft, currency: event.target.value as typeof draft.currency })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              Only listings priced in this currency are counted.
            </span>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Sellers to show: {draft.maxResults}
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={draft.maxResults}
              onChange={(event) =>
                setDraft({ ...draft, maxResults: Number(event.target.value) })
              }
              className="w-full accent-primary"
            />
          </label>
        </section>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              updateScannerConfig(draft);
              onClose();
            }}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="w-4 h-4 accent-primary rounded"
      />
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  );
}
