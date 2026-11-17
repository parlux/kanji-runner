/**
 * Kanji progression order. Pure functions, called by `build-data.ts` and
 * `coverage.ts`.
 */
import type { RawKanji } from "./sources";

export type OrderOverride = { char: string; before?: string; after?: string };

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
  for (const o of overrides) {
    const target = o.before ?? o.after;
    if (!rank.has(o.char) || !target || !rank.has(target))
      throw new Error(`bad order override ${JSON.stringify(o)}`);
    order.splice(order.indexOf(o.char), 1);
    order.splice(order.indexOf(target) + (o.before ? 0 : 1), 0, o.char);
  }
  return order;
}
