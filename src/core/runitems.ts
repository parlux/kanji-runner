import { firstReading } from "./distractors";
import { missedItems } from "./run";
import { itemKey } from "./srs";
import type {
  GateRow,
  GateType,
  KanaItem,
  KanjiItem,
  Progress,
  WordItem,
} from "./types";

/** One gate asked this run: its box before and after, and whether any answer to it was wrong. */
type RunGate = {
  gate: GateType;
  from: number;
  to: number;
  missed: boolean;
  /** The right answer, only when `missed` (reading gate: every main reading). */
  answers?: string[];
};

/** How the run moved an item. */
type RunChange = "new" | "up" | "slip" | "same";

/** One item met in a run; its meaning and reading gates fold into one entry. */
export type RunItem = {
  /** The char (kana, kanji) or word. */
  key: string;
  kind: "kana" | "kanji" | "word" | "loanword";
  meaning: string;
  /** Kanji: the study card's first reading; kanji word: its reading; else none. */
  reading?: string;
  change: RunChange;
  /** Gates asked this run, in first-asked order. */
  gates: RunGate[];
  /** The item's other gate (kanji, kanji word) when not asked: its box now. */
  other?: { gate: GateType; box: number };
};

const CHANGE_ORDER: RunChange[] = ["new", "up", "slip", "same"];
const GATES: Partial<Record<GateType, GateType>> = {
  meaning: "reading",
  reading: "meaning",
  word: "wordreading",
  wordreading: "word",
};

/**
 * Every item met in the run, one entry each (gates folded), ordered new, up,
 * slip, same and by first asked within each. Only answered rows count
 * (`results` may be shorter than `rows`). Boxes come from `before` vs `after`,
 * so re-asks are already folded. Pass the mode's own items: kanji only in
 * WaniKani mode, no words in meaning mode, etc.; unknown items are skipped.
 */
export function runItems(
  before: Progress,
  after: Progress,
  rows: readonly GateRow[],
  results: readonly boolean[],
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: readonly WordItem[] = [],
): RunItem[] {
  const wrong = new Map<number, string[]>();
  for (const m of missedItems(rows, results, [], kanji, words))
    wrong.set(m.q - 1, m.answers);
  const box = (p: Progress, key: string): number => p.items[key]?.box ?? 0;
  const entries = new Map<
    string,
    { item: Omit<RunItem, "change">; types: GateType[] }
  >();
  const gateAt = new Map<string, RunGate>();
  results.forEach((ok, i) => {
    const row = rows[i];
    if (!row) return;
    const gKey = itemKey(row.prompt, row.type);
    const seen = gateAt.get(gKey);
    if (seen) {
      if (!ok) {
        seen.missed = true;
        seen.answers ??= wrong.get(i);
      }
      return;
    }
    const gate: RunGate = {
      gate: row.type,
      from: box(before, gKey),
      to: box(after, gKey),
      missed: !ok,
      ...(ok ? {} : { answers: wrong.get(i) }),
    };
    gateAt.set(gKey, gate);
    const have = entries.get(row.prompt);
    if (have) {
      have.item.gates.push(gate);
      have.types.push(row.type);
      return;
    }
    const item = describe(row, kana, kanji, words);
    if (item)
      entries.set(row.prompt, {
        item: { ...item, gates: [gate] },
        types: [row.type],
      });
  });
  const out = [...entries.values()].map(({ item, types }) => {
    const sibling = GATES[types[0] as GateType];
    const twoGates = sibling !== undefined && item.kind !== "loanword";
    const all = twoGates
      ? [types[0] as GateType, sibling]
      : [types[0] as GateType];
    const fresh = all.every((t) => !before.items[itemKey(item.key, t)]);
    const other = twoGates && !types.includes(sibling) ? sibling : undefined;
    const change: RunChange = fresh
      ? "new"
      : item.gates.some((g) => g.to < g.from)
        ? "slip"
        : item.gates.some((g) => g.to > g.from)
          ? "up"
          : "same";
    return {
      ...item,
      change,
      ...(other
        ? { other: { gate: other, box: box(after, itemKey(item.key, other)) } }
        : {}),
    };
  });
  return CHANGE_ORDER.flatMap((c) => out.filter((e) => e.change === c));
}

/** The entry for the item a row asks, or undefined when the item isn't in the mode's lists. */
function describe(
  row: GateRow,
  kana: readonly KanaItem[],
  kanji: readonly KanjiItem[],
  words: readonly WordItem[],
): Omit<RunItem, "change" | "gates"> | undefined {
  if (row.type === "kana") {
    const k = kana.find((x) => x.char === row.prompt);
    return k && { key: k.char, kind: "kana", meaning: k.romaji };
  }
  if (row.type === "meaning" || row.type === "reading") {
    const k = kanji.find((x) => x.char === row.prompt);
    if (!k) return undefined;
    const reading = firstReading(k);
    return {
      key: k.char,
      kind: "kanji",
      meaning: k.glosses[0] ?? "",
      ...(reading ? { reading } : {}),
    };
  }
  const w = words.find((x) => x.word === row.prompt);
  if (!w) return undefined;
  return {
    key: w.word,
    kind: w.reading ? "word" : "loanword",
    meaning: w.glosses[0] ?? "",
    ...(w.reading ? { reading: w.reading } : {}),
  };
}
