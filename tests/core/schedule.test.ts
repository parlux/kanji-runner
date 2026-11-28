import { describe, expect, it } from "vitest";
import type { Entry } from "../../src/core/pool";
import { createRng } from "../../src/core/rng";
import {
  dueAt,
  nearness,
  overdueBy,
  schedule,
  type ScheduleInput,
} from "../../src/core/schedule";
import {
  DUE_MIN_SLOTS,
  GAP_BY_BOX,
  LEARNING_SLOTS,
  MAX_NEW_PER_RUN,
  MAX_NEW_WORDS_PER_RUN,
  ROWS_PER_RUN,
  WARM_UPS,
} from "../../src/core/tuning";
import { forSeeds } from "../sweep";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = 1_000 * DAY;

describe("due, overdue and nearness", () => {
  it("gaps by box: 0, 0, 1 h, 1 day, 4 days, 14 days", () => {
    expect(GAP_BY_BOX).toEqual([0, 0, HOUR, DAY, 4 * DAY, 14 * DAY]);
  });

  it("an item is due its box's gap after its last answer", () => {
    GAP_BY_BOX.forEach((g, box) => {
      expect(dueAt(box, NOW)).toBe(NOW + g);
      expect(overdueBy(box, NOW - g, NOW)).toBe(0);
      expect(overdueBy(box, NOW - g - 5, NOW)).toBe(5);
    });
    expect(overdueBy(3, NOW - HOUR, NOW)).toBe(HOUR - DAY);
  });

  it("New and Met are always due", () => {
    expect(overdueBy(0, NOW, NOW)).toBe(0);
    expect(overdueBy(1, NOW, NOW)).toBe(0);
    expect(nearness(1, NOW, NOW)).toBe(Infinity);
  });

  it("nearness is elapsed over gap, 1 at due", () => {
    expect(nearness(2, NOW - HOUR / 2, NOW)).toBe(0.5);
    expect(nearness(3, NOW - DAY, NOW)).toBe(1);
    expect(nearness(5, NOW - 7 * DAY, NOW)).toBe(0.5);
  });

  it("placement records (lastSeen 0) are long overdue", () => {
    expect(overdueBy(4, 0, NOW)).toBe(NOW - 4 * DAY);
  });
});

/** One test item: no `box` = new. `ago` = ms since last answered; `seen` 0 with `ago` undefined = placement record. */
type Spec = {
  box?: number;
  seen?: number;
  ago?: number;
  cur?: boolean;
  word?: boolean;
};

type Fixture = {
  sel: ScheduleInput;
  keys: (pred: (s: Spec) => boolean) => string[];
};

/** A schedule input from specs, in progression order; keys are "i<index>". */
function fixture(specs: readonly Spec[]): Fixture {
  const entries: Entry[] = specs.map((s, i) =>
    s.word
      ? {
          key: `i${i}`,
          type: "word",
          item: { word: `w${i}`, kind: "loanword", glosses: ["x"], level: 2 },
        }
      : {
          key: `i${i}`,
          type: "kana",
          item: { char: `k${i}`, romaji: "x", script: "hiragana" },
        },
  );
  const spec = (e: Entry) => specs[Number(e.key.slice(1))] as Spec;
  const placed = (s: Spec) => s.seen === 0 && s.ago === undefined;
  return {
    sel: {
      entries,
      box: (e) => spec(e).box ?? 0,
      known: (e) => spec(e).box !== undefined,
      current: (e) => spec(e).cur ?? false,
      seen: (e) => spec(e).seen ?? (spec(e).box === undefined ? 0 : 1),
      lastSeen: (e) => {
        const s = spec(e);
        return s.box === undefined || placed(s) ? 0 : NOW - (s.ago ?? 0);
      },
    },
    keys: (pred) => specs.flatMap((s, i) => (pred(s) ? [`i${i}`] : [])),
  };
}

const run = (f: Fixture, seed = 1, now = NOW): string[] =>
  schedule(createRng(seed), f.sel, now).map((e) => e.key);

const rep = (n: number, s: Spec | ((i: number) => Spec)): Spec[] =>
  Array.from({ length: n }, (_, i) => (typeof s === "function" ? s(i) : s));

/** Three current-level warm-up candidates (Learned, due). */
const warmers = rep(3, { box: 3, ago: 2 * DAY, cur: true });

