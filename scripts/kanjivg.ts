/**
 * Kanji components from KanjiVG (SPEC-own-stories: Composite parts): the
 * chunks you see, one level down (閉 = 門 才), not the smallest strokes.
 *
 * `parseKanjivg` reads each kanji's element tree; `composite` applies the
 * rule: a chunk stays a part if `parts.json` names it, it is a kanji in our
 * list, or it is a chunk of 2+ kanji; otherwise it is replaced by its own
 * chunks, recursively. A chunk with no chunks of its own stays.
 */

/** One `kvg:element` group: its glyph (variant-mapped) and its own chunks. */
export type Chunk = {
  element: string;
  /** Chunks inside it, in KanjiVG order; a split element counts once. */
  children: Chunk[];
  /**
   * Strokes drawn directly in this group, outside any child chunk. A chunk
   * with loose strokes is never broken down: its chunks would lose them.
   */
  loose: boolean;
};

/**
 * KanjiVG writes some elements as a different code point from the glyph
 * `parts.json` uses (the radical form, or a look-alike). Map them over.
 */
export const VARIANTS: Record<string, string> = {
  氵: "⺡",
  亻: "⺅",
  扌: "⺘",
  艹: "⺾",
  丿: "ノ",
  忄: "⺖",
  刂: "⺉",
  八: "ハ",
  灬: "⺣",
  丨: "｜",
  礻: "⺭",
  衤: "⻂",
  罒: "⺲",
  // Found by matching KanjiVG elements (and their kvg:original) to the
  // glyphs parts.json names, which came from KRADFILE.
  㓁: "⺲",
  "⺢": "⺡",
  犭: "⺨",
  疒: "⽧",
  耂: "⺹",
  辶: "⻌",
  覀: "西",
  "⺕": "ヨ",
  彐: "ヨ",
  "⺤": "爪",
  "⺦": "爿",
  丬: "爿",
  禸: "⽱",
  己: "已",
  飠: "食",
  "⻞": "食",
  "𦥑": "臼",
  匸: "匚",
  黑: "黒",
  黃: "黄",
  "𩵋": "魚",
};

/** The glyph `parts.json` uses for a KanjiVG element. */
export const mapVariant = (e: string): string => VARIANTS[e] ?? e;

/** A single character (one code point); CDP ids and ⿱… sequences are not. */
const isGlyph = (e: string): boolean => [...e].length === 1;

type Group = {
  element?: string;
  part?: string;
  groups: Group[];
  /** Child items in order: groups and stroke paths. */
  items: ("path" | Group)[];
};

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1];

/** Parse one kanji's `<g>` body into a group tree (root group returned). */
function parseGroups(body: string): Group | undefined {
  const root: Group = { groups: [], items: [] };
  const stack: Group[] = [root];
  for (const m of body.matchAll(/<g\b[^>]*?(\/?)>|<\/g>|<path\b/g)) {
    const top = stack[stack.length - 1];
    if (!top) break;
    const tag = m[0];
    if (tag.startsWith("<path")) top.items.push("path");
    else if (tag === "</g>") stack.pop();
    else {
      const g: Group = {
        element: attr(tag, "kvg:element"),
        part: attr(tag, "kvg:part"),
        groups: [],
        items: [],
      };
      top.groups.push(g);
      top.items.push(g);
      if (m[1] !== "/") stack.push(g);
    }
  }
  return root.groups[0];
}

/** Named descendants of a group, descending through unnamed and non-glyph groups. */
function named(g: Group): Group[] {
  return g.groups.flatMap((c) =>
    c.element && isGlyph(c.element) ? [c] : named(c),
  );
}

/** Strokes in `g` not inside any named (glyph) group. */
function hasLoose(g: Group): boolean {
  return g.items.some(
    (i) => i === "path" || (!(i.element && isGlyph(i.element)) && hasLoose(i)),
  );
}

/**
 * Chunks of a list of groups that together draw one element (a split
 * element has two or more groups with `kvg:part`): their named descendants,
 * the parts of one split element merged into one chunk at the first part.
 */
function chunksOf(groups: Group[]): Chunk[] {
  const kids = groups.flatMap(named);
  const out: Chunk[] = [];
  const merged = new Set<Group>();
  for (const k of kids) {
    if (merged.has(k)) continue;
    const element = k.element ?? "";
    // The other parts of a split element: same element, later in the list.
    const same = k.part
      ? kids.filter((o) => o !== k && o.part && o.element === element)
      : [];
    for (const o of same) merged.add(o);
    const all = [k, ...same];
    out.push({
      element: mapVariant(element),
      children: chunksOf(all),
      loose: all.some(hasLoose),
    });
  }
  return out;
}

