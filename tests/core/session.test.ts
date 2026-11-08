import { describe, expect, it } from "vitest";
import { logRun, panelLines, sessionLists } from "../../src/core/session";
import { SESSION_IDLE_MINUTES } from "../../src/core/tuning";
import type { GateRow, GateType } from "../../src/core/types";

const row = (prompt: string, type: GateType = "meaning"): GateRow => ({
  prompt,
  type,
  answer: "a",
  options: ["a", "b", "c"],
  answerIndex: 0,
});
const MIN = 60_000;
const chars = (es: { prompt: string }[]) => es.map((e) => e.prompt);

describe("idle rule", () => {
  const first = logRun(null, [row("A")], [false], 1000);
  it("starts a log with run 1", () => {
    expect(first.runs).toBe(1);
    expect(first.startedAt).toBe(1000);
  });
  it("continues within the limit", () => {
    const next = logRun(first, [row("B")], [false], 1000 + 10 * MIN);
    expect(next.runs).toBe(2);
    expect(chars(sessionLists(next).missing)).toEqual(["A", "B"]);
  });
  it("continues exactly at the limit", () => {
    const next = logRun(first, [], [], 1000 + SESSION_IDLE_MINUTES * MIN);
    expect(next.runs).toBe(2);
    expect(next.startedAt).toBe(1000);
  });
  it("starts fresh past the limit", () => {
    const next = logRun(
      first,
      [row("B")],
      [true],
      1001 + SESSION_IDLE_MINUTES * MIN,
    );
    expect(next.runs).toBe(1);
    expect(next.startedAt).toBe(1001 + SESSION_IDLE_MINUTES * MIN);
    expect(sessionLists(next).missing).toEqual([]);
  });
  it("measures from the last run, not the start", () => {
    const second = logRun(first, [], [], 1000 + 20 * MIN);
    expect(logRun(second, [], [], 1000 + 45 * MIN).runs).toBe(3);
  });
});

describe("states", () => {
  it("wrong is missing; right-only is not listed", () => {
    const l = sessionLists(
      logRun(null, [row("A"), row("B")], [false, true], 0),
    );
    expect(chars(l.missing)).toEqual(["A"]);
    expect(l.fixed).toEqual([]);
  });
  it("wrong then right is fixed, across runs", () => {
    const a = logRun(null, [row("A")], [false], 0);
    const l = sessionLists(logRun(a, [row("A")], [true], MIN));
    expect(chars(l.fixed)).toEqual(["A"]);
    expect(l.missing).toEqual([]);
  });
  it("fixed then wrong goes back to missing; fixed stays fixed when right", () => {
    const a = logRun(null, [row("A"), row("B")], [false, false], 0);
    const b = logRun(a, [row("A"), row("B")], [true, true], MIN);
    const c = logRun(b, [row("A"), row("B")], [false, true], 2 * MIN);
    const l = sessionLists(c);
    expect(chars(l.missing)).toEqual(["A"]);
    expect(chars(l.fixed)).toEqual(["B"]);
  });
  it("ignores unanswered rows", () => {
    const l = sessionLists(
      logRun(null, [row("A"), row("B"), row("C")], [false], 0),
    );
    expect(chars(l.missing)).toEqual(["A"]);
  });
  it("tracks meaning and reading apart", () => {
    const a = logRun(
      null,
      [row("水", "meaning"), row("水", "reading")],
      [false, false],
      0,
    );
    const b = logRun(a, [row("水", "reading")], [true], MIN);
    const l = sessionLists(b);
    expect(l.missing.map((e) => e.type)).toEqual(["meaning"]);
    expect(l.fixed.map((e) => e.type)).toEqual(["reading"]);
  });
  it("keeps first-miss order even after state changes", () => {
    const a = logRun(
      null,
      [row("C"), row("A"), row("B")],
      [false, false, false],
      0,
    );
    const b = logRun(a, [row("C"), row("A")], [true, true], MIN);
    const c = logRun(b, [row("C")], [false], 2 * MIN);
    const l = sessionLists(c);
    expect(chars(l.missing)).toEqual(["C", "B"]);
    expect(chars(l.fixed)).toEqual(["A"]);
  });
  it("does not mutate the previous log", () => {
    const a = logRun(null, [row("A")], [false], 0);
    const snap = JSON.stringify(a);
    logRun(a, [row("A")], [true], MIN);
    expect(JSON.stringify(a)).toBe(snap);
  });
});

