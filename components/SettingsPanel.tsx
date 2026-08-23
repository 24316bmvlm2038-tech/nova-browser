import { useState } from 'react';
import { useChatStore } from '@/store/useChatStore';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { scannerConfig, updateScannerConfig } = useChatStore();
  const [localConfig, setLocalConfig] = useState(scannerConfig);

  const handleSave = () => {
    updateScannerConfig(localConfig);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          ⚙️ Scanner Settings
        </h2>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.showNewItems}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    showNewItems: e.target.checked,
                  })
                }
                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
              />
              <span className="text-gray-700 dark:text-gray-300">
                Show New Items
              </span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localConfig.showUsedItems}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    showUsedItems: e.target.checked,
                  })
                }
                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
              />
              <span className="text-gray-700 dark:text-gray-300">
                Show Used Items
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Currency
            </label>
            <select
              value={localConfig.currency}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  currency: e.target.value as 'USD' | 'EUR' | 'GBP',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Results: {localConfig.maxResults}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={localConfig.maxResults}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  maxResults: parseInt(e.target.value),
                })
              }
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