/**
 * KanjiVG XML → each listed kanji's chunks (only the base entry per kanji,
 * not the `-Kaisho` style variants).
 */
export function parseKanjivg(
  xml: string,
  chars: ReadonlySet<string>,
): Map<string, Chunk[]> {
  const out = new Map<string, Chunk[]>();
  for (const [, hex = "", body = ""] of xml.matchAll(
    /<kanji id="kvg:kanji_([0-9a-f]+)">([\s\S]*?)<\/kanji>/g,
  )) {
    const char = String.fromCodePoint(parseInt(hex, 16));
    if (!chars.has(char)) continue;
    const root = parseGroups(body);
    if (root) out.set(char, chunksOf([root]));
  }
  return out;
}

/**
 * How many kanji each element is a chunk of, at any depth (after variant
 * mapping; once per kanji).
 */
export function chunkUses(trees: Map<string, Chunk[]>): Map<string, number> {
  const uses = new Map<string, number>();
  const walk = (cs: Chunk[], seen: Set<string>) => {
    for (const c of cs) {
      seen.add(c.element);
      walk(c.children, seen);
    }
  };
  for (const [char, cs] of trees) {
    const seen = new Set<string>();
    walk(cs, seen);
    seen.delete(char);
    for (const e of seen) uses.set(e, (uses.get(e) ?? 0) + 1);
  }
  return uses;
}

/**
 * A kanji's components by the rule: keep a chunk if `keep(element)`, if it
 * has no chunks of its own, or if it has loose strokes; otherwise its chunks
 * in its place, recursively. Order follows KanjiVG; duplicates and the kanji
 * itself dropped.
 */
export function composite(
  char: string,
  chunks: Chunk[],
  keep: (element: string) => boolean,
): string[] {
  const out: string[] = [];
  const add = (cs: Chunk[]) => {
    for (const c of cs) {
      if (keep(c.element) || c.children.length === 0 || c.loose)
        out.push(c.element);
      else add(c.children);
    }
  };
  add(chunks);
  return [...new Set(out)].filter((e) => e !== char);
}

/** Components of every kanji: the keep rule over `named` parts, `kanji` and 2+ uses. */
export function components(
  trees: Map<string, Chunk[]>,
  named: ReadonlySet<string>,
  kanji: ReadonlySet<string>,
): Map<string, string[]> {
  const uses = chunkUses(trees);
  const keep = (e: string) =>
    named.has(e) || kanji.has(e) || (uses.get(e) ?? 0) >= 2;
  return new Map(
    [...trees].map(([char, cs]) => [char, composite(char, cs, keep)]),
  );
}

/** A component `parts.json` doesn't name yet, for the part namers. */
export type NewPart = {
  part: string;
  /** A kanji in our list (named by its gloss) rather than a shape. */
  kanji: boolean;
  /** Kanji that list it, in the given (progression) order. */
  uses: string[];
  /** Its own chunks in KanjiVG (first occurrence). */
  children: string[];
};

/**
 * New parts (in order of first use) and the `named` parts no kanji lists
 * any more (in `named` order).
 */
export function partsReport(
  kanji: { char: string; components: string[] }[],
  trees: Map<string, Chunk[]>,
  named: readonly string[],
  chars: ReadonlySet<string>,
): { added: NewPart[]; removed: string[] } {
  const children = new Map<string, string[]>();
  const walk = (cs: Chunk[]) => {
    for (const c of cs) {
      if (!children.has(c.element))
        children.set(
          c.element,
          c.children.map((k) => k.element),
        );
      walk(c.children);
    }
  };
  for (const cs of trees.values()) walk(cs);
  const uses = new Map<string, string[]>();
  for (const k of kanji)
    for (const c of k.components) uses.set(c, [...(uses.get(c) ?? []), k.char]);
  const known = new Set(named);
  const added = [...uses]
    .filter(([part]) => !known.has(part))
    .map(([part, u]) => ({
      part,
      kanji: chars.has(part),
      uses: u,
      children: children.get(part) ?? [],
    }));
  return { added, removed: named.filter((p) => !uses.has(p)) };
}
