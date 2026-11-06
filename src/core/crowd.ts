import { CROWD_K, CROWD_MAX_W, CROWD_MIN_W } from "./tuning";

/** A solid stretch of track, from left to right (0..1). */
export type Span = { left: number; right: number };

export function crowdWidth(army: number): number {
  return Math.min(
    CROWD_MAX_W,
    Math.max(CROWD_MIN_W, CROWD_K * Math.sqrt(army)),
  );
}

function spanOverlap(a: number, b: number, s: Span): number {
  return Math.max(0, Math.min(b, s.right) - Math.max(a, s.left));
}

/** Soldiers lost when a crowd [x - w/2, x + w/2] passes solids. */
export function clipLoss(
  army: number,
  x: number,
  w: number,
  solids: Span[],
): number {
  const overlap = solids.reduce(
    (sum, s) => sum + spanOverlap(x - w / 2, x + w / 2, s),
    0,
  );
  return overlap > 1e-12 ? Math.min(army, Math.ceil((army * overlap) / w)) : 0;
}
