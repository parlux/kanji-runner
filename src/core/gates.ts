import type { Span } from "./crowd";
import {
  GATE_EDGE_MIN,
  GATE_MAX_W,
  GATE_MIN_W,
  GATE_OPENING_2,
  GATE_OPENING_3,
} from "./tuning";

/** One opening in a wall, from left to right (0..1), and its centre. */
export type Opening = { left: number; right: number; centre: number };

const opening = (left: number, width: number): Opening => ({
  left,
  right: left + width,
  centre: left + width / 2,
});

/** Openings of an n-answer wall, spread evenly with equal solid wall between and at the edges. */
export function gateOpenings(n: number): Opening[] {
  const w = n <= 2 ? GATE_OPENING_2 : GATE_OPENING_3;
  const gap = (1 - n * w) / (n + 1);
  return Array.from({ length: n }, (_, i) => opening(gap + i * (w + gap), w));
}

/** How far x is from an opening: 0 inside it, else the distance to its nearer edge. */
export function openingDistance(o: Span, x: number): number {
  return Math.max(0, o.left - x, x - o.right);
}

/** Index of the opening nearest x, by distance to its edges (0 inside it). Ties go left. */
export function nearestOpening(
  openings: readonly Opening[],
  x: number,
): number {
  let best = 0;
  openings.forEach((o, i) => {
    const b = openings[best] as Opening;
    if (openingDistance(o, x) < openingDistance(b, x)) best = i;
  });
  return best;
}

/** Solid parts of a wall: everything that isn't an opening. */
export function wallSolids(openings: readonly Opening[]): Span[] {
  return [...openings, { left: 1, right: 1 }].map((r, i) => ({
    left: i === 0 ? 0 : (openings[i - 1] as Opening).right,
    right: r.left,
  }));
}

/**
 * Opening i widened by up to `amount` (track widths) about its centre, to at
 * most GATE_MAX_W. The other openings narrow by the same total, shared
 * equally, none below GATE_MIN_W, so the growth also stops when they are all
 * at the minimum. The solid wall between openings keeps its width, so
 * openings never overlap. The solid at the two track edges takes up the
 * shift; when one would drop below GATE_EDGE_MIN the whole row slides the
 * other way instead (the grown opening's centre then moves).
 */
export function growOpening(
  openings: readonly Opening[],
  i: number,
  amount: number,
): Opening[] {
  const widths = openings.map((o) => o.right - o.left);
  const target = widths[i];
  if (target === undefined || !(amount > 0)) return [...openings];
  const slack = widths.map((w, j) =>
    j === i ? 0 : Math.max(0, w - GATE_MIN_W),
  );
  let room = Math.min(
    amount,
    Math.max(0, GATE_MAX_W - target),
    slack.reduce((a, b) => a + b, 0),
  );
  if (room <= 0) return [...openings];
  widths[i] = target + room;
  // share the narrowing equally, topping up from those with slack left
  while (room > 1e-12) {
    const open = slack.flatMap((s, j) => (s > 1e-12 ? [j] : []));
    if (open.length === 0) break;
    const share = room / open.length;
    for (const j of open) {
      const take = Math.min(share, slack[j] as number);
      slack[j] = (slack[j] as number) - take;
      widths[j] = (widths[j] as number) - take;
      room -= take;
    }
  }
  const between = openings
    .slice(1)
    .map((o, j) => o.left - (openings[j] as Opening).right);
  const edges =
    1 - widths.reduce((a, b) => a + b, 0) - between.reduce((a, b) => a + b, 0);
  const margin = Math.min(GATE_EDGE_MIN, edges / 2);
  // left edge solid that keeps opening i's centre where it was
  let before = 0;
  for (let j = 0; j < i; j++)
    before += (widths[j] as number) + (between[j] as number);
  const centre = (openings[i] as Opening).centre;
  const first = Math.min(
    edges - margin,
    Math.max(margin, centre - (widths[i] as number) / 2 - before),
  );
  let left = first;
  return widths.map((w, j) => {
    const o = opening(left, w);
    left = o.right + (between[j] ?? 0);
    return o;
  });
}
