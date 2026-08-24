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
    // In normal flow on the signed-out screen. Floating it inside the app
    // covered the header at the top and the composer at the bottom.
    <div className="mt-6">
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-900 dark:bg-surface-dark text-white">
        <p className="text-[13px] leading-relaxed flex-1">
          This app sets one cookie, to keep you signed in. No analytics, no advertising, no
          tracking.{' '}
          <button onClick={() => onOpenLegal('cookies')} className="underline font-medium">
            Cookie policy
          </button>
        </p>
        <button
          onClick={dismiss}
          className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-white text-gray-900 text-[13px] font-semibold"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
