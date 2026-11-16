/** The inline tags WaniKani mnemonics use; every other tag is dropped. */
const MNEMONIC_TAGS = [
  "radical",
  "kanji",
  "reading",
  "vocabulary",
  "ja",
  "em",
] as const;
type MnemonicTag = (typeof MNEMONIC_TAGS)[number];

/** A run of plain text and the (innermost known) tag it sits in, if any. */
export type MnemonicSegment = { text: string; tag: MnemonicTag | null };

const KNOWN = new Set<string>(MNEMONIC_TAGS);
const ENTITIES: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decodes the common entities to text. The result is only ever used as text, so it stays inert. */
function decode(s: string): string {
  return s.replace(/&(#\d{1,6}|#x[0-9a-f]{1,5}|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n =
        e[1] === "x" || e[1] === "X"
          ? parseInt(e.slice(2), 16)
          : Number(e.slice(1));
      return n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff)
        ? String.fromCodePoint(n)
        : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)(?:\s[^<>]*)?\/?>/g;

/**
 * Parses mnemonic text into segments. Known tags become `tag`; unknown tags
 * and all attributes are dropped but their text is kept; stray `<` stays as
 * text; unclosed tags run to the end. Output is text only, never markup, so
 * render it with `textContent`.
 */
export function parseMnemonic(input: string): MnemonicSegment[] {
  const out: MnemonicSegment[] = [];
  const stack: MnemonicTag[] = [];
  const push = (raw: string) => {
    const text = decode(raw);
    if (!text) return;
    const tag = stack[stack.length - 1] ?? null;
    const last = out[out.length - 1];
    if (last && last.tag === tag) last.text += text;
    else out.push({ text, tag });
  };
  let at = 0;
  for (const m of input.matchAll(TAG)) {
    push(input.slice(at, m.index));
    at = m.index + m[0].length;
    const name = (m[2] ?? "").toLowerCase();
    if (!KNOWN.has(name)) continue;
    if (m[1] === "/") {
      const i = stack.lastIndexOf(name as MnemonicTag);
      if (i >= 0) stack.length = i;
    } else if (!m[0].endsWith("/>")) stack.push(name as MnemonicTag);
  }
  push(input.slice(at));
  return out;
}

/** Builds DOM nodes for a mnemonic: text nodes and `<span class="mn-TAG">`, nothing else. */
export function mnemonicNodes(input: string, doc: Document = document): Node[] {
  return parseMnemonic(input).map((s) => {
    if (s.tag === null) return doc.createTextNode(s.text);
    const span = doc.createElement("span");
    span.className = `mn-${s.tag}`;
    span.textContent = s.text;
    return span;
  });
}

const BRACKET = /<\/reading>\s*[(（]([^)）]*)[)）]/gi;

/** Katakana to hiragana, leaving everything else alone. */
export const toHiragana = (s: string): string =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** The readings a kanji reading story is about, from its `</reading> (かな)` brackets. */
export function coveredReadings(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(BRACKET))
    for (const part of (m[1] ?? "").split(/[、,/]/)) {
      const r = toHiragana(part.trim());
      if (/^[ぁ-ゖー]+$/.test(r)) out.add(r);
    }
  return [...out];
}

/** The readings a kanji story stands for: its bracketed readings, else the primary ones. */
export function storyReadings(
  text: string | undefined,
  primary: readonly string[] = [],
): readonly string[] {
  const covered = text ? coveredReadings(text) : [];
  return covered.length > 0 ? covered : primary;
}
