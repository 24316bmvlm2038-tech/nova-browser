import { Message } from '@/store/useChatStore';
import PriceCard from './PriceCard';
import TrendingCard from './TrendingCard';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} gap-4 px-4 py-6`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
          C
        </div>
      )}

      <div className={`flex flex-col gap-3 max-w-2xl min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-lg px-4 py-3 ${
            isUser
              ? 'bg-primary text-white rounded-br-none'
              : message.error
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-bl-none'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-none'
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

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
            <figcaption className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between gap-3">
              <span className="truncate">{message.image.prompt}</span>
              <span className="flex-shrink-0">{message.image.provider}</span>
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

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs font-bold">
          You
        </div>
      )}
    </div>
  );
}
