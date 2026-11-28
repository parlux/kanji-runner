/** A seeded PRNG returning floats in [0, 1). Stateful closure; pass it in, never use a global. */
export type Rng = () => number;

/** mulberry32: small, fast, good enough for gameplay. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates; returns a new array. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Up to `n` items by weighted random choice, without repeats. */
export function weightedDraw<T>(
  rng: Rng,
  items: readonly T[],
  n: number,
  weightOf: (item: T) => number,
): T[] {
  const left = [...items];
  const out: T[] = [];
  while (out.length < n && left.length > 0) {
    let total = 0;
    for (const e of left) total += weightOf(e);
    let r = rng() * total;
    let i = 0;
    while (i < left.length - 1 && (r -= weightOf(left[i] as T)) >= 0) i++;
    out.push(...left.splice(i, 1));
  }
  return out;
}