describe("fixed this run", () => {
  it("marks only items fixed in the latest run", () => {
    const a = logRun(null, [row("A"), row("B")], [false, false], 0);
    const b = logRun(a, [row("A")], [true], MIN);
    const c = logRun(b, [row("B")], [true], 2 * MIN);
    const l = sessionLists(c);
    expect(l.fixed.map((e) => [e.prompt, e.thisRun])).toEqual([
      ["A", false],
      ["B", true],
    ]);
  });
  it("counts a miss and its re-ask in the same run", () => {
    const l = sessionLists(
      logRun(null, [row("A"), row("A")], [false, true], 0),
    );
    expect(l.fixed).toEqual([{ prompt: "A", type: "meaning", thisRun: true }]);
  });
  it("does not count fixed then wrong again in the same run", () => {
    const l = sessionLists(
      logRun(null, [row("A"), row("A"), row("A")], [false, true, false], 0),
    );
    expect(l.fixed).toEqual([]);
    expect(chars(l.missing)).toEqual(["A"]);
  });
  it("does not mark an item that was already fixed and stays right", () => {
    const a = logRun(null, [row("A"), row("A")], [false, true], 0);
    const l = sessionLists(logRun(a, [row("A")], [true], MIN));
    expect(l.fixed[0]?.thisRun).toBe(false);
  });
});

describe("panelLines", () => {
  const e = (prompt: string, type: GateType = "meaning") => ({
    prompt,
    type,
    thisRun: false,
  });
  const w = (s: string): number => s.length * 10;
  const texts = (r: ReturnType<typeof panelLines>): string[][] =>
    r.lines.map((l) =>
      l.map((t) => (t.kind === "item" ? t.entry.prompt : t.s)),
    );
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => e(String.fromCharCode(97 + i)));

  it("lists meaning items first, then reading items after a label", () => {
    const r = panelLines(
      [e("山", "reading"), e("水"), e("火")],
      999,
      999,
      3,
      w,
    );
    expect(texts(r)).toEqual([["水", "火", "· reading", "山"]]);
    expect(r.hidden).toBe(0);
  });

  it("needs no wrap for a short list", () => {
    const r = panelLines(many(3), 100, 100, 3, w);
    expect(texts(r)).toEqual([["a", "b", "c"]]);
  });

  it("wraps at the first and rest widths", () => {
    // first: 3 items (50px), rest: 5 items (90px)
    const r = panelLines(many(10), 50, 90, 3, w);
    expect(texts(r)).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f", "g", "h"],
      ["i", "j"],
    ]);
    expect(r.hidden).toBe(0);
  });

  it("puts +k only on the last line, leaving room for it", () => {
    const r = panelLines(many(12), 50, 50, 2, w);
    expect(texts(r)).toEqual([["a", "b", "c"], ["d"]]);
    expect(r.hidden).toBe(8);
  });

  it("keeps the label off the end of a line, and may start a line with it", () => {
    const entries = [e("a"), e("b"), e("c", "reading")];
    const r = panelLines(entries, 40, 120, 3, w);
    expect(texts(r)).toEqual([
      ["a", "b"],
      ["· reading", "c"],
    ]);
    expect(r.hidden).toBe(0);
  });

  it("never ends the last line with a label", () => {
    const r = panelLines([e("a"), e("b", "reading")], 60, 60, 1, w);
    expect(texts(r)).toEqual([["a"]]);
    expect(r.hidden).toBe(1);
  });

  it("handles empty and too-narrow input", () => {
    expect(panelLines([], 100, 100, 3, w)).toEqual({ lines: [[]], hidden: 0 });
    expect(panelLines([e("a")], 5, 5, 1, w)).toEqual({
      lines: [[]],
      hidden: 1,
    });
  });
});
