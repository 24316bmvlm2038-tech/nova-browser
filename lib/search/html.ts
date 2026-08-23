/**
 * Result markup is full of typographic and currency entities. The currency
 * ones matter functionally: an undecoded `&pound;` means a GBP scan finds no
 * prices at all.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  pound: '£',
  euro: '€',
  cent: '¢',
  yen: '¥',
  dollar: '$',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  middot: '·',
  bull: '•',
  trade: '™',
  reg: '®',
  copy: '©',
  deg: '°',
  times: '×',
};

/** Decode the handful of HTML entities that show up in search result markup. */
export const decodeEntities = (input: string): string =>
  input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (entity.startsWith('#')) {
      const code = parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity] ?? match;
  });

/** Strip tags and collapse whitespace, so `<b>iPhone</b>  15` becomes `iPhone 15`. */
export const stripTags = (input: string): string =>
  decodeEntities(input.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/** Hostname without the `www.` prefix, or '' when the URL is unparseable. */
export const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
