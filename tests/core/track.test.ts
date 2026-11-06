import { describe, expect, it } from "vitest";
import { buildTrack, type Track } from "../../src/core/track";
import {
  BLOCK_MAX_W,
  BLOCK_MIN_W,
  CALM_DISTANCE,
  CROWD_MAX_W,
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

  it("every block is in range and leaves a gap of at least CROWD_MAX_W", () => {
    const bad = failing((t) =>
      t.hazards.every((h) => {
        const w = h.right - h.left;
        return (
          w >= BLOCK_MIN_W &&
          w <= BLOCK_MAX_W &&
          h.left >= 0 &&
          h.right <= 1 &&
          Math.max(h.left, 1 - h.right) >= CROWD_MAX_W
        );
      }),
    );
    expect(bad).toEqual([]);
  });

  it("is identical for the same seed and differs between seeds", () => {
    expect(buildTrack(7, QUESTIONS)).toEqual(buildTrack(7, QUESTIONS));
    expect(buildTrack(7, QUESTIONS)).not.toEqual(buildTrack(8, QUESTIONS));
  });
});
