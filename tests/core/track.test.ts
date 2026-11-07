import { describe, expect, it } from "vitest";
import {
  buildTrack,
  chargeLine,
  hazardSpan,
  isCharge,
  type Solid,
  type Track,
} from "../../src/core/track";
import {
  BASE_SPEED,
  BLOCK_MAX_W,
  BLOCK_MIN_W,
  CALM_DISTANCE,
  CROWD_MAX_W,
  ENEMY_X_MARGIN,
  FIRE_RANGE,
  HAZARDS_MAX,
  HAZARDS_MIN,
  SAW_RATE,
  SAW_W,
  STEER_MAX_SPEED,
  VIEW_DISTANCE,
} from "../../src/core/tuning";

const QUESTIONS = 14;
const TRACKS = Array.from({ length: 1000 }, (_, seed) =>
  buildTrack(seed, QUESTIONS),
);

/** Seeds whose track fails `ok`. One expect per test: expect() is slow in a 1,000-seed loop. */
const failing = (ok: (t: Track) => boolean): number[] =>
  TRACKS.flatMap((t, seed) => (ok(t) ? [] : [seed]));

const solids = (t: Track): Solid[] =>
  t.hazards.filter((h): h is Solid => h.kind !== "pack");

/** Hazards strictly between question i and question i + 1. */
function between(t: Track, i: number): Track["hazards"] {
  const [a, b] = [t.questions[i] as number, t.questions[i + 1] as number];
  return t.hazards.filter((h) => h.pos > a && h.pos < b);
}

/** Steering distance: how far the army travels (at base speed) while crossing the whole track. */
const STEER_REACH = BASE_SPEED / STEER_MAX_SPEED;

/**
 * Longest stretch of track (in units) with nothing to do: no wall, charge or
 * hazard within steering distance, and no block or pack within FIRE_RANGE
 * short of the next question's fire limit. Calm stretches are excluded.
 * Packs are taken at their start positions (they only come closer).
 */
function longestDeadStretch(t: Track, step = 0.01): number {
  const last = t.questions.at(-1) ?? 0;
  const limitAfter = (d: number): number => {
    const q = t.questions.findIndex((p) => p > d);
    if (q < 0) return Infinity;
    return isCharge(t, q) ? chargeLine(t, q) : (t.questions[q] as number);
  };
  const busy = (d: number): boolean => {
    if (t.questions.some((q) => d >= q - CALM_DISTANCE && d <= q)) return true;
    if (t.questions.some((q) => q > d && q - d <= STEER_REACH)) return true;
    const limit = limitAfter(d);
    return t.hazards.some((h) => {
      const ahead = h.pos - d;
      if (ahead <= 0) return false;
      if (ahead <= STEER_REACH) return true;
      return h.kind !== "saw" && ahead <= FIRE_RANGE && h.pos < limit;
    });
  };
  let longest = 0;
  let run = 0;
  for (let d = 0; d <= last; d += step) {
    run = busy(d) ? 0 : run + step;
    longest = Math.max(longest, run);
  }
  return longest;
}

describe("dead time", () => {
  it("never leaves more than 1.5 s (at base speed) with nothing to do outside the calm stretches", () => {
    const worst = Math.max(
      ...TRACKS.slice(0, 200).map((t) => longestDeadStretch(t)),
    );
    expect(worst / BASE_SPEED).toBeLessThanOrEqual(1.5);
  });
});

