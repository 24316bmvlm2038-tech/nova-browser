import { PriceData } from '@/store/useChatStore';

interface PriceCardProps {
  priceData: PriceData;
}

export default function PriceCard({ priceData }: PriceCardProps) {
  const money = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: priceData.currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);

  return (
    <div className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
          {priceData.itemName}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
          via {priceData.provider}
        </span>
      </div>

      {/* auto-fit + minmax(0,…) so a long value shrinks instead of clipping */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 [&>*]:min-w-0">
        <Stat label="Average" value={money(priceData.averagePrice)} highlight />
        <Stat label="Lowest" value={money(priceData.lowestPrice)} />
        {priceData.newPrice > 0 && <Stat label="New" value={money(priceData.newPrice)} />}
        {priceData.usedPrice > 0 && <Stat label="Used" value={money(priceData.usedPrice)} />}
      </div>

      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        What sellers are asking
      </p>
      <ul className="space-y-2">
        {priceData.sources.map((source, index) => (
          <li key={`${source.url}-${index}`}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary transition-colors group"
              title={source.title}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate group-hover:text-primary">
                  {source.platform}
                </span>
                <span
                  className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    source.condition === 'used'
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                      : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                  }`}
                >
                  {source.condition}
                </span>
              </span>
              <span className="text-sm font-bold text-primary flex-shrink-0">
                {money(source.price)}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
        Scanned {priceData.resultsSearched} listings ·{' '}
        {priceData.timestamp.toLocaleTimeString()} · prices are asking prices from
        search results, not verified offers
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-2.5 rounded border border-gray-200 dark:border-gray-700">
      <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold tracking-wide">
        {label}
      </p>
      <p
        className={`text-base font-bold mt-0.5 ${
          highlight ? 'text-primary' : 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
