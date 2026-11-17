/**
 * Kanji progression order. Pure functions, called by `build-data.ts` and
 * `coverage.ts`: `usefulOrder` is the shipped order (SPEC-useful-order),
 * `byGrade` the old one, kept for the coverage comparison and as the tail.
 */
import type { RawKanji } from "./sources";

export type OrderOverride = { char: string; before?: string; after?: string };

/** Moves each override's kanji before or after its target. */
function applyOverrides(order: string[], overrides: OrderOverride[]): string[] {
  const out = [...order];
  const known = new Set(order);
  for (const o of overrides) {
    const target = o.before ?? o.after;
    if (!known.has(o.char) || !target || !known.has(target))
      throw new Error(`bad order override ${JSON.stringify(o)}`);
    out.splice(out.indexOf(o.char), 1);
    out.splice(out.indexOf(target) + (o.before ? 0 : 1), 0, o.char);
  }
  return out;
}

/**
 * Progression order: grade, then frequency (unranked last, then by strokes and
 * code point), then the component pass (a component that is itself in the set
 * comes before every kanji using it), then the order overrides.
 */
export function byGrade(
  raw: RawKanji[],
  components: Map<string, string[]>,
  overrides: OrderOverride[],
): string[] {
  const base = [...raw]
    .sort(
      (a, b) =>
        a.grade - b.grade ||
        (a.freq ?? Infinity) - (b.freq ?? Infinity) ||
        a.strokes - b.strokes ||
        (a.char.codePointAt(0) ?? 0) - (b.char.codePointAt(0) ?? 0),
    )
    .map((k) => k.char);
  const rank = new Map(base.map((c, i) => [c, i]));
  const order: string[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();
  const place = (c: string): void => {
    if (placed.has(c) || visiting.has(c)) return;
    visiting.add(c);
    const parts = (components.get(c) ?? []).filter((p) => rank.has(p));
    parts
      .sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0))
      .forEach(place);
    visiting.delete(c);
    placed.add(c);
    order.push(c);
  };
  base.forEach(place);
  return applyOverrides(order, overrides);
}

/** A word racing for the order: its spelling, value and theme membership. */
export type RaceWord = { word: string; value: number; theme: boolean };

/** Why a kanji sits where it does in `usefulOrder`. */
export type Why =
  | { kind: "word"; word: RaceWord }
  | { kind: "block"; of: string; word: RaceWord }
  | { kind: "leftover" };

/** Cost of a kanji: `1 + strokes / STROKES_PER_UNIT` (amended in U4). */
export const STROKES_PER_UNIT = 20;
const kanjiCost = (k: RawKanji) => 1 + k.strokes / STROKES_PER_UNIT;
/** A building block costs this share of its kanji cost (amended in U4). */
export const BLOCK_COST = 0.25;
/**
 * Weight of the lookahead: the value shares a word's kanji also bring to the
 * other words that need them (amended in U4).
 */
export const LOOKAHEAD = 1;

/**
 * The greedy order (SPEC-useful-order: Kanji order, amended in U4). A word's
 * cost is the cost of its unplaced kanji plus `BLOCK_COST` times that of
 * their unplaced building blocks (KRADFILE elements that are Jōyō kanji,
 * recursively). Each live word shares its value over its own unplaced kanji
 * in proportion to their cost (blocks get no share); a kanji's `gain` is the
 * sum of the shares it holds. A word's score is
 * `(value + LOOKAHEAD · others) / cost`, where `others` is the gain of its
 * unplaced kanji minus its own shares: what placing them also does for the
 * other words that need them. Repeatedly the best-scoring word (ties within
 * float noise: value, then spelling) places its unplaced kanji, building
 * blocks first, each group by `byGrade` rank. Words with nothing left to
 * place drop out. When no word with value > 0 is left, the remaining kanji
 * follow in `byGrade` order. Overrides apply last.
 */