describe("buildTrack", () => {
  it("places the questions in ascending order, the first a full VIEW_DISTANCE in", () => {
    const bad = failing(
      (t) =>
        t.questions.length === QUESTIONS &&
        (t.questions[0] as number) >= VIEW_DISTANCE &&
        t.questions.every(
          (q, i) => i === 0 || q > (t.questions[i - 1] as number),
        ),
    );
    expect(bad).toEqual([]);
  });

  it("puts HAZARDS_MIN–HAZARDS_MAX hazards between consecutive questions and none outside them", () => {
    const bad = failing((t) => {
      const counts = t.questions.slice(1).map((_, i) => between(t, i).length);
      const total = counts.reduce((a, b) => a + b, 0);
      return (
        counts.every((n) => n >= HAZARDS_MIN && n <= HAZARDS_MAX) &&
        total === t.hazards.length
      );
    });
    expect(bad).toEqual([]);
  });

  it("keeps every calm stretch hazard-free", () => {
    const bad = failing((t) =>
      t.questions.every((q) =>
        t.hazards.every((h) => h.pos <= q - CALM_DISTANCE || h.pos > q),
      ),
    );
    expect(bad).toEqual([]);
  });

  it("leaves a full calm stretch before each charge line", () => {
    const bad = failing((t) =>
      t.charges.every((q) => {
        const line = chargeLine(t, q);
        const prev = t.questions[q - 1] as number;
        return t.hazards.every(
          (h) =>
            h.pos <= line - CALM_DISTANCE + 1e-9 ||
            h.pos <= prev ||
            h.pos > line,
        );
      }),
    );
    expect(bad).toEqual([]);
  });

  /** Spans of a hazard over one full period of its sweep (blocks: one span). */
  const sweep = (h: Solid): { left: number; right: number }[] =>
    Array.from({ length: 64 }, (_, k) =>
      hazardSpan(h, (k / 64) * ((2 * Math.PI) / SAW_RATE)),
    );

  it("every block and saw stays on the track and leaves a gap ≥ CROWD_MAX_W at every point of its sweep", () => {
    const bad = failing((t) =>
      solids(t).every((h) =>
        sweep(h).every(
          (s) =>
            s.left >= -1e-12 &&
            s.right <= 1 + 1e-12 &&
            Math.max(s.left, 1 - s.right) >= CROWD_MAX_W,
        ),
      ),
    );
    expect(bad).toEqual([]);
  });

  it("blocks are BLOCK_MIN_W–BLOCK_MAX_W wide and saws SAW_W wide", () => {
    const bad = failing((t) =>
      solids(t).every((h) => {
        const w = hazardSpan(h, 0).right - hazardSpan(h, 0).left;
        return h.kind === "saw"
          ? Math.abs(w - SAW_W) < 1e-12
          : w >= BLOCK_MIN_W && w <= BLOCK_MAX_W;
      }),
    );
    expect(bad).toEqual([]);
  });

  it("uses both solid hazard types, and saws really move", () => {
    const all = TRACKS.flatMap(solids);
    const saws = all.filter((h) => h.kind === "saw");
    expect(saws.length).toBeGreaterThan(all.length * 0.2);
    expect(saws.length).toBeLessThan(all.length * 0.5);
    const moved = saws.filter((h) => {
      const xs = sweep(h).map((s) => s.left);
      return Math.max(...xs) - Math.min(...xs) > 0.25;
    });
    expect(moved).toHaveLength(saws.length);
  });

  it("has enemy packs only after question 2, on the track, and not too many", () => {
    const bad = failing((t) =>
      t.hazards.every(
        (h) =>
          h.kind !== "pack" ||
          (h.pos > (t.questions[1] as number) &&
            h.x >= ENEMY_X_MARGIN &&
            h.x <= 1 - ENEMY_X_MARGIN),
      ),
    );
    expect(bad).toEqual([]);
    const all = TRACKS.flatMap((t) => t.hazards);
    const packs = all.filter((h) => h.kind === "pack").length;
    expect(packs).toBeGreaterThan(all.length * 0.15);
    expect(packs).toBeLessThan(all.length * 0.4);
  });

  it("is identical for the same seed and differs between seeds", () => {
    expect(buildTrack(7, QUESTIONS)).toEqual(buildTrack(7, QUESTIONS));
    expect(buildTrack(7, QUESTIONS)).not.toEqual(buildTrack(8, QUESTIONS));
  });
});
