import { it } from "vitest";

/** `SLOW=1` runs today's full sweeps; the default fast tier samples them. */
export const SLOW = !!process.env.SLOW && process.env.SLOW !== "0";

/** Seeds used per sweep in the fast tier. */
const FAST_SEEDS = 20;

/**
 * Seeds 0..n-1 in the slow tier. In the fast tier a fixed, evenly spread
 * sample of at most `fast` (default 20) of them (deterministic, so never flaky).
 */
export function forSeeds(n: number, fast = FAST_SEEDS): number[] {
  const m = SLOW ? n : Math.min(n, fast);
  return Array.from({ length: m }, (_, i) => Math.floor((i * n) / m));
}

/** Stride for walking a list: `stride` in the slow tier, `stride * fast` in the fast tier. */
export const stride = (slow: number, fast: number): number =>
  SLOW ? slow : fast;

/** A test whose statistical bound needs the full sample: runs only with `SLOW=1`. */
export const itSlow = SLOW ? it : it.skip;
