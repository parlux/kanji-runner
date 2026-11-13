import { describe, expect, it } from "vitest";
import {
  logRun,
  sessionLists,
  sessionTokens,
  wrapTokens,
  type PanelToken,
} from "../../src/core/session";
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

describe("session line", () => {
  const str = (t: PanelToken): string =>
    t.kind === "item" ? t.entry.prompt : t.s;
  const flat = (ts: PanelToken[]): string => ts.map(str).join(" ");

  it("reads run, fixed and still missing, readings after their label", () => {
    const a = logRun(
      null,
      [row("A"), row("B"), row("C", "reading")],
      [false, false, false],
      0,
    );
    const b = logRun(a, [row("A"), row("C", "reading")], [true, true], MIN);
    expect(flat(sessionTokens(b))).toBe(
      "Session · run 2 · fixed A reading C · still missing B",
    );
    expect(flat(sessionTokens(logRun(null, [row("A")], [false], 0)))).toBe(
      "Session · run 1 · still missing A",
    );
  });

  it("says no misses when both lists are empty", () => {
    expect(flat(sessionTokens(logRun(null, [row("A")], [true], 0)))).toBe(
      "Session · run 1 · no misses this session",
    );
  });

  const item = (prompt: string): PanelToken => ({
    kind: "item",
    entry: { prompt, type: "meaning", thisRun: false },
  });
  const label = (s: string): PanelToken => ({ kind: "label", s });
  // every token is 10 px wide per character, 10 px gaps
  const w = (t: PanelToken): number => str(t).length * 10;
  const texts = (r: ReturnType<typeof wrapTokens>): string[] =>
    r.lines.map(flat);

  it("fits on one line when there is room", () => {
    const r = wrapTokens([label("ab"), item("x"), item("y")], 100, 2, 10, w);
    expect(texts(r)).toEqual(["ab x y"]);
    expect(r.hidden).toBe(0);
  });

  it("wraps onto a second line, never ending a line on a label", () => {
    // "aaaa x" is 70 px; "· b" would fit too, but a line can't end on it
    const ts = [label("aaaa"), item("x"), label("bb"), item("y"), item("z")];
    const r = wrapTokens(ts, 90, 2, 10, w);
    expect(texts(r)).toEqual(["aaaa x", "bb y z"]);
    expect(r.hidden).toBe(0);
  });

  it("stops at maxLines with +k for the items left out", () => {
    const ts = [
      label("a"),
      ...Array.from({ length: 10 }, (_, i) => item(String(i))),
    ];
    // 50 px: 3 tokens a line; the last line keeps room for "+k"
    const r = wrapTokens(ts, 50, 2, 10, w);
    expect(texts(r)).toEqual(["a 0 1", "2"]); // "2 +7" is 40 px, "2 3 +6" 60
    expect(r.hidden).toBe(7);
  });
});
