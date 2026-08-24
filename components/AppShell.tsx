'use client';

import { useEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { fetchAuth } from '@/lib/api';
import type { LegalDoc } from '@/lib/legal';
import AuthScreen from './AuthScreen';
import LegalSheet from './LegalSheet';
import BottomNav from './BottomNav';
import ChatInterface from './ChatInterface';
import NewsTab from './tabs/NewsTab';
import ScanTab from './tabs/ScanTab';
import ProfileTab from './tabs/ProfileTab';

export default function AppShell() {
  const { activeTab, user, authReady, setUser, setAuthMeta } = useChatStore();
  const [legal, setLegal] = useState<LegalDoc['id'] | null>(null);

  useEffect(() => {
    fetchAuth().then(({ user: account, providers }) => {
      setUser(account);
      setAuthMeta({
        authReady: true,
        googleEnabled: providers.google,
        emailDelivery: providers.emailDelivery,
      });
    });
  }, [setUser, setAuthMeta]);

  // Hold a blank ground until the session check answers, so a signed-in user
  // never sees the login screen flash on reload.
  if (!authReady) {
    return <div className="h-screen bg-gray-50 dark:bg-gray-950" />;
  }

  if (!user) return <AuthScreen />;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-950">
      {/* Every tab stays mounted so its scroll position and loaded feed survive
          switching away and back. */}
      <div className="flex-1 min-h-0">
        <Pane show={activeTab === 'chat'}><ChatInterface /></Pane>
        <Pane show={activeTab === 'news'}><NewsTab /></Pane>
        <Pane show={activeTab === 'scan'}><ScanTab /></Pane>
        <Pane show={activeTab === 'profile'}><ProfileTab onOpenLegal={setLegal} /></Pane>
      </div>
      <BottomNav />
      <LegalSheet doc={legal} onClose={() => setLegal(null)} onOpen={setLegal} />
    </div>
  );
}

function Pane({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div className="h-full" style={{ display: show ? 'block' : 'none' }} aria-hidden={!show}>
      {children}
    </div>
  );
}
