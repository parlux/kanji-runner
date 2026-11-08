import { describe, expect, it } from "vitest";
import {
  mainReadings,
  normGloss,
  plainReading,
  showReading,
} from "../../src/core/distractors";
import { KANA } from "../../src/core/kana";
import { wanikaniPool, type Entry } from "../../src/core/pool";
import { createRng } from "../../src/core/rng";
import {
  isTrigger,
  pickTarget,
  REASK_OPTIONS,
  reaskRow,
  type TargetRows,
} from "../../src/core/reask";
import { buildPoolRun, select } from "../../src/core/run";
import type { GateRow } from "../../src/core/types";
import { defaultProgress } from "../../src/core/srs";
import { buildTrack } from "../../src/core/track";
import {
  REASK_GAP_MAX,
  REASK_GAP_MIN,
  REASK_MAX_BOX,
  ROWS_PER_RUN,
  VIEW_DISTANCE,
} from "../../src/core/tuning";
import { syntheticList } from "./wk-fixture";

const list = syntheticList(60);
const progress = defaultProgress();
const pool = wanikaniPool(progress, KANA, list);
const entriesOf = (seed: number): Entry[] => select(createRng(seed), pool);

const rowsFor = (n: number, over: Partial<TargetRows> = {}): TargetRows => ({
  keys: Array.from({ length: n }, (_, i) => `k${i}`),
  reasks: Array.from({ length: n }, () => false),
  charges: [],
  ...over,
});

describe("isTrigger", () => {
  it("fires on a wrong answer at any box", () => {
    for (const box of [0, 2, 3, 5])
      expect(isTrigger(false, box, false)).toBe(true);
  });
  it("fires on a right answer only at box <= REASK_MAX_BOX", () => {
    for (let box = 0; box <= 5; box++)
      expect(isTrigger(true, box, false)).toBe(box <= REASK_MAX_BOX);
  });
  it("never fires for a re-ask row", () => {
    for (const ok of [true, false]) expect(isTrigger(ok, 0, true)).toBe(false);
  });
});

describe("pickTarget", () => {
  it("picks inside the window, and is deterministic", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const t = pickTarget(seed, 2, rowsFor(14)) as number;
      expect(t).toBeGreaterThanOrEqual(2 + REASK_GAP_MIN);
      expect(t).toBeLessThanOrEqual(2 + REASK_GAP_MAX);
      expect(pickTarget(seed, 2, rowsFor(14))).toBe(t);
      seen.add(t);
    }
    expect([...seen].sort()).toEqual([5, 6, 7]);
  });

  it("returns null near the end of the run, and clips the window", () => {
    expect(pickTarget(1, 11, rowsFor(14))).toBeNull();
    expect(pickTarget(1, 10, rowsFor(14))).toBe(13);
    for (let seed = 0; seed < 50; seed++)
      expect(pickTarget(seed, 9, rowsFor(14))).toBeLessThan(14);
  });

  it("skips squad charges, re-asks and the trigger's own item", () => {
    const rows = rowsFor(14, {
      charges: [5],
      reasks: Array.from({ length: 14 }, (_, i) => i === 6),
    });
    rows.keys = rows.keys.map((k, i) => (i === 2 ? k : i === 7 ? "k2" : k));
    for (let seed = 0; seed < 50; seed++)
      expect(pickTarget(seed, 2, rows)).toBeNull();
    // free one row and it is the only choice
    rows.charges = [];
    for (let seed = 0; seed < 50; seed++)
      expect(pickTarget(seed, 2, rows)).toBe(5);
  });

  it("never picks a squad charge in real runs", () => {
    const track = buildTrack(3, ROWS_PER_RUN);
    expect(track.charges.length).toBeGreaterThan(0);
    for (let seed = 0; seed < 100; seed++)
      for (let t = 0; t < ROWS_PER_RUN; t++) {
        const r = pickTarget(
          seed,
          t,
          rowsFor(ROWS_PER_RUN, { charges: track.charges }),
        );
        if (r !== null) expect(track.charges).not.toContain(r);
      }
  });

  it("does not consume or depend on anything but (seed, trigger)", () => {
    const a = pickTarget(5, 1, rowsFor(14));
    const b = pickTarget(5, 1, rowsFor(14));
    expect(a).toBe(b);
  });
});

