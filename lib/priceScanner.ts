import { PriceData } from '@/store/useChatStore';

// Mock price scanner service
// In production, this would connect to real APIs (Amazon, eBay, etc.)
export const scanPrice = async (itemName: string): Promise<PriceData> => {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const mockPrices = {
    'iphone 15': {
      currentPrice: 799,
      newPrice: 799,
      usedPrice: 650,
      sources: [
        { platform: 'Apple Store', price: 799, url: 'https://apple.com' },
        { platform: 'Amazon', price: 759, url: 'https://amazon.com' },
        { platform: 'Best Buy', price: 799, url: 'https://bestbuy.com' },
        { platform: 'eBay (Used)', price: 650, url: 'https://ebay.com' },
        { platform: 'Swappa (Used)', price: 675, url: 'https://swappa.com' },
      ],
    },
    'macbook pro 16': {
      currentPrice: 2499,
      newPrice: 2499,
      usedPrice: 1800,
      sources: [
        { platform: 'Apple Store', price: 2499, url: 'https://apple.com' },
        { platform: 'Amazon', price: 2379, url: 'https://amazon.com' },
        { platform: 'B&H Photo', price: 2449, url: 'https://bhphotovideo.com' },
        { platform: 'eBay (Used)', price: 1800, url: 'https://ebay.com' },
        { platform: 'Refurbished', price: 2199, url: 'https://apple.com/refurbished' },
      ],
    },
    'airpods pro': {
      currentPrice: 249,
      newPrice: 249,
      usedPrice: 150,
      sources: [
        { platform: 'Apple Store', price: 249, url: 'https://apple.com' },
        { platform: 'Amazon', price: 229, url: 'https://amazon.com' },
        { platform: 'Best Buy', price: 249, url: 'https://bestbuy.com' },
        { platform: 'eBay (Used)', price: 150, url: 'https://ebay.com' },
        { platform: 'Facebook Marketplace', price: 160, url: 'https://facebook.com' },
      ],
    },
  };

  const lowerItemName = itemName.toLowerCase();
  const priceInfo =
    Object.entries(mockPrices).find(([key]) =>
      lowerItemName.includes(key.toLowerCase())
    )?.[1] || {
      currentPrice: Math.floor(Math.random() * 1000) + 50,
      newPrice: Math.floor(Math.random() * 1000) + 50,
      usedPrice: Math.floor(Math.random() * 500) + 20,
      sources: [
        { platform: 'Amazon', price: Math.floor(Math.random() * 1000) + 50 },
        { platform: 'eBay', price: Math.floor(Math.random() * 1000) + 50 },
        { platform: 'Walmart', price: Math.floor(Math.random() * 1000) + 50 },
      ],
    };

  return {
    itemName,
    currentPrice: priceInfo.currentPrice,
    newPrice: priceInfo.newPrice,
    usedPrice: priceInfo.usedPrice,
    sources: priceInfo.sources,
    timestamp: new Date(),
  };
};