export function usefulOrder(
  raw: RawKanji[],
  components: Map<string, string[]>,
  words: RaceWord[],
  overrides: OrderOverride[],
): { order: string[]; why: Map<string, Why> } {
  const tail = byGrade(raw, components, []);
  const rank = new Map(tail.map((c, i) => [c, i]));
  const cost = new Map(raw.map((k) => [k.char, kanjiCost(k)]));
  const byRank = (a: string, b: string) =>
    (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
  const partsOf = (c: string) =>
    (components.get(c) ?? []).filter((p) => rank.has(p)).sort(byRank);

  // Closure of a kanji: itself and its building blocks, recursively.
  const closures = new Map<string, Set<string>>();
  const closure = (c: string, seen = new Set<string>()): Set<string> => {
    const done = closures.get(c);
    if (done) return done;
    const out = new Set([c]);
    seen.add(c);
    for (const p of partsOf(c))
      if (!seen.has(p)) for (const q of closure(p, seen)) out.add(q);
    seen.delete(c);
    closures.set(c, out);
    return out;
  };

  type Racer = {
    word: RaceWord;
    need: Map<string, number>;
    kanji: string[];
    cost: number;
    left: number;
  };
  const racers: Racer[] = [];
  const byKanji = new Map<string, Racer[]>();
  for (const w of words) {
    if (!(w.value > 0)) continue;
    const kanji = [...new Set([...w.word].filter((c) => rank.has(c)))].sort(
      byRank,
    );
    const need = new Map<string, number>();
    for (const c of kanji.flatMap((c) => [...closure(c)]))
      need.set(c, (cost.get(c) ?? 0) * (kanji.includes(c) ? 1 : BLOCK_COST));
    if (!need.size) continue;
    const r: Racer = { word: w, need, kanji, cost: 0, left: need.size };
    for (const [c, n] of need) {
      r.cost += n;
      const list = byKanji.get(c);
      if (list) list.push(r);
      else byKanji.set(c, [r]);
    }
    racers.push(r);
  }

  const order: string[] = [];
  const why = new Map<string, Why>();
  // gain(k): the shares of every live word's value its unplaced kanji hold.
  const gain = new Map<string, number>();
  const share = (r: Racer, sign: number) => {
    if (r.left <= 0) return;
    for (const c of r.kanji)
      if (!why.has(c))
        gain.set(
          c,
          (gain.get(c) ?? 0) +
            (sign * r.word.value * (cost.get(c) ?? 0)) / r.cost,
        );
  };
  for (const r of racers) share(r, 1);
  const place = (c: string, root: string, w: RaceWord): void => {
    if (why.has(c)) return;
    why.set(c, { kind: "leftover" }); // marks it as in progress
    for (const p of partsOf(c)) place(p, root, w);
    why.set(
      c,
      c === root || w.word.includes(c)
        ? { kind: "word", word: w }
        : { kind: "block", of: root, word: w },
    );
    order.push(c);
    for (const r of byKanji.get(c) ?? []) {
      share(r, -1);
      r.cost -= r.need.get(c) ?? 0;
      r.left--;
      share(r, 1);
    }
  };
  const score = (r: Racer): number => {
    let others = 0;
    for (const c of r.kanji)
      if (!why.has(c))
        others +=
          (gain.get(c) ?? 0) - (r.word.value * (cost.get(c) ?? 0)) / r.cost;
    return (r.word.value + LOOKAHEAD * others) / r.cost;
  };

  let live = racers;
  for (;;) {
    live = live.filter((r) => r.left > 0);
    let best: Racer | undefined;
    let bestScore = -Infinity;
    for (const r of live) {
      const s = score(r);
      // Scores within float noise tie (words sharing their unplaced kanji).
      const tol = 1e-9 * Math.abs(bestScore);
      if (
        !best ||
        s > bestScore + tol ||
        (s >= bestScore - tol &&
          (r.word.value > best.word.value ||
            (r.word.value === best.word.value && r.word.word < best.word.word)))
      ) {
        best = r;
        bestScore = s;
      }
    }
    if (!best) break;
    for (const c of best.kanji) place(c, c, best.word);
  }
  for (const c of tail)
    if (!why.has(c)) {
      why.set(c, { kind: "leftover" });
      order.push(c);
    }
  return { order: applyOverrides(order, overrides), why };
}

/** Levels the order report lists (Kanji 1–20). */
const REPORT_LEVELS = { from: 2, to: 21 };

/**
 * The order report: a one-line summary (kanji from theme words, from other
 * words, leftovers; building blocks count with the word that pulled them),
 * then per level 2–21 each kanji and why it came. `levelOf` gives each
 * kanji's level.
 */
export function orderReport(
  order: string[],
  why: Map<string, Why>,
  levelOf: (index: number) => number,
): string {
  const all = order.map((c) => why.get(c) ?? { kind: "leftover" as const });
  const fromWord = all.filter((w) => w.kind !== "leftover");
  const theme = fromWord.filter((w) => w.word.theme).length;
  const blocks = all.filter((w) => w.kind === "block").length;
  const leftovers = all.length - fromWord.length;
  const fmt = (n: number) => n.toFixed(2);
  const line = (c: string, w: Why) =>
    w.kind === "leftover"
      ? `${c}  leftover`
      : w.kind === "block"
        ? `${c}  building block of ${w.of} (${w.word.word} ${fmt(w.word.value)})`
        : `${c}  ${w.word.word} ${fmt(w.word.value)}${w.word.theme ? " theme" : ""}`;
  const out = [
    `order: ${theme} kanji from theme words, ${fromWord.length - theme} from other words (${blocks} of them building blocks), ${leftovers} leftovers`,
  ];
  let level = -1;
  order.forEach((c, i) => {
    const l = levelOf(i);
    if (l < REPORT_LEVELS.from || l > REPORT_LEVELS.to) return;
    if (l !== level) out.push("", `# Level ${l}`);
    level = l;
    out.push(line(c, all[i] ?? { kind: "leftover" }));
  });
  return [...out, ""].join("\n");
}
