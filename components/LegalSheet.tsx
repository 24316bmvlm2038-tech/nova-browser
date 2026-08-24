'use client';

import { LEGAL_DOCS, type LegalDoc } from '@/lib/legal';

interface LegalSheetProps {
  doc: LegalDoc['id'] | null;
  onClose: () => void;
  onOpen: (doc: LegalDoc['id']) => void;
}

const ORDER: LegalDoc['id'][] = ['terms', 'privacy', 'cookies'];

export default function LegalSheet({ doc, onClose, onOpen }: LegalSheetProps) {
  if (!doc) return null;
  const active = LEGAL_DOCS[doc];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[88vh] flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={active.title}
      >
        <header className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{active.title}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Updated {active.updated}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 grid place-items-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex gap-1.5 mt-3">
            {ORDER.map((id) => (
              <button
                key={id}
                onClick={() => onOpen(id)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  id === doc
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                {LEGAL_DOCS[id].title.replace(' Policy', '').replace(' of Service', '')}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium mb-4">
            {active.summary}
          </p>

          {active.sections.map((section) => (
            <section key={section.heading} className="mb-5 last:mb-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                {section.heading}
              </h3>
              {section.body.map((paragraph, index) => (
                <p
                  key={index}
                  className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2 last:mb-0"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-6 pt-4 border-t border-gray-200 dark:border-gray-800">
            Written to match what this software actually does. It is a starting point, not
            legal advice — have a lawyer review it before distributing the app to others.
          </p>
        </div>
      </div>
    </div>
  );
}
