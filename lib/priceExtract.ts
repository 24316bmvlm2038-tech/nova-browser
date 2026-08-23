import type { SearchResult } from './search/types';

export type Condition = 'new' | 'used';

export interface ExtractedListing {
  platform: string;
  price: number;
  url: string;
  title: string;
  condition: Condition;
}

/** Currency symbol/code -> ISO code, for deciding which amounts to keep. */
const CURRENCY_CODES: Record<string, string> = {
  $: 'USD',
  us$: 'USD',
  usd: 'USD',
  '£': 'GBP',
  gbp: 'GBP',
  '€': 'EUR',
  eur: 'EUR',
};

const USED_KEYWORDS = [
  'used',
  'pre-owned',
  'preowned',
  'pre owned',
  'refurb',
  'refurbished',
  'renewed',
  'open box',
  'open-box',
  'second hand',
  'secondhand',
];

/** Hostnames we can name nicely; anything else falls back to its domain. */
const KNOWN_RETAILERS: Record<string, string> = {
  'amazon.com': 'Amazon',
  'amazon.co.uk': 'Amazon UK',
  'ebay.com': 'eBay',
  'ebay.co.uk': 'eBay UK',
  'walmart.com': 'Walmart',
  'bestbuy.com': 'Best Buy',
  'target.com': 'Target',
  'apple.com': 'Apple',
  'bhphotovideo.com': 'B&H Photo',
  'newegg.com': 'Newegg',
  'swappa.com': 'Swappa',
  'backmarket.com': 'Back Market',
  'gamestop.com': 'GameStop',
  'costco.com': 'Costco',
  'microcenter.com': 'Micro Center',
  'adorama.com': 'Adorama',
  'argos.co.uk': 'Argos',
  'currys.co.uk': 'Currys',
  'johnlewis.com': 'John Lewis',
};

/**
 * Parse one currency token into a number, handling both `1,299.99` (US) and
 * `1.299,99` (EU) grouping.
 *
 * A separator is only the decimal point when it is the last one AND at most
 * two digits follow it; otherwise it groups thousands. Counting matters:
 * `9,999,999` has a "last comma" but two of them, so it is grouped, not decimal.
 */
export const parseAmount = (raw: string): number | null => {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!/\d/.test(cleaned)) return null;

  const commas = (cleaned.match(/,/g) ?? []).length;
  const dots = (cleaned.match(/\./g) ?? []).length;

  let normalized = cleaned;
  if (commas > 0 && dots > 0) {
    // Both present: whichever appears last is the decimal point.
    normalized =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (commas > 1) {
    normalized = cleaned.replace(/,/g, '');
  } else if (commas === 1) {
    normalized = /,\d{1,2}$/.test(cleaned)
      ? cleaned.replace(',', '.')
      : cleaned.replace(',', '');
  } else if (dots > 1) {
    normalized = cleaned.replace(/\./g, '');
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  // Guard against version numbers and model numbers masquerading as prices.
  if (value > 1_000_000) return null;
  return Math.round(value * 100) / 100;
};

/**
 * An amount followed by a billing period is a financing installment, not the
 * item's price — "From $799 or $33.29/mo." must not be read as $33.29.
 */
const INSTALLMENT_SUFFIX = /^\s*(?:\/|\bper\b)\s*(?:mo\b|month|mth|wk\b|week|yr\b|year|day)/i;

/**
 * An amount introduced by discount or fee wording is not a selling price
 * either — "save $100", "$15 shipping", "up to $200 off".
 */
const NON_PRICE_PREFIX =
  /\b(?:save|saving|savings|discount|off|rebate|credit|coupon|shipping|delivery|tax|fee|deposit|trade[- ]?in|was|reg(?:ularly)?)\b[\s:]*(?:of|up to)?[\s:]*$/i;

/** The same wording also trails the amount: "$25 shipping", "$100 off". */
const NON_PRICE_SUFFIX =
  /^\s*(?:shipping|delivery|handling|tax|fee|off|discount|credit|rebate|cashback)\b/i;

/**
 * Pull every currency amount out of a blob of text, keeping only those in the
 * requested currency that look like an actual asking price. Returns them in
 * the order they appeared.
 */
export const extractPrices = (text: string, currency: string): number[] => {
  const prices: number[] = [];
  // Symbol/code first (`$1,299.99`, `USD 1299`) or trailing (`1299 EUR`, `1.299,00 €`).
  const pattern =
    /(US\$|USD|GBP|EUR|[$£€])\s?(\d[\d.,]*)|(\d[\d.,]*)\s?(USD|GBP|EUR|[$£€])/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const symbol = (match[1] ?? match[4] ?? '').toLowerCase();
    const amount = match[2] ?? match[3] ?? '';
    if (CURRENCY_CODES[symbol] !== currency) continue;

    const before = text.slice(Math.max(0, match.index - 40), match.index);
    const after = text.slice(match.index + match[0].length);
    if (
      INSTALLMENT_SUFFIX.test(after) ||
      NON_PRICE_SUFFIX.test(after) ||
      NON_PRICE_PREFIX.test(before)
    ) {
      continue;
    }

    const value = parseAmount(amount);
    if (value !== null) prices.push(value);
  }

  return prices;
};

export const detectCondition = (text: string): Condition =>
  USED_KEYWORDS.some((keyword) => text.toLowerCase().includes(keyword))
    ? 'used'
    : 'new';

export const retailerName = (site: string): string => {
  if (KNOWN_RETAILERS[site]) return KNOWN_RETAILERS[site];
  // facebook.com/marketplace/... and similar: fall back to a tidied domain.
  const base = site.split('.')[0] ?? site;
  return base.charAt(0).toUpperCase() + base.slice(1);
};

/**
 * Turn search results into listings. Each result contributes at most one
 * listing — its lowest plausible price, since result text often contains a
 * sale price alongside a struck-through original.
 */
export const listingsFromResults = (
  results: SearchResult[],
  currency: string
): ExtractedListing[] => {
  const listings: ExtractedListing[] = [];

  for (const result of results) {
    const text = `${result.title} ${result.snippet}`;
    const prices = extractPrices(text, currency);
    if (prices.length === 0) continue;

    listings.push({
      platform: retailerName(result.site),
      price: Math.min(...prices),
      url: result.url,
      title: result.title,
      condition: detectCondition(text),
    });
  }

  return listings;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
};

/**
 * Drop prices that are wildly off the median. Product searches pull in
 * accessories ("case for X, $12") and bundles ("X + warranty, $4,000"), and
 * those wreck the average if left in.
 */
export const rejectOutliers = (
  listings: ExtractedListing[]
): ExtractedListing[] => {
  if (listings.length < 4) return listings;

  const mid = median(listings.map((l) => l.price));
  const kept = listings.filter(
    (l) => l.price >= mid * 0.15 && l.price <= mid * 4
  );
  return kept.length > 0 ? kept : listings;
};

/** One listing per retailer — the cheapest — so a single site can't dominate. */
export const dedupeByPlatform = (
  listings: ExtractedListing[]
): ExtractedListing[] => {
  const best = new Map<string, ExtractedListing>();

  for (const listing of listings) {
    const key = `${listing.platform}|${listing.condition}`;
    const existing = best.get(key);
    if (!existing || listing.price < existing.price) {
      best.set(key, listing);
    }
  }

  return [...best.values()].sort((a, b) => a.price - b.price);
};
