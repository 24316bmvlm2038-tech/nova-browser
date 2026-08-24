'use client';

import { useEffect, useState } from 'react';
import type { LegalDoc } from '@/lib/legal';
import { LEGAL_VERSION } from '@/lib/legal';

const KEY = 'canai.cookie-notice';

interface CookieNoticeProps {
  onOpenLegal: (doc: LegalDoc['id']) => void;
}

/**
 * The app sets only strictly necessary cookies, so this is a notice rather than
 * a consent gate — there is nothing to decline that would leave a working app.
 * Presenting fake "reject" buttons for cookies you cannot actually turn off is
 * worse than saying plainly what is set and why.
 */
export default function CookieNotice({ onOpenLegal }: CookieNoticeProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== LEGAL_VERSION);
    } catch {
      // Private mode or blocked storage: show once, don't crash.
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, LEGAL_VERSION);
    } catch {
      // Nothing to do — it will simply ask again next time.
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    // Anchored to the top: at the bottom it sat over the composer's own
    // controls and the tab bar, blocking both until dismissed.
    <div
      className="fixed inset-x-0 top-0 z-40 p-3 pointer-events-none"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <div className="pointer-events-auto max-w-md mx-auto flex items-start gap-3 p-3.5 rounded-xl bg-gray-900 dark:bg-gray-800 text-white shadow-lg border border-white/10">
        <p className="text-[13px] leading-relaxed flex-1">
          This app sets one cookie, to keep you signed in. No analytics, no advertising, no
          tracking.{' '}
          <button onClick={() => onOpenLegal('cookies')} className="underline font-medium">
            Cookie policy
          </button>
        </p>
        <button
          onClick={dismiss}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-white text-gray-900 text-[13px] font-semibold"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
