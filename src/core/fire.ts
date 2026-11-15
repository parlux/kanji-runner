import type { Span } from "./crowd";
import {
  applyCorrect,
  applyCorrectCharge,
  applyWrong,
  applyWrongCharge,
} from "./scoring";
import type { Track } from "./track";
import {
  BASE_REWARD,
  BLOCK_HP_K,
  ENEMY_MIN,
  HORDE_DEFAULTS,
  FIRE_PER_SOLDIER,
  FIRE_RANGE,
  PACK_ADAPT,
  STARTING_ARMY,
  type HordeTuning,
} from "./tuning";
import type { GateRow } from "./types";

/** Damage per second an army deals. */
export function firepower(army: number): number {
  return FIRE_PER_SOLDIER * army;
}

/**
 * Army after each question in a deterministic 80%-accuracy pass (every 5th
 * answer wrong, no clipping), scoring the questions in `charges` as squad
 * charges. Index q is the army after q answers; [0] is the start.
 */
export function expectedArmy(
  rows: readonly GateRow[],
  charges: readonly number[] = [],
): number[] {
  const out = [STARTING_ARMY];
  let army = STARTING_ARMY;
  let streak = 0;
  rows.forEach((row, i) => {
    const charge = charges.includes(i);
    const wrong = (i + 1) % 5 === 0;
    const base = BASE_REWARD[row.type];
    const r = charge
      ? wrong
        ? applyWrongCharge(army)
        : applyCorrectCharge(army, streak, base)
      : wrong
        ? applyWrong(army)
        : applyCorrect(army, streak, base);
    army = r.army;
    streak = r.streak;
    out.push(army);
  });
  return out;
}

/**
 * The army a pack is sized for when it wakes: the expected army, or, when the
 * actual army is bigger, expected^(1 − PACK_ADAPT) × army^PACK_ADAPT (part
 * of the way to it, on a log scale). See PACK_ADAPT.
 */
export function packArmy(
  expected: number,
  army: number,
  adapt = PACK_ADAPT,
): number {
  if (!(army > expected) || expected <= 0) return expected;
  return expected ** (1 - adapt) * army ** adapt;
}

/**
 * Head count of a pack met when the expected army is `expected`: a horde of
 * weak enemies, clamp(round(hordeK × expected), ENEMY_MIN, packMax).
 */
export function packCount(
  expected: number,
  horde: HordeTuning = HORDE_DEFAULTS,
): number {
  return Math.min(
    horde.packMax,
    Math.max(ENEMY_MIN, Math.round(horde.hordeK * expected)),
  );
}

/** The expected army when hazard h is met: after the questions before it. */
function expectedAt(
  track: Track,
  expected: readonly number[],
  pos: number,
): number {
  const q = track.questions.filter((p) => p < pos).length;
  return expected[Math.min(q, expected.length - 1)] ?? 0;
}

/**
 * Hit points per hazard, from the expected army e after the questions before
 * it: blocks BLOCK_HP_K × e; packs killSeconds × FIRE_PER_SOLDIER × e, so an
 * army of e facing the whole pack mows it down in killSeconds. Saws get 0
 * (unshootable).
 */
export function hazardHp(
  track: Track,
  expected: readonly number[],
  horde: HordeTuning = HORDE_DEFAULTS,
): number[] {
  return track.hazards.map((h) => {
    if (h.kind === "saw") return 0;
    const e = expectedAt(track, expected, h.pos);
    return h.kind === "block"
      ? BLOCK_HP_K * e
      : horde.killSeconds * firepower(e);
  });
}

/** Enemies per hazard at the start: packCount for packs, 0 for blocks and saws. */
export function hazardHeads(
  track: Track,
  expected: readonly number[],
  horde: HordeTuning = HORDE_DEFAULTS,
): number[] {
  return track.hazards.map((h) =>
    h.kind === "pack"
      ? packCount(expectedAt(track, expected, h.pos), horde)
      : 0,
  );
}

/** Where a shootable threat is now: its track position and its span across the track. */
export type Threat = { pos: number; span: Span };

/** A threat taking fire this step and its share (0..1) of the army's fire. */
export type FireShare = { index: number; share: number };

/**
 * Fire by lane: the army fires straight ahead across its span `crowd`. Each
 * part of the span hits the nearest threat that overlaps it (at or after
 * `from`, ahead of `dist` within FIRE_RANGE, short of `limit`; ties go to the
 * lower index), so a nearer threat blocks what is behind it. A threat's
 * share is the width it is nearest in over the crowd's width (listed by
 * index, shares > 0 only); `free` is the share with nothing ahead (it goes
 * to the next wall). Null entries can't be shot.
 */
export function splitFire(
  threats: readonly (Threat | null)[],
  from: number,
  dist: number,
  crowd: Span,
  limit = Infinity,
): { shares: FireShare[]; free: number } {
  const width = crowd.right - crowd.left;
  if (!(width > 0)) return { shares: [], free: 0 };
  const live: number[] = [];
  for (let i = from; i < threats.length; i++) {
    const t = threats[i];
    if (
      !t ||
      t.pos < dist ||
      t.pos - dist > FIRE_RANGE ||
      t.pos >= limit ||
      Math.min(crowd.right, t.span.right) - Math.max(crowd.left, t.span.left) <=
        0
    )
      continue;
    live.push(i);
  }
  // cut the span at every live threat's edges; each piece goes to its nearest
  const cuts = [crowd.left, crowd.right];
  for (const i of live) {
    const { left, right } = (threats[i] as Threat).span;
    for (const c of [left, right])
      if (c > crowd.left && c < crowd.right) cuts.push(c);
  }
  cuts.sort((a, b) => a - b);
  const got = new Map<number, number>();
  let free = 0;
  for (let k = 0; k + 1 < cuts.length; k++) {
    const a = cuts[k] as number;
    const b = cuts[k + 1] as number;
    if (b <= a) continue;
    const mid = (a + b) / 2;
    let best: number | null = null;
    let bestPos = Infinity;
    for (const i of live) {
      const t = threats[i] as Threat;
      if (t.pos < bestPos && t.span.left <= mid && mid <= t.span.right) {
        best = i;
        bestPos = t.pos;
      }
    }
    if (best === null) free += b - a;
    else got.set(best, (got.get(best) ?? 0) + (b - a));
  }
  const shares = [...got]
    .sort(([a], [b]) => a - b)
    .map(([index, w]) => ({ index, share: w / width }));
  return { shares, free: free / width };
}

/**
 * Where each straight tracer ends: for every lane x, the nearest threat whose
 * span holds x (same filter and tie rule as splitFire), else null (it flies
 * on to the range end or the wall). Entries are the threat's index and track
 * position.
 */
export function laneHits(
  threats: readonly (Threat | null)[],
  from: number,
  dist: number,
  xs: readonly number[],
  limit = Infinity,
): ({ index: number; pos: number } | null)[] {
  return xs.map((x) => {
    let best: { index: number; pos: number } | null = null;
    for (let i = from; i < threats.length; i++) {
      const t = threats[i];
      if (
        !t ||
        t.pos < dist ||
        t.pos - dist > FIRE_RANGE ||
        t.pos >= limit ||
        x < t.span.left ||
        x > t.span.right
      )
        continue;
      if (!best || t.pos < best.pos) best = { index: i, pos: t.pos };
    }
    return best;
  });
}
