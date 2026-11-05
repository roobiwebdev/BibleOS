/**
 * SOURCE OF TRUTH KEYWORDS: HtmlToken, tokenizeHtml, decodeEntities, publisher HTML, tag stream
 * WHAT:  A small tokenizer for the passage HTML the ESV and NLT APIs return: open tags with
 *        their attributes, close tags and decoded text, in document order.
 * WHY:   Serverless functions have no DOM, and both publishers send simple, well-known markup
 *        (and the NLT's is not always well-formed: it opens <p> without closing it). A token
 *        stream lets each parser follow verse markers and blocks without building a tree.
 * WHERE: relay/passage.ts, relay/nlt.ts.
 */
export type HtmlToken =
  | { kind: "open"; tag: string; attrs: Readonly<Record<string, string>>; selfClosing: boolean }
  | { kind: "close"; tag: string }
  | { kind: "text"; text: string };

const NAMED: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  copy: "©",
  reg: "®",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) return String.fromCodePoint(Number.parseInt(body.slice(2), 16));
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10));
    return NAMED[body.toLowerCase()] ?? whole;
  });
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const name = match[1];
    if (name) attrs[name.toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

export function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  // Comments, doctype and processing instructions carry no text we show.
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<![^>]*>/g, "");
  for (const match of cleaned.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9_-]*)([^>]*)>|([^<]+)/g)) {
    const [, slash, tag, rest, text] = match;
    if (text !== undefined) {
      tokens.push({ kind: "text", text: decodeEntities(text) });
    } else if (tag) {
      const name = tag.toLowerCase();
      if (slash) tokens.push({ kind: "close", tag: name });
      else {
        const body = rest ?? "";
        tokens.push({ kind: "open", tag: name, attrs: parseAttrs(body), selfClosing: /\/\s*$/.test(body) });
      }
    }
  }
  return tokens;
}

export const classesOf = (attrs: Readonly<Record<string, string>>): string[] =>
  (attrs.class ?? "").split(/\s+/).filter((c) => c.length > 0);

/** Tags that never have a closing tag, so skipping one must not wait for it. */
export const VOID_TAGS: ReadonlySet<string> = new Set(["br", "hr", "img", "input", "meta", "link", "wbr"]);
