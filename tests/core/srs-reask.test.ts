import { describe, expect, it } from "vitest";
import { defaultProgress, itemKey, recordRun } from "../../src/core/srs";
import type { GateRow, ItemProgress, Progress } from "../../src/core/types";

const row = (prompt: string): GateRow => ({
  prompt,
  type: "meaning",
  answer: "a",
  options: ["a", "b", "c"],
  answerIndex: 0,
});
const rec = (box: number): ItemProgress => ({
  box,
  seen: 4,
  correct: 3,
  wrong: 1,
  lastSeen: 1,
});
const withRec = (boxes: Record<string, number>): Progress => {
  const p = defaultProgress();
  for (const [c, b] of Object.entries(boxes))
    p.items[itemKey(c, "meaning")] = rec(b);
  return p;
};
const k = (c: string) => itemKey(c, "meaning");

// Rows: 0 = A, 1 = X (displaced item's slot, now holds B), 2 = A re-ask.
const rows = [row("A"), row("B"), row("A")];
const links = [{ row: 2, of: 0 }];

function pair(start: number, first: boolean, second: boolean, seeded = false) {
  const p = seeded ? defaultProgress() : withRec({ A: start });
  return recordRun(p, rows, [first, true, second], true, 9, {
    links,
    startBoxes: [start, 4, start],
  }).items[k("A")] as ItemProgress;
}

describe("recordRun pair table", () => {
  it("right + right -> box + 1", () => expect(pair(1, true, true).box).toBe(2));
  it("caps at 5", () => expect(pair(5, true, true).box).toBe(5));
  it("right + wrong -> 0", () => expect(pair(1, true, false).box).toBe(0));
  it("wrong + right -> 0", () => expect(pair(2, false, true).box).toBe(0));
  it("wrong + wrong -> 0", () => expect(pair(2, false, false).box).toBe(0));
  it("seeded start box: right twice -> seeded + 1", () => {
    const a = pair(1, true, true, true);
    expect(a.box).toBe(2);
    expect(a.seen).toBe(2);
  });
  it("counters count both answers", () => {
    const a = pair(1, true, false);
    expect(a).toMatchObject({ seen: 6, correct: 4, wrong: 2, lastSeen: 9 });
  });
});

describe("recordRun with re-ask info, no re-ask answered", () => {
  const info = { links, startBoxes: [1, 4, 1] };
  it("army died between the asks: weak right stays", () => {
    const r = recordRun(withRec({ A: 1 }), rows, [true], false, 9, info);
    expect(r.items[k("A")]).toMatchObject({ box: 1, seen: 5, correct: 4 });
  });
  it("army died between the asks: wrong -> 0", () => {
    const r = recordRun(withRec({ A: 2 }), rows, [false], false, 9, info);
    expect(r.items[k("A")]?.box).toBe(0);
  });
  it("seeded weak right stays at the seeded box", () => {
    const r = recordRun(defaultProgress(), rows, [true], false, 9, info);
    expect(r.items[k("A")]).toMatchObject({ box: 1, seen: 1 });
  });
  it("strong right -> box + 1", () => {
    const r = recordRun(withRec({ B: 4 }), rows, [true, true], false, 9, info);
    expect(r.items[k("B")]?.box).toBe(5);
  });
  it("boundary: box 2 is weak, box 3 is not", () => {
    const i = { links: [], startBoxes: [2, 3] };
    const r = recordRun(
      withRec({ A: 2, B: 3 }),
      rows,
      [true, true],
      true,
      9,
      i,
    );
    expect([r.items[k("A")]?.box, r.items[k("B")]?.box]).toEqual([2, 4]);
  });
  it("unlinked same-key repeat: each answer in turn by the no-re-ask rules", () => {
    const rr = [row("A"), row("A")];
    const i = { links: [], startBoxes: [1, 1] };
    const r = recordRun(withRec({ A: 1 }), rr, [true, false], true, 9, i);
    expect(r.items[k("A")]).toMatchObject({ box: 0, seen: 6, wrong: 2 });
  });
});

describe("displaced item", () => {
  it("is not in rows, so its record is untouched", () => {
    const p = withRec({ A: 1, X: 3 });
    const r = recordRun(p, rows, [true, true, true], true, 9, {
      links,
      startBoxes: [1, 4, 1],
    });
    expect(r.items[k("X")]).toEqual(p.items[k("X")]);
  });
});

describe("without re-ask info", () => {
  it("keeps the v1 rule, a repeat updates twice", () => {
    const rr = [row("A"), row("A")];
    const r = recordRun(withRec({ A: 1 }), rr, [true, true], true, 9);
    expect(r.items[k("A")]).toMatchObject({ box: 3, seen: 6 });
  });
  it("a weak right still moves up", () => {
    const r = recordRun(withRec({ A: 1 }), [row("A")], [true], true, 9);
    expect(r.items[k("A")]?.box).toBe(2);
  });
});
