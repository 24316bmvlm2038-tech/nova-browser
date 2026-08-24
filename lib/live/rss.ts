import { decodeEntities, stripTags } from '../search/html';

export interface FeedEntry {
  title: string;
  link: string;
  published?: string;
  summary?: string;
  author?: string;
}

/** Pull the text of the first `<tag>` inside a block, unwrapping CDATA. */
const tagText = (block: string, ...tags: string[]): string => {
  for (const tag of tags) {
    const match = block.match(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
    );
    if (match) {
      const raw = match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
      // Feeds escape markup inside descriptions (`&lt;a href=...&gt;`), so decode
      // before stripping — stripping first would let the tags reappear as text.
      const text = stripTags(decodeEntities(raw));
      if (text) return text;
    }
  }
  return '';
};

/** Atom links carry the URL in an attribute rather than the element body. */
const atomLink = (block: string): string => {
  const alternate = block.match(
    /<link[^>]*\brel=["']alternate["'][^>]*\bhref=["']([^"']+)["']/i
  );
  if (alternate) return decodeEntities(alternate[1]);

  const plain = block.match(/<link[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  return plain ? decodeEntities(plain[1]) : '';
};

/**
 * Parse RSS 2.0 and Atom well enough for news feeds. A real XML parser would be
 * more correct, but feeds here are machine-generated and this avoids a
 * dependency for what amounts to five fields.
 */
export const parseFeed = (xml: string, limit = 20): FeedEntry[] => {
  const entries: FeedEntry[] = [];
  const blockPattern = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;

  let match: RegExpExecArray | null;
  while ((match = blockPattern.exec(xml)) !== null && entries.length < limit) {
    const block = match[2];

    const title = tagText(block, 'title');
    // RSS puts the URL in <link>text</link>; Atom puts it in an href attribute.
    const link = tagText(block, 'link') || atomLink(block);
    if (!title || !link) continue;

    entries.push({
      title,
      link,
      published: tagText(block, 'pubDate', 'published', 'updated') || undefined,
      summary: tagText(block, 'description', 'summary', 'content') || undefined,
      author:
        tagText(block, 'dc:creator', 'author', 'name') || undefined,
    });
  }

  return entries;
};

/** Feed dates are RFC 822 or ISO 8601; normalize both to ISO, or drop them. */
export const toIso = (value?: string): string | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
