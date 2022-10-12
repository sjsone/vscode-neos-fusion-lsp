const PATTERN = /(\s*([^>\s]*))/g;
const QUOTES = new Map([
  [`"`, `"`],
  [`"`, `"`],
  [`{`, `}`]
]);

/**
 * Extract an attribute from a chunk of text.
 */
export default function readAttribute(str: string, pos: number) {
  const quote = str.charAt(pos);
  const pos1 = pos + 1;
  if (QUOTES.has(quote)) {
    const nextQuote = str.indexOf(QUOTES.get(quote), pos1);
    if (nextQuote === -1) {
      return { length: str.length - pos, value: str.substring(pos1), quote };
    } else {
      return { length: (nextQuote - pos) + 1, value: str.substring(pos1, nextQuote), quote };
    }
  } else {
    PATTERN.lastIndex = pos;
    const match = PATTERN.exec(str) || [];
    return { length: match[1].length, value: match[2] };
  }
}
