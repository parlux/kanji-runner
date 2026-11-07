import { describe, expect, it } from "vitest";
import {
  buildTrack,
  hazardSpan,
  type Hazard,
  type Track,
} from "../../src/core/track";
import {
  BLOCK_MAX_W,
  BLOCK_MIN_W,
  CALM_DISTANCE,
  CROWD_MAX_W,
  SAW_RATE,
  SAW_W,
} from "../../src/core/tuning";

const QUESTIONS = 14;
const TRACKS = Array.from({ length: 1000 }, (_, seed) =>
  buildTrack(seed, QUESTIONS),
);

/** Seeds whose track fails `ok`. One expect per test: expect() is slow in a 1,000-seed loop. */
const failing = (ok: (t: Track) => boolean): number[] =>
  TRACKS.flatMap((t, seed) => (ok(t) ? [] : [seed]));

/** Hazards strictly between question i and question i + 1. */
function between(t: Track, i: number): Track["hazards"] {
  const [a, b] = [t.questions[i] as number, t.questions[i + 1] as number];
  return t.hazards.filter((h) => h.pos > a && h.pos < b);
}

describe("buildTrack", () => {
  it("places the questions in ascending order, the first after a calm stretch", () => {
    const bad = failing(
      (t) =>
        t.questions.length === QUESTIONS &&
        (t.questions[0] as number) >= CALM_DISTANCE &&
        t.questions.every(
          (q, i) => i === 0 || q > (t.questions[i - 1] as number),
        ),
    );
    expect(bad).toEqual([]);
  });

  it("puts 1–2 hazards between consecutive questions and none outside them", () => {
    const bad = failing((t) => {
      const counts = t.questions.slice(1).map((_, i) => between(t, i).length);
      const total = counts.reduce((a, b) => a + b, 0);
      return (
        counts.every((n) => n >= 1 && n <= 2) && total === t.hazards.length
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

  /** Spans of a hazard over one full period of its sweep (blocks: one span). */
  const sweep = (h: Hazard): { left: number; right: number }[] =>
    Array.from({ length: 64 }, (_, k) =>
      hazardSpan(h, (k / 64) * ((2 * Math.PI) / SAW_RATE)),
    );

  it("every hazard stays on the track and leaves a gap ≥ CROWD_MAX_W at every point of its sweep", () => {
    const bad = failing((t) =>
      t.hazards.every((h) =>
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
      t.hazards.every((h) => {
        const w = hazardSpan(h, 0).right - hazardSpan(h, 0).left;
        return h.kind === "saw"
          ? Math.abs(w - SAW_W) < 1e-12
          : w >= BLOCK_MIN_W && w <= BLOCK_MAX_W;
      }),
    );
    expect(bad).toEqual([]);
  });

  it("uses both hazard types, and saws really move", () => {
    const all = TRACKS.flatMap((t) => t.hazards);
    const saws = all.filter((h) => h.kind === "saw");
    expect(saws.length).toBeGreaterThan(all.length * 0.2);
    expect(saws.length).toBeLessThan(all.length * 0.5);
    const moved = saws.filter((h) => {
      const xs = sweep(h).map((s) => s.left);
      return Math.max(...xs) - Math.min(...xs) > 0.25;
    });
    expect(moved).toHaveLength(saws.length);
  });

  it("is identical for the same seed and differs between seeds", () => {
    expect(buildTrack(7, QUESTIONS)).toEqual(buildTrack(7, QUESTIONS));
    expect(buildTrack(7, QUESTIONS)).not.toEqual(buildTrack(8, QUESTIONS));
  });
});
