import { expect } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { WORDS } from "../../src/core/words";
import { builtInPool, type Pool } from "../../src/core/pool";
import { applyUnlock, levelName, place } from "../../src/core/progression";
import { createRng } from "../../src/core/rng";
import { poolRun } from "../../src/core/run";
import {
  defaultProgress,
  MAX_BOX,
  recordRun,
  weight,
} from "../../src/core/srs";
import {
  GAP_BY_BOX,
  MAX_NEW_PER_RUN,
  ROWS_PER_RUN,
} from "../../src/core/tuning";
import type { Progress } from "../../src/core/types";
import { NOW } from "../now";
import { itSlow } from "../sweep";

/**
 * Simulated days (SPEC-scheduler, "Testing"): a bot placed at Kanji 10 plays
 * 5 Built-in runs a session, ~3 minutes apart, one session a day for 30 days,
 * answering each gate right with a probability by its box (0.6 at box 0 up to
 * 0.95 at box 5). After each run, `recordRun` and `applyUnlock` as the game's
 * `afterStep` does. The same bot on the old weighted selector (`select`, via a
 * pool with `weight`) is printed alongside for comparison.
 */
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const DAYS = 30;
const RUNS = 5;
const PLACED = 11; // level 11, Kanji 10, is current after placing below it

const pRight = (box: number) => 0.6 + (0.35 * Math.min(box, MAX_BOX)) / MAX_BOX;

type Stats = {
  /** Current-level gates per run, by run number in the session (0-based). */
  share: number[][];
  /** The current level's open gates per run (known below box 3, plus new up to `MAX_NEW_PER_RUN`), likewise. */
  open: number[][];
  /**
   * Slips (wrong in runs 1–3, still askable in the next run) and how many
   * came back within 2 runs. A reading gate leaves the pool when its meaning
   * slips too (readings open at meaning box ≥ 3), so it can't come back.
   */
  slips: number;
  back: number;
  /** Observed gaps by the box the item had when asked again (ms). */
  gaps: number[][];
  levels: number;
};

function simulate(old: boolean): Stats {
  const rng = createRng(2026);
  let p: Progress = place(defaultProgress(), PLACED - 1, KANA, KANJI, WORDS);
  const start = p.unlockedLevel;
  const stats: Stats = {
    share: Array.from({ length: RUNS }, () => []),
    open: Array.from({ length: RUNS }, () => []),
    slips: 0,
    back: 0,
    gaps: Array.from({ length: MAX_BOX + 1 }, () => []),
    levels: 0,
  };
  for (let day = 0; day < DAYS; day++) {
    const keys: string[][] = [];
    const askable: Set<string>[] = [];
    const slipped: string[][] = [];
    for (let r = 0; r < RUNS; r++) {
      const now = NOW + day * DAY + r * 3 * MIN;
      const base = builtInPool(p, KANA, KANJI, WORDS);
      const pool: Pool = old
        ? { ...base, weight: (e) => weight(base.box(e)) }
        : base;
      const { rows, entries } = poolRun(1000 * day + r, p, now, pool);
      const results = entries.map((e) => rng() < pRight(pool.box(e)));
      for (const e of entries) {
        const rec = p.items[e.key];
        if (rec && rec.seen > 0) stats.gaps[rec.box]?.push(now - rec.lastSeen);
      }
      stats.share[r]?.push(entries.filter(pool.current).length);
      // open: known below box 3, plus new up to the per-run cap
      const cur = base.entries.filter(base.current);
      const fresh = cur.filter((e) => !base.known(e)).length;
      stats.open[r]?.push(
        cur.filter((e) => base.known(e) && base.box(e) < 3).length +
          Math.min(fresh, MAX_NEW_PER_RUN),
      );
      keys.push(entries.map((e) => e.key));
      askable.push(new Set(base.entries.map((e) => e.key)));
      slipped.push(entries.filter((_, i) => !results[i]).map((e) => e.key));
      p = applyUnlock(
        recordRun(p, rows, results, true, now),
        KANA,
        KANJI,
        WORDS,
      );
    }
    for (let r = 0; r + 2 < RUNS; r++)
      for (const k of new Set(slipped[r])) {
        if (!askable[r + 1]?.has(k)) continue;
        stats.slips++;
        if (keys[r + 1]?.includes(k) || keys[r + 2]?.includes(k)) stats.back++;
      }
  }
  stats.levels = p.unlockedLevel - start;
  return stats;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : (s[Math.floor(s.length / 2)] as number);
};
const mean = (xs: readonly number[]): number =>
  xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const fmt = (ms: number): string =>
  Number.isNaN(ms)
    ? "-"
    : ms >= DAY
      ? `${(ms / DAY).toFixed(1)} d`
      : ms >= 60 * MIN
        ? `${(ms / 60 / MIN).toFixed(1)} h`
        : `${(ms / MIN).toFixed(0)} min`;

/** Runs 3–5 of the sessions: [runs, with ≥ 6 current gates, with ≥ min(6, open)]. */
function later(s: Stats): [number, number, number] {
  let runs = 0;
  let six = 0;
  let all = 0;
  for (const r of [2, 3, 4])
    (s.share[r] ?? []).forEach((n, d) => {
      runs++;
      if (n >= 6) six++;
      if (n >= Math.min(6, s.open[r]?.[d] ?? 0)) all++;
    });
  return [runs, six, all];
}

function report(name: string, s: Stats): string {
  const share = s.share
    .map((xs, r) => `run ${r + 1}: ${mean(xs).toFixed(1)}`)
    .join(", ");
  const open = s.open.map((xs) => mean(xs).toFixed(1)).join(", ");
  const gaps = s.gaps
    .map((xs, b) => `box ${b}: ${fmt(median(xs))} (n=${xs.length})`)
    .join(", ");
  const [runs, six, all] = later(s);
  return [
    `${name}:`,
    `  current-level gates of ${ROWS_PER_RUN}, mean by run: ${share} (open current gates in the pool: ${open})`,
    `  runs 3-5: ${six}/${runs} with >= 6 current gates, ${all}/${runs} with >= min(6, open)`,
    `  slips back within 2 runs: ${s.back}/${s.slips}`,
    `  median gap by box: ${gaps}`,
    `  levels finished in ${DAYS} days: ${s.levels} (${levelName(PLACED)} -> ${levelName(PLACED + s.levels)})`,
  ].join("\n");
}

itSlow("simulated days: due items come back near their gap", () => {
  const now = simulate(false);
  const old = simulate(true);
  console.log(
    `Simulated days\n${report("scheduler", now)}\n${report("old select", old)}`,
  );
  // a slipped item returns within 2 runs of the session
  expect(now.back).toBe(now.slips);
  // runs 3–5 of every session: at least 6 of 14 gates on the current level,
  // or all of its open gates when it has fewer (a level's last few items)
  const [runs, , all] = later(now);
  expect(all).toBe(runs);
  // boxes 3–5: median observed gap within ×0.5–×3 of the box's gap. One
  // session a day still measures box 3 (1 day): sessions start at the same
  // time each day, so a gate answered in run k is due by run k the next day
  // and gaps land near whole days (box 2's 1 h can't be seen: next day).
  for (const b of [3, 4, 5]) {
    const m = median(now.gaps[b] ?? []);
    const g = GAP_BY_BOX[b] as number;
    expect(m).toBeGreaterThanOrEqual(g * 0.5);
    expect(m).toBeLessThanOrEqual(g * 3);
  }
});
