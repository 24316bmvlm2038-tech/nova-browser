'use client';

import { useChatStore, type Tab } from '@/store/useChatStore';

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    ),
  },
  {
    id: 'news',
    label: 'News',
    icon: (
      <>
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h4" />
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
      </>
    ),
  },
  {
    id: 'scan',
    label: 'Scan',
    icon: (
      <>
        <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
        <path d="M7 12h10" />
      </>
    ),
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
  },
];

export default function BottomNav() {
  const { activeTab, setActiveTab, user } = useChatStore();

  return (
    <nav
      className="flex-shrink-0 bg-ground-light/80 dark:bg-ground-dark/80 backdrop-blur"
      // Keep the bar clear of the iOS home indicator.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <div className="max-w-3xl mx-auto grid grid-cols-4">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const showAvatar = tab.id === 'profile' && user?.avatarUrl;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 pt-2 pb-2.5 transition-colors ${
                active
                  ? 'text-primary'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {showAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl as string}
                  alt=""
                  className={`w-6 h-6 rounded-full ${active ? 'ring-2 ring-primary' : ''}`}
                />
              ) : (
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {tab.icon}
                </svg>
              )}
              <span className={`text-[10.5px] ${active ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