describe("reaskRow", () => {
  it("keeps item, type and shown reading; 3 valid options", () => {
    let readings = 0;
    for (let seed = 0; seed < 300; seed++) {
      const entries = entriesOf(seed);
      const rows = buildPoolRun(seed, progress, pool);
      entries.forEach((e, i) => {
        const first = rows[i] as (typeof rows)[number];
        const r = reaskRow(createRng(seed * 31 + i), e, first, pool);
        expect(r.type).toBe(first.type);
        expect(r.prompt).toBe(first.prompt);
        expect(r.answer).toBe(first.answer);
        expect(r.options).toHaveLength(REASK_OPTIONS);
        expect(new Set(r.options).size).toBe(REASK_OPTIONS);
        expect(r.options[r.answerIndex]).toBe(r.answer);
        const wrong = r.options.filter((_, j) => j !== r.answerIndex);
        if (e.type === "meaning") {
          const own = new Set(e.item.glosses.map(normGloss));
          for (const w of wrong) expect(own.has(normGloss(w))).toBe(false);
        } else if (e.type === "reading") {
          readings++;
          const own = new Set([...e.item.readings, plainReading(first.answer)]);
          for (const w of wrong) expect(own.has(plainReading(w))).toBe(false);
          expect(mainReadings(e.item).map(showReading)).toContain(r.answer);
        } else {
          for (const w of wrong) expect(w).not.toBe(r.answer);
        }
      });
    }
    expect(readings).toBeGreaterThan(0);
  });

  it("prefers similar kanji as distractors (WaniKani rules)", () => {
    const e = entriesOf(1).find((x) => x.type === "meaning") as Entry;
    if (e.type !== "meaning") throw new Error("no meaning entry");
    const first = buildPoolRun(1, progress, pool)[
      entriesOf(1).indexOf(e)
    ] as GateRow;
    const similar = new Set(
      pool
        .similar(e.item.char)
        .map((c) => list.kanji.find((k) => k.char === c)?.glosses[0]),
    );
    for (let seed = 0; seed < 30; seed++) {
      const r = reaskRow(createRng(seed), e, first, pool);
      const wrong = r.options.filter((_, j) => j !== r.answerIndex);
      expect(wrong.every((w) => similar.has(w))).toBe(true);
    }
  });

  it("puts the answer in each opening evenly, independent of the first ask", () => {
    const e = entriesOf(0)[0] as Entry;
    const first = buildPoolRun(0, progress, pool)[0] as GateRow;
    const joint = Array.from({ length: 2 }, () => [0, 0, 0]);
    const N = 6000;
    for (let s = 0; s < N; s++) {
      const r = reaskRow(createRng(s), e, first, pool);
      const row = joint[s % 2] as number[];
      row[r.answerIndex] = (row[r.answerIndex] as number) + 1;
    }
    for (const row of joint)
      for (const c of row) expect(Math.abs(c / (N / 6) - 1)).toBeLessThan(0.1);
  });

  it("is independent of where the first ask put the answer", () => {
    // first asks drawn over many seeds, re-ask from a different rng each
    const counts = Array.from({ length: 3 }, () => [0, 0, 0]);
    const N = 6000;
    for (let s = 0; s < N; s++) {
      const e = entriesOf(s)[8] as Entry;
      const first = buildPoolRun(s, progress, pool)[8] as GateRow;
      const r = reaskRow(createRng(s + 77777), e, first, pool);
      const row = counts[first.answerIndex] as number[];
      row[r.answerIndex] = (row[r.answerIndex] as number) + 1;
    }
    for (const row of counts) {
      const total = row.reduce((a, b) => a + b, 0);
      for (const c of row)
        expect(Math.abs(c / (total / 3) - 1)).toBeLessThan(0.15);
    }
  });
});

describe("re-asks stay off screen", () => {
  it("every row in a trigger's window is beyond VIEW_DISTANCE when it resolves", () => {
    for (let seed = 0; seed < 300; seed++) {
      const { questions } = buildTrack(seed, ROWS_PER_RUN);
      for (let t = 0; t < ROWS_PER_RUN; t++)
        for (let j = t + REASK_GAP_MIN; j <= t + REASK_GAP_MAX; j++) {
          if (j >= ROWS_PER_RUN) continue;
          expect(
            (questions[j] as number) - (questions[t] as number),
          ).toBeGreaterThan(VIEW_DISTANCE);
        }
    }
  });
});
