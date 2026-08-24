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
    <div
      className="fixed inset-x-0 bottom-0 z-40 p-3 pointer-events-none"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
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