describe("schedule", () => {
  it("places answered due gates before placement records", () => {
    const f = fixture([
      ...warmers,
      ...rep(8, (i) => ({ box: 1, ago: i * HOUR, cur: true })),
      ...rep(10, { box: 4, seen: 0 }), // placement, very overdue
      ...rep(3, { box: 3, ago: 2 * DAY }), // answered, a day overdue
    ]);
    for (const seed of forSeeds(20)) {
      const keys = run(f, seed);
      const answered = f.keys((s) => s.box === 3 && !s.cur);
      expect(answered.every((k) => keys.includes(k))).toBe(true);
      expect(keys.some((k) => f.keys((s) => s.seen === 0).includes(k))).toBe(
        false,
      );
    }
  });

  it("warm-ups: due first, current level first among them", () => {
    const f = fixture([
      { box: 3, ago: HOUR, cur: true }, // current, not due
      { box: 3, ago: 1.2 * DAY, cur: true }, // current, due (least)
      { box: 5, ago: 20 * DAY }, // older, due (most)
      { box: 4, ago: 5 * DAY }, // older, due
      { box: 3, ago: 1.5 * DAY }, // older, due
      { box: 3, ago: HOUR }, // older, not due
      ...rep(20, { box: 1, ago: HOUR }),
    ]);
    for (const seed of forSeeds(20))
      expect(run(f, seed).slice(0, WARM_UPS)).toEqual(["i1", "i2", "i3"]);
  });

  it("warm-ups: with none due, current level first, then nearest", () => {
    const f = fixture([
      { box: 3, ago: HOUR }, // older, nearness 1/24
      { box: 4, ago: 3 * DAY, cur: true }, // current, nearness 3/4
      { box: 5, ago: 10 * DAY }, // older, nearness 10/14
      { box: 5, ago: DAY }, // older, nearness 1/14
      ...rep(20, { box: 1, ago: HOUR }),
    ]);
    for (const seed of forSeeds(20))
      expect(run(f, seed).slice(0, WARM_UPS)).toEqual(["i1", "i2", "i3"]);
  });

  it("a slip (answered, box 0) comes before more overdue gates", () => {
    const MIN = 60 * 1000;
    const f = fixture([
      ...warmers,
      ...rep(20, { box: 2, ago: 5 * HOUR }), // older, 4 h overdue
      { box: 0, ago: 3 * MIN }, // older, just missed
    ]);
    for (const seed of forSeeds(20)) expect(run(f, seed)).toContain("i23");
  });

  it("warm-ups: with fewer than 3 strong items, the highest boxes", () => {
    const f = fixture([
      { box: 3, ago: 0, cur: true },
      { box: 2, ago: 0 },
      { box: 1, ago: 0 },
      { box: 0, ago: 0 },
      ...rep(15, {}),
    ]);
    expect(run(f).slice(0, WARM_UPS)).toEqual(["i0", "i1", "i2"]);
  });

  it("in progress: up to 8, least recently seen first", () => {
    const f = fixture([
      ...warmers,
      ...rep(12, (i) => ({ box: i % 3, ago: i * HOUR, cur: true })),
      ...rep(5, { box: 3, ago: 30 * DAY }), // due older: fill the other 3
    ]);
    const learning = f.keys((s) => s.cur === true && (s.box ?? 0) < 3);
    for (const seed of forSeeds(20)) {
      const keys = run(f, seed);
      const picked = learning.filter((k) => keys.includes(k));
      expect(picked).toHaveLength(LEARNING_SLOTS);
      expect(picked).toEqual(learning.slice(4)); // the 8 longest ago
    }
  });

  it("in progress counts only answered current gates below Learned", () => {
    const f = fixture([
      ...warmers,
      ...rep(8, { box: 1, ago: HOUR, seen: 0, cur: true }), // placed low, not answered
      ...rep(8, { box: 1, ago: HOUR }), // older level
      ...rep(4, {}),
    ]);
    // nothing is in progress, so new items come in
    expect(
      run(f).filter((k) => f.keys((s) => s.box === undefined).includes(k)),
    ).toHaveLength(MAX_NEW_PER_RUN);
  });

  it("due older: at least 3 when any are due, most overdue first", () => {
    const f = fixture([
      ...warmers,
      ...rep(10, { box: 0, ago: HOUR, cur: true }),
      ...rep(6, (i) => ({ box: 4, ago: (5 + i) * DAY })),
      ...rep(6, { box: 4, ago: DAY }), // older, not due
    ]);
    const older = f.keys((s) => s.box === 4);
    for (const seed of forSeeds(20)) {
      const keys = run(f, seed);
      expect(older.filter((k) => keys.includes(k))).toEqual(
        older.slice(3, 6), // the 3 most overdue
      );
      expect(keys.filter((k) => older.includes(k))).toHaveLength(DUE_MIN_SLOTS);
    }
  });

  it("due older: all of them when fewer than 3", () => {
    const f = fixture([
      ...warmers,
      ...rep(10, { box: 0, ago: HOUR, cur: true }),
      ...rep(2, { box: 4, ago: 9 * DAY }),
      ...rep(6, { box: 4, ago: DAY }),
    ]);
    const keys = run(f);
    expect(
      f.keys((s) => s.ago === 9 * DAY).every((k) => keys.includes(k)),
    ).toBe(true);
  });

  it("new: only while fewer than 8 current gates are in progress, at most 2 words", () => {
    const pool = (learning: number) =>
      fixture([
        ...warmers,
        ...rep(learning, { box: 1, ago: HOUR, cur: true }),
        ...rep(12, { box: 3, ago: 0 }), // older, not due
        ...rep(4, { word: true }),
        ...rep(4, {}),
      ]);
    for (const seed of forSeeds(20)) {
      const open = pool(7);
      const fresh = open.keys((s) => s.box === undefined);
      const added = run(open, seed).filter((k) => fresh.includes(k));
      expect(added).toHaveLength(MAX_NEW_PER_RUN);
      // progression order: the first 2 words, then the first kana
      expect(added.sort()).toEqual(
        [...fresh.slice(0, MAX_NEW_WORDS_PER_RUN), ...fresh.slice(4, 6)].sort(),
      );
      const shut = pool(8);
      const none = shut.keys((s) => s.box === undefined);
      expect(run(shut, seed).some((k) => none.includes(k))).toBe(false);
    }
  });

  it("new: held back by every in-progress current gate, picked or not", () => {
    // 10 in progress: 8 picked, 2 left out; no new items
    const f = fixture([
      ...warmers,
      ...rep(10, { box: 2, ago: 30 * 60 * 1000, cur: true }),
      ...rep(5, { box: 4, ago: 0 }),
      ...rep(4, {}),
    ]);
    const fresh = f.keys((s) => s.box === undefined);
    for (const seed of forSeeds(20))
      expect(run(f, seed).some((k) => fresh.includes(k))).toBe(false);
  });

  it("new: a pool short of a run without them takes them before repeating", () => {
    const f = fixture([
      ...warmers,
      ...rep(10, { box: 2, ago: 30 * 60 * 1000, cur: true }),
      ...rep(4, {}),
    ]);
    const keys = run(f);
    expect(keys).toHaveLength(ROWS_PER_RUN);
    expect(new Set(keys).size).toBe(ROWS_PER_RUN);
  });

  it("the rest: most overdue, then nearest to due", () => {
    const MIN = 60 * 1000;
    const f = fixture([
      ...rep(3, { box: 5, ago: DAY, cur: true }), // warm-ups, not due
      ...rep(5, (i) => ({ box: 2, ago: (2 + i) * HOUR })), // due
      ...rep(20, (i) => ({ box: 2, ago: (1 + i) * 2 * MIN })), // not due
    ]);
    const due = f.keys((s) => (s.ago ?? 0) >= 2 * HOUR && s.box === 2);
    const near = f.keys((s) => (s.ago ?? 0) < HOUR).slice(-6); // highest nearness
    for (const seed of forSeeds(20))
      expect(new Set(run(f, seed).slice(WARM_UPS))).toEqual(
        new Set([...due, ...near]),
      );
  });

  it("the rest: lowest box first when equally urgent", () => {
    const f = fixture([
      ...warmers,
      ...rep(8, { box: 3, ago: 0 }), // nearness 0
      ...rep(10, { box: 4, ago: 0 }), // nearness 0
    ]);
    const keys = run(f);
    // 11 slots: all 8 at box 3, then 3 at box 4
    const three = f.keys((s) => s.box === 3 && !s.cur);
    expect(three.every((k) => keys.includes(k))).toBe(true);
  });

  it("never asks a gate twice once the pool fills a run", () => {
    for (const seed of forSeeds(100)) {
      const r = createRng(seed + 500);
      const f = fixture(
        rep(40, () =>
          r() < 0.3
            ? {}
            : {
                box: Math.floor(r() * 6),
                ago: Math.floor(r() * 20 * DAY),
                cur: r() < 0.4,
                seen: r() < 0.2 ? 0 : 1,
                word: r() < 0.2,
              },
        ),
      );
      const keys = run(f, seed);
      expect(keys).toHaveLength(ROWS_PER_RUN);
      expect(new Set(keys).size).toBe(ROWS_PER_RUN);
    }
  });

  it("same seed and now: same run", () => {
    const r = createRng(7);
    const f = fixture(
      rep(40, () => ({
        box: Math.floor(r() * 6),
        ago: Math.floor(r() * 20 * DAY),
        cur: r() < 0.4,
      })),
    );
    for (const seed of forSeeds(20)) expect(run(f, seed)).toEqual(run(f, seed));
  });

  it("a tiny pool fills the run with weighted repeats", () => {
    const fresh = fixture(rep(4, {}));
    const keys = run(fresh);
    expect(keys).toHaveLength(ROWS_PER_RUN);
    expect(new Set(keys)).toEqual(new Set(["i0", "i1", "i2", "i3"]));
    const small = fixture([
      { box: 0, ago: 0 },
      { box: 5, ago: 0 },
    ]);
    for (const seed of forSeeds(20)) {
      const keys = run(small, seed);
      expect(keys).toHaveLength(ROWS_PER_RUN);
      expect(new Set(keys)).toEqual(new Set(["i0", "i1"]));
    }
  });

  it("throws with nothing to ask", () => {
    expect(() => run(fixture([]))).toThrow();
  });
});
