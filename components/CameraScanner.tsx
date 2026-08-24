'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CameraScannerProps {
  onCapture: (dataUri: string) => void;
  onClose: () => void;
  busy: boolean;
  statusText: string;
}

/** Longest edge of the captured frame. Vision models gain nothing above this. */
const CAPTURE_SIZE = 1024;

type Phase = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported' | 'insecure';

export default function CameraScanner({
  onCapture,
  onClose,
  busy,
  statusText,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [detail, setDetail] = useState('');

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    // iOS Safari exposes getUserMedia only on HTTPS (localhost is exempt), and
    // silently omits mediaDevices otherwise — check before calling.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setPhase('insecure');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('unsupported');
      return;
    }

    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // The rear camera is what you point at a product.
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // iOS needs an explicit play() after the stream is attached, and it
        // must happen inside the user gesture that called start().
        await video.play().catch(() => undefined);
      }
      setPhase('live');
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      setPhase(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported');
      setDetail(error instanceof Error ? error.message : '');
    }
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || busy) return;

    const { videoWidth: w, videoHeight: h } = video;
    if (!w || !h) return;

    // Downscale on the way out: a 12MP iPhone frame is pointless for the model
    // and slow to base64 over the wire.
    const scale = Math.min(1, CAPTURE_SIZE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);

    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    onCapture(canvas.toDataURL('image/jpeg', 0.82));
  };

  const close = () => {
    stop();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <span className="text-sm font-medium">Point at a product</span>
        <button
          onClick={close}
          className="w-9 h-9 grid place-items-center rounded-full bg-white/15 hover:bg-white/25"
          aria-label="Close scanner"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <video
          ref={videoRef}
          // playsInline is mandatory on iOS — without it Safari takes the video
          // fullscreen and the capture overlay disappears.
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />

        {phase === 'live' && (
          <div className="absolute inset-0 pointer-events-none grid place-items-center">
            <div className="w-64 h-64 max-w-[70vw] max-h-[70vw] rounded-3xl border-2 border-white/70 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
          </div>
        )}

        {phase !== 'live' && (
          <div className="absolute inset-0 grid place-items-center px-8 text-center text-white">
            <div className="max-w-xs">
              {phase === 'idle' && (
                <>
                  <p className="text-base mb-1">Scan a product</p>
                  <p className="text-sm text-white/70 mb-5">
                    Your camera is used only to take this photo. The image is sent to the
                    model on your own machine and never uploaded.
                  </p>
                  <button
                    onClick={start}
                    className="px-5 py-2.5 rounded-full bg-white text-gray-900 font-semibold"
                  >
                    Turn on camera
                  </button>
                </>
              )}

              {phase === 'starting' && <p className="text-sm text-white/80">Starting camera…</p>}

              {phase === 'denied' && (
                <>
                  <p className="text-base mb-1">Camera access is blocked</p>
                  <p className="text-sm text-white/70">
                    On iPhone: Settings → Safari → Camera → Allow, then reload. In Safari you
                    can also tap <span className="font-medium">aA</span> in the address bar →
                    Website Settings → Camera.
                  </p>
                </>
              )}

              {phase === 'insecure' && (
                <>
                  <p className="text-base mb-1">Camera needs a secure connection</p>
                  <p className="text-sm text-white/70">
                    iOS only allows the camera over HTTPS or on localhost. Open the app on
                    this device at <span className="font-mono">localhost:3000</span>, or put it
                    behind HTTPS to use it from your phone.
                  </p>
                </>
              )}

              {phase === 'unsupported' && (
                <>
                  <p className="text-base mb-1">No camera available</p>
                  <p className="text-sm text-white/70">
                    {detail || 'This browser or device did not provide a camera.'}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {busy && (
          <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 to-transparent text-white text-sm text-center">
            {statusText || 'Working…'}
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-center py-5"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={capture}
          disabled={phase !== 'live' || busy}
          aria-label="Take photo"
          className="w-[70px] h-[70px] rounded-full border-4 border-white grid place-items-center disabled:opacity-40"
        >
          <span
            className={`block rounded-full bg-white transition-all ${
              busy ? 'w-6 h-6' : 'w-14 h-14'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
