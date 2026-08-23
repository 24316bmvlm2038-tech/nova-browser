import { PriceData } from '@/store/useChatStore';

interface PriceCardProps {
  priceData: PriceData;
}

export default function PriceCard({ priceData }: PriceCardProps) {
  const formatCurrency = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const avgPrice = Math.round(
    priceData.sources.reduce((sum, s) => sum + s.price, 0) /
      priceData.sources.length
  );

  return (
    <div className="w-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mt-2">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
        💰 {priceData.itemName}
      </h3>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase font-semibold">
            Average Price
          </p>
          <p className="text-lg font-bold text-primary mt-1">
            {formatCurrency(avgPrice)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
          <p className="text-xs text-gray-600 dark:text-gray-400 uppercase font-semibold">
            Price Range
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(Math.min(...priceData.sources.map((s) => s.price)))} -{' '}
            {formatCurrency(Math.max(...priceData.sources.map((s) => s.price)))}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Sellers & Prices:
        </p>
        <div className="space-y-2">
          {priceData.sources.map((source, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600 hover:border-primary dark:hover:border-primary transition-colors"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {source.platform}
              </span>
              <span className="text-sm font-bold text-primary">
                {formatCurrency(source.price)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Last updated: {priceData.timestamp.toLocaleTimeString()}
      </p>
    </div>
  );
}
