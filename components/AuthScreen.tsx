'use client';

import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { logIn, resendCode, signUp, verifyEmail } from '@/lib/api';

type Mode = 'login' | 'signup' | 'verify';

export default function AuthScreen() {
  const { googleEnabled, emailDelivery, setUser } = useChatStore();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // Surface the reason when Google bounces us back to the app.
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

  const reset = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setCode('');
  };

  const enterVerify = (delivery: 'email' | 'console', deliveryError: string | null) => {
    setMode('verify');
    setError(deliveryError ? `Could not send the email: ${deliveryError}` : '');
    setNotice(
      delivery === 'email'
        ? `We sent a 6-digit code to ${email}.`
        : 'SMTP is not configured, so your code was printed in the terminal running the app.'
    );
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
        mode === 'signup' ? await signUp(name, email, password) : await logIn(email, password);

      if ('user' in outcome) {
        setUser(outcome.user);
      } else {
        enterVerify(outcome.delivery, outcome.deliveryError);
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
      const { delivery } = await resendCode(email);
      setNotice(
        delivery === 'email'
          ? `A new code is on its way to ${email}.`
          : 'A new code was printed in the terminal running the app.'
      );
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not resend the code.');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Can Ai</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5">
            {mode === 'verify'
              ? 'Check your email for the code'
              : mode === 'signup'
                ? 'Create an account to get started'
                : 'Sign in to continue'}
          </p>
        </div>

        {notice && (
          <p className="mb-3 text-sm px-3.5 py-2.5 rounded-lg bg-primary/10 text-primary border border-primary/25">
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mb-3 text-sm px-3.5 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
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
                className={`${field} text-center text-2xl tracking-[0.4em] font-mono`}
              />
              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="px-4 py-2.5 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
              >
                {busy ? 'Checking…' : 'Verify email'}
              </button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={onResend} disabled={busy} className="text-primary hover:underline disabled:opacity-50">
                  Send a new code
                </button>
                <button type="button" onClick={() => reset('login')} className="text-gray-500 dark:text-gray-400 hover:underline">
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
                  placeholder="Your name"
                  className={field}
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="Email"
                className={field}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="Password"
                className={field}
              />
              {mode === 'signup' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                  At least 8 characters, with a letter and a number.
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2.5 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
              >
                {busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Log in'}
              </button>
            </>
          )}
        </form>

        {mode !== 'verify' && (
          <>
            <div className="flex items-center gap-3 my-4">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">or</span>
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
              className={`flex items-center justify-center gap-2.5 w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 font-medium text-gray-700 dark:text-gray-200 ${
                googleEnabled
                  ? 'hover:bg-gray-50 dark:hover:bg-gray-800'
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

            <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-5">
              {mode === 'signup' ? 'Already have an account?' : 'No account yet?'}{' '}
              <button
                onClick={() => reset(mode === 'signup' ? 'login' : 'signup')}
                className="text-primary font-medium hover:underline"
              >
                {mode === 'signup' ? 'Log in' : 'Sign up'}
              </button>
            </p>

            {emailDelivery === 'console' && (
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
                Verification codes print to your terminal until SMTP is configured.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
