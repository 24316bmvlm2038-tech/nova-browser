'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { logIn, resendCode, signUp, verifyEmail } from '@/lib/api';
import type { LegalDoc } from '@/lib/legal';
import LegalSheet from './LegalSheet';

type Mode = 'login' | 'signup' | 'verify';

/** What the app does, shown while signed out so the screen isn't a bare form. */
const CAPABILITIES = [
  {
    title: 'Ask anything',
    body: 'A model on your own machine. Nothing goes to a hosted service.',
    path: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',
  },
  {
    title: 'See what’s happening',
    body: 'Live from Reddit, Hacker News, Bluesky, Mastodon and Google News.',
    path: 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9h4M18 14h-8M15 18h-5M10 6h8v4h-8V6Z',
  },
  {
    title: 'Scan a price',
    body: 'Point your camera at anything and see what sellers are asking.',
    path: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
  },
];

export default function AuthScreen() {
  const { googleEnabled, emailDelivery, setUser } = useChatStore();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<LegalDoc['id'] | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('auth_error');
    if (reason) {
      setError(reason);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (mode === 'verify') codeRef.current?.focus();
  }, [mode]);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setCode('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      if (mode === 'verify') {
        const { user } = await verifyEmail(email, code);
        setUser(user);
        return;
      }

      const outcome =
        mode === 'signup'
          ? await signUp(name, email, password, accepted)
          : await logIn(email, password);

      if ('user' in outcome) {
        setUser(outcome.user);
        return;
      }

      setMode('verify');
      setError(outcome.deliveryError ? `Could not send the email: ${outcome.deliveryError}` : '');

      if (outcome.devCode) {
        // No mail server in development: fill the code in so verification
        // works out of the box instead of sending people to the terminal.
        setCode(outcome.devCode);
        setNotice(`No mail server configured, so here's your code: ${outcome.devCode}`);
      } else {
        setNotice(
          outcome.delivery === 'email'
            ? `We sent a 6-digit code to ${email}.`
            : 'SMTP is not set up, so your code was printed in the terminal running the app.'
        );
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setBusy(true);
    setError('');
    try {
      const { delivery, devCode } = await resendCode(email);
      if (devCode) {
        setCode(devCode);
        setNotice(`Here's your new code: ${devCode}`);
      } else {
        setNotice(
          delivery === 'email'
            ? `A new code is on its way to ${email}.`
            : 'A new code was printed in the terminal running the app.'
        );
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not resend the code.');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition';

  const canSubmit =
    mode === 'verify'
      ? code.length === 6
      : mode === 'signup'
        ? Boolean(name.trim() && email.trim() && password && accepted)
        : Boolean(email.trim() && password);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-sm w-full mx-auto">
        <div className="mb-7">
          <div className="w-12 h-12 rounded-2xl bg-primary grid place-items-center mb-4">
            <span className="text-white text-xl font-bold">C</span>
          </div>
          <h1 className="text-[26px] leading-tight font-bold text-gray-900 dark:text-white tracking-tight">
            {mode === 'verify'
              ? 'Check your email'
              : mode === 'signup'
                ? 'Create your account'
                : 'Welcome back'}
          </h1>
          <p className="text-[15px] text-gray-600 dark:text-gray-400 mt-1.5">
            {mode === 'verify'
              ? `Enter the 6-digit code we sent to ${email}.`
              : mode === 'signup'
                ? 'Everything runs on your own machine.'
                : 'Sign in to continue to Can Ai.'}
          </p>
        </div>

        {notice && (
          <p className="mb-3 text-sm px-4 py-3 rounded-xl bg-primary/10 text-primary border border-primary/25">
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-3 text-sm px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
          >
            {error}
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3">
          {mode === 'verify' ? (
            <>
              <input
                ref={codeRef}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                aria-label="Verification code"
                className={`${field} text-center text-2xl tracking-[0.4em] font-mono`}
              />
              <Submit busy={busy} disabled={!canSubmit}>
                Verify email
              </Submit>
              <div className="flex justify-between text-sm pt-1">
                <button
                  type="button"
                  onClick={onResend}
                  disabled={busy}
                  className="text-primary font-medium hover:underline disabled:opacity-50"
                >
                  Send a new code
                </button>
                <button
                  type="button"
                  onClick={() => switchTo('login')}
                  className="text-gray-500 dark:text-gray-400 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            </>
          ) : (
            <>
              {mode === 'signup' && (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Full name"
                  aria-label="Full name"
                  className={field}
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="Email"
                aria-label="Email"
                className={field}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="Password"
                aria-label="Password"
                className={field}
              />
              {mode === 'signup' && (
                <>
                  <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                    At least 8 characters, with a letter and a number.
                  </p>
                  <label className="flex items-start gap-2.5 text-[13px] text-gray-600 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
                    />
                    <span>
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={() => setLegal('terms')}
                        className="text-primary font-medium underline"
                      >
                        Terms of Service
                      </button>{' '}
                      and{' '}
                      <button
                        type="button"
                        onClick={() => setLegal('privacy')}
                        className="text-primary font-medium underline"
                      >
                        Privacy Policy
                      </button>
                      .
                    </span>
                  </label>
                </>
              )}
              <Submit busy={busy} disabled={!canSubmit}>
                {mode === 'signup' ? 'Create account' : 'Log in'}
              </Submit>
            </>
          )}
        </form>

        {mode !== 'verify' && (
          <>
            <div className="flex items-center gap-3 my-5">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
                or
              </span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>

            <a
              href={googleEnabled ? '/api/auth/google' : undefined}
              aria-disabled={!googleEnabled}
              onClick={(e) => {
                if (!googleEnabled) {
                  e.preventDefault();
                  setError(
                    'Google sign-in is not set up on this install. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local.'
                  );
                }
              }}
              className={`flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-200 transition ${
                googleEnabled
                  ? 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
                <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
              </svg>
              Continue with Google
            </a>

            <p className="text-center text-[15px] text-gray-600 dark:text-gray-400 mt-6">
              {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
              <button
                onClick={() => switchTo(mode === 'signup' ? 'login' : 'signup')}
                className="text-primary font-semibold hover:underline"
              >
                {mode === 'signup' ? 'Log in' : 'Create an account'}
              </button>
            </p>

            {mode === 'login' && (
              <ul className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3.5">
                {CAPABILITIES.map((item) => (
                  <li key={item.title} className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 grid place-items-center">
                      <svg
                        className="w-[17px] h-[17px] text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d={item.path} />
                      </svg>
                    </span>
                    <span>
                      <span className="block text-[13.5px] font-semibold text-gray-900 dark:text-white">
                        {item.title}
                      </span>
                      <span className="block text-[13px] text-gray-500 dark:text-gray-400 leading-snug">
                        {item.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {emailDelivery === 'console' && mode === 'signup' && (
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-5">
                Verification codes print to your terminal until SMTP is configured.
              </p>
            )}
          </>
        )}
      </div>

      <footer
        className="flex-shrink-0 flex justify-center gap-4 px-6 py-4 text-xs text-gray-500 dark:text-gray-400"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <button onClick={() => setLegal('terms')} className="hover:text-primary hover:underline">
          Terms
        </button>
        <button onClick={() => setLegal('privacy')} className="hover:text-primary hover:underline">
          Privacy
        </button>
        <button onClick={() => setLegal('cookies')} className="hover:text-primary hover:underline">
          Cookies
        </button>
      </footer>

      <LegalSheet doc={legal} onClose={() => setLegal(null)} onOpen={setLegal} />
    </div>
  );
}

function Submit({
  busy,
  disabled,
  children,
}: {
  busy: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="px-4 py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition hover:brightness-110"
    >
      {busy ? 'Working…' : children}
    </button>
  );
}
