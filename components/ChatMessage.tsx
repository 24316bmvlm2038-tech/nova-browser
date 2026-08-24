'use client';

import { useState } from 'react';
import { Message } from '@/store/useChatStore';
import { canShareFiles, saveImage } from '@/lib/saveImage';
import PriceCard from './PriceCard';
import TrendingCard from './TrendingCard';

interface ChatMessageProps {
  message: Message;
}

/** Puts a generated image into the phone's photo library. */
function SaveButton({ dataUri, caption }: { dataUri: string; caption: string }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    setBusy(true);
    const result = await saveImage(dataUri, caption);
    setNote(result.ok ? 'Saved' : result.reason);
    setBusy(false);
    setTimeout(() => setNote(''), 4000);
  };

  return (
    <span className="flex items-center gap-2 flex-shrink-0">
      {note && <span className="text-xs text-gray-500 dark:text-gray-400">{note}</span>}
      <button
        onClick={onSave}
        disabled={busy}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary hover:text-primary disabled:opacity-50 transition"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
        {canShareFiles() ? 'Save to Photos' : 'Save'}
      </button>
    </span>
  );
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex w-full max-w-2xl mx-auto gap-3 px-4 py-3 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[11px] font-bold">
          C
        </div>
      )}

      <div className={`flex flex-col gap-2.5 min-w-0 flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2.5 ${
            isUser
              ? 'bg-primary text-white rounded-[18px] rounded-br-md max-w-[85%]'
              : message.error
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-[18px] rounded-bl-md'
                : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-800 rounded-[18px] rounded-bl-md'
          }`}
        >
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {message.attachment && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={message.attachment}
            alt="Attached photo"
            className="max-w-[70%] rounded-[18px] rounded-br-md border border-gray-200 dark:border-gray-800"
          />
        )}

        {message.priceData && <PriceCard priceData={message.priceData} />}

        {message.liveDigest && <TrendingCard digest={message.liveDigest} />}

        {message.image && (
          <figure className="w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            {/* A data: URI from our own API route — next/image would only add a
                loader in front of bytes we already hold. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.image.dataUri}
              alt={message.image.prompt}
              width={message.image.width}
              height={message.image.height}
              className="w-full h-auto block"
            />
            <figcaption className="px-3 py-2 flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {message.image.prompt}
              </span>
              <SaveButton dataUri={message.image.dataUri} caption={message.image.prompt} />
            </figcaption>
          </figure>
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="w-full">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
              Sources
            </p>
            <ol className="space-y-1">
              {message.citations.map((citation) => (
                <li key={citation.index} className="text-xs flex gap-2">
                  <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
                    [{citation.index}]
                  </span>
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate"
                    title={citation.title}
                  >
                    {citation.title || citation.url}
                    <span className="text-gray-400 dark:text-gray-500"> — {citation.site}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>


    </div>
  );
}
