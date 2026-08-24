'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictation through the Web Speech API. Safari (iOS included) exposes it only
 * as webkitSpeechRecognition, and recognition runs on Apple's servers there —
 * the privacy note in the UI says so, since the rest of the app is local.
 */
type Recognition = any;

const getRecognition = (): Recognition | null => {
  if (typeof window === 'undefined') return null;
  const Ctor =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
};

export type SpeechState = 'unsupported' | 'idle' | 'listening' | 'denied';

export interface Speech {
  state: SpeechState;
  /** Words recognised but not yet final, for live feedback. */
  interim: string;
  error: string;
  start: () => void;
  stop: () => void;
}

export const useSpeech = (onResult: (text: string) => void): Speech => {
  const [state, setState] = useState<SpeechState>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recognitionRef = useRef<Recognition | null>(null);
  // Keep the callback in a ref so restarting doesn't need a new recogniser.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const recognition = getRecognition();
    if (!recognition) {
      setState('unsupported');
      return;
    }

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang =
      typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';

    recognition.onresult = (event: any) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          onResultRef.current(result[0].transcript.trim());
        } else {
          pending += result[0].transcript;
        }
      }
      setInterim(pending);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setState('denied');
        setError('Microphone access is blocked. Allow it in your browser settings.');
      } else if (event.error === 'no-speech') {
        setError("I didn't catch that.");
      } else if (event.error !== 'aborted') {
        setError('Dictation failed. Try again.');
      }
    };

    recognition.onend = () => {
      setInterim('');
      // Don't clobber a denied state — the user needs to see why it stopped.
      setState((previous) => (previous === 'denied' ? previous : 'idle'));
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped.
      }
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || state === 'listening') return;
    setError('');
    try {
      recognition.start();
      setState('listening');
    } catch {
      // Safari throws if start() is called while already running.
      setState('idle');
    }
  }, [state]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Nothing running.
    }
    setState((previous) => (previous === 'listening' ? 'idle' : previous));
  }, []);

  return { state, interim, error, start, stop };
};
