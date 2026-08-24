'use client';

import { useEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import {
  fetchImageProviders,
  fetchOllamaStatus,
  logOut,
  type ImageProviderInfo,
} from '@/lib/api';
import SettingsPanel from '../SettingsPanel';

export default function ProfileTab() {
  const {
    user,
    setUser,
    ollamaConnected,
    selectedModel,
    availableModels,
    liveSources,
    setOllamaConnected,
    setAvailableModels,
    clearMessages,
  } = useChatStore();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageProviders, setImageProviders] = useState<ImageProviderInfo[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchImageProviders().then(setImageProviders);
  }, []);

  const recheck = async () => {
    setBusy(true);
    const status = await fetchOllamaStatus();
    setOllamaConnected(status.connected);
    setAvailableModels(status.models);
    setImageProviders(await fetchImageProviders());
    setBusy(false);
  };

  const signOut = async () => {
    await logOut();
    clearMessages();
    setUser(null);
  };

  const imageReady = imageProviders.filter((provider) => provider.configured);
  const liveReady = liveSources.filter((source) => source.available);

  return (
    <div className="flex flex-col h-full">
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Profile</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col gap-4">
          <section className="flex items-center gap-3.5 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary text-white grid place-items-center text-xl font-semibold">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{user?.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Pill tone={user?.emailVerified ? 'good' : 'warn'}>
                  {user?.emailVerified ? 'Email verified' : 'Unverified'}
                </Pill>
                {user?.linkedGoogle && <Pill tone="neutral">Google linked</Pill>}
                {user?.hasPassword && <Pill tone="neutral">Password set</Pill>}
              </div>
            </div>
          </section>

          <Row
            title="Local model"
            status={ollamaConnected ? selectedModel || 'connected' : 'Not running'}
            good={ollamaConnected}
            detail={
              ollamaConnected
                ? `${availableModels.length} model${availableModels.length === 1 ? '' : 's'} installed`
                : 'Start it with `ollama serve`'
            }
          />

          <Row
            title="Live sources"
            status={`${liveReady.length} of ${liveSources.length}`}
            good={liveReady.length > 0}
            detail={liveReady.map((source) => source.label).join(', ') || 'None reachable'}
          />

          <Row
            title="Image generation"
            status={imageReady.length > 0 ? imageReady[0].label : 'Not set up'}
            good={imageReady.length > 0}
            detail={
              imageReady.length > 0
                ? imageReady.map((provider) => provider.label).join(', ')
                : 'Run Stable Diffusion WebUI with --api, or set REPLICATE_API_TOKEN'
            }
          />

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium hover:border-primary"
            >
              Settings
            </button>
            <button
              onClick={recheck}
              disabled={busy}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium hover:border-primary disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Re-check connections'}
            </button>
            <button
              onClick={signOut}
              className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-amber-700 dark:text-amber-400 font-medium hover:border-amber-400"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'good' | 'warn' | 'neutral';
}) {
  const styles = {
    good: 'bg-primary/10 text-primary',
    warn: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    neutral: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  }[tone];

  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles}`}>{children}</span>;
}

function Row({
  title,
  status,
  detail,
  good,
}: {
  title: string;
  status: string;
  detail: string;
  good: boolean;
}) {
  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-gray-900 dark:text-white">{title}</span>
        <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          <span className={`w-2 h-2 rounded-full ${good ? 'bg-primary' : 'bg-amber-500'}`} />
          {status}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{detail}</p>
    </div>
  );
}
