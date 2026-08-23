/**
 * Cheap heuristics for routing a chat message. Asking the model to classify
 * first would double latency on a small local model, so pattern matching does
 * the routing and the user can always override it from settings.
 */

const PRICE_PATTERNS: RegExp[] = [
  /\bprices?\b/i,
  /\bcosts?\b/i,
  /\bhow much\b/i,
  /\bcheapest\b/i,
  /\bdeals?\b/i,
  /\bmsrp\b/i,
  /\bworth\b/i,
  /\bscan\b/i,
  /\bresale\b/i,
  /\bsecond ?hand\b/i,
  /\bretails? for\b/i,
  /\bgoing for\b/i,
  // "what do people sell it for", "what does it sell for", "sellers asking"
  /\bsell(?:s|ing|ers)?\b[^.?!]{0,40}\bfor\b/i,
  /\bsell(?:s|ing|ers)?\b[^.?!]{0,20}\b(?:asking|price)\b/i,
];

const SEARCH_PATTERNS: RegExp[] = [
  /\bsearch\b/i,
  /\blook ?up\b/i,
  /\bfind\b/i,
  /\bwho(?:'s| is| are| was)\b/i,
  /\bwhat(?:'s| is| are| was)\b/i,
  /\bwhen (?:did|is|was|does)\b/i,
  /\bwhere (?:is|can|do)\b/i,
  /\blatest\b/i,
  /\bnews\b/i,
  /\btoday\b/i,
  /\bcurrent(?:ly)?\b/i,
  /\brecent\b/i,
  /\brelease date\b/i,
  /\breviews?\b/i,
  /\bcompare\b/i,
  /\bvs\.?\b/i,
];

const matchesAny = (text: string, patterns: RegExp[]) =>
  patterns.some((pattern) => pattern.test(text));

/** True when the message is asking what something costs or sells for. */
export const isPriceQuery = (message: string): boolean =>
  matchesAny(message, PRICE_PATTERNS);

/** True when the message likely needs facts the model doesn't hold. */
export const needsWebSearch = (message: string): boolean =>
  isPriceQuery(message) || matchesAny(message, SEARCH_PATTERNS);

/**
 * Strip the conversational wrapper off a price question so the product name is
 * what reaches the search engine: "how much does an iPhone 15 cost?" -> "iPhone 15".
 */
export const extractProductName = (message: string): string =>
  message
    .replace(/[?!.]+$/g, '')
    .replace(/^\s*(?:hey|hi|please|can you|could you|i want to know|tell me)\b[\s,]*/gi, '')
    .replace(
      /\b(?:what(?:'s| is| are| do| does)|how much (?:does|do|is|are)|scan|check|find|look ?up|search for)\b/gi,
      ' '
    )
    .replace(
      /\b(?:price|prices|cost|costs|worth|deal|deals|going|sell|sells|selling|sellers|resale|retails?)\b/gi,
      ' '
    )
    .replace(/\b(?:people|ppl|they|someone|everyone)\b/gi, ' ')
    .replace(/\b(?:of|for|on|at|a|an|the|me|it|currently|typically|usually|about)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
