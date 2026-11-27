import { describe, expect, it } from "vitest";
import { mainReadings, showReading } from "../../src/core/distractors";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { runItems } from "../../src/core/runitems";
import { defaultProgress, itemKey } from "../../src/core/srs";
import { WORDS } from "../../src/core/words";
import type { GateRow, GateType, Progress } from "../../src/core/types";

const row = (type: GateType, prompt: string, answer = "x"): GateRow => ({
  type,
  prompt,
  options: [answer, "y"],
  answerIndex: 0,
  answer,
});
const withBoxes = (boxes: Record<string, number>): Progress => {
  const p = defaultProgress();
  for (const [k, box] of Object.entries(boxes))
    p.items[k] = { box, seen: 1, correct: 1, wrong: 0, lastSeen: 1 };
  return p;
};
const need = <T>(x: T | undefined): T => {
  if (x === undefined) throw new Error("missing fixture");
  return x;
};
const pure = KANJI.filter((k) => k.on && k.kun);
const k1 = need(pure[0]);
const k2 = need(pure[1]);
const k3 = need(pure[2]);
const k4 = need(pure[3]);
const a = need(KANA[0]);
const b = need(KANA[1]);
const kw = need(WORDS.find((w) => w.reading));
const loan = need(WORDS.find((w) => w.kind === "loanword"));
const run = (
  before: Progress,
  after: Progress,
  rows: GateRow[],
  results: boolean[],
) => runItems(before, after, rows, results, KANA, KANJI, WORDS);
const mk = (k: string, t: GateType) => itemKey(k, t);

describe("runItems", () => {
  it("marks a new item and fills meaning and reading", () => {
    const [e] = run(
      defaultProgress(),
      withBoxes({ [mk(k1.char, "meaning")]: 1 }),
      [row("meaning", k1.char)],
      [true],
    );
    expect(e).toMatchObject({
      key: k1.char,
      kind: "kanji",
      change: "new",
      meaning: k1.glosses[0],
      reading: showReading(need(mainReadings(k1)[0])),
    });
    expect(e?.gates).toEqual([
      { gate: "meaning", from: 0, to: 1, missed: false },
    ]);
    expect(e?.other).toEqual({ gate: "reading", box: 0 });
  });

  it("up, slip with right answers, same", () => {
    const before = withBoxes({
      [mk(k1.char, "meaning")]: 2,
      [mk(k2.char, "reading")]: 2,
      [mk(k3.char, "meaning")]: 4,
    });
    const after = withBoxes({
      [mk(k1.char, "meaning")]: 3,
      [mk(k2.char, "reading")]: 0,
      [mk(k3.char, "meaning")]: 4,
    });
    const out = run(
      before,
      after,
      [
        row("meaning", k3.char),
        row("reading", k2.char),
        row("meaning", k1.char),
      ],
      [true, false, true],
    );
    expect(out.map((e) => [e.key, e.change])).toEqual([
      [k1.char, "up"],
      [k2.char, "slip"],
      [k3.char, "same"],
    ]);
    expect(out[1]?.gates[0]).toMatchObject({
      missed: true,
      answers: mainReadings(k2).map(showReading),
    });
  });

  it("uses before/after boxes for a gate missed then re-asked right", () => {
    const before = withBoxes({ [mk(k1.char, "meaning")]: 3 });
    const after = withBoxes({ [mk(k1.char, "meaning")]: 4 });
    const [e] = run(
      before,
      after,
      [row("meaning", k1.char), row("meaning", k1.char)],
      [false, true],
    );
    expect(e?.gates).toHaveLength(1);
    expect(e?.gates[0]).toMatchObject({ from: 3, to: 4, missed: true });
    expect(e?.change).toBe("up");
  });

  it("folds both gates of an item into one entry", () => {
    const before = withBoxes({
      [mk(k4.char, "meaning")]: 3,
      [mk(k4.char, "reading")]: 1,
    });
    const after = withBoxes({
      [mk(k4.char, "meaning")]: 4,
      [mk(k4.char, "reading")]: 0,
    });
    const out = run(
      before,
      after,
      [row("meaning", k4.char), row("reading", k4.char)],
      [true, false],
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.gates.map((g) => g.gate)).toEqual(["meaning", "reading"]);
    expect(out[0]?.change).toBe("slip");
    expect(out[0]?.other).toBeUndefined();
  });

  it("orders new, up, slip, same, then first asked", () => {
    const before = withBoxes({
      [mk(a.char, "kana")]: 1,
      [mk(b.char, "kana")]: 2,
      [mk(k1.char, "meaning")]: 2,
      [mk(k2.char, "meaning")]: 2,
    });
    const after = withBoxes({
      [mk(a.char, "kana")]: 2,
      [mk(b.char, "kana")]: 0,
      [mk(k1.char, "meaning")]: 2,
      [mk(k2.char, "meaning")]: 3,
      [mk(k3.char, "meaning")]: 1,
      [mk(k4.char, "meaning")]: 1,
    });
    const out = run(
      before,
      after,
      [
        row("meaning", k1.char),
        row("kana", b.char),
        row("meaning", k3.char),
        row("kana", a.char),
        row("meaning", k4.char),
        row("meaning", k2.char),
      ],
      [true, false, true, true, true, true],
    );
    expect(out.map((e) => [e.key, e.change])).toEqual([
      [k3.char, "new"],
      [k4.char, "new"],
      [a.char, "up"],
      [k2.char, "up"],
      [b.char, "slip"],
      [k1.char, "same"],
    ]);
    expect(out.find((e) => e.key === a.char)).toMatchObject({
      kind: "kana",
      meaning: a.romaji,
    });
    expect(out.find((e) => e.key === a.char)?.reading).toBeUndefined();
  });

  it("ignores unanswered rows", () => {
    const out = run(
      defaultProgress(),
      defaultProgress(),
      [row("meaning", k1.char), row("meaning", k2.char)],
      [true],
    );
    expect(out.map((e) => e.key)).toEqual([k1.char]);
  });

  it("handles kanji words and loanwords; mode lists limit items", () => {
    const after = withBoxes({
      [mk(kw.word, "word")]: 1,
      [mk(loan.word, "word")]: 2,
    });
    const rows = [row("word", kw.word), row("word", loan.word)];
    const out = run(defaultProgress(), after, rows, [true, true]);
    expect(out[0]).toMatchObject({
      kind: "word",
      reading: kw.reading,
      meaning: kw.glosses[0],
      other: { gate: "wordreading", box: 0 },
    });
    expect(out[1]).toMatchObject({ kind: "loanword" });
    expect(out[1]?.reading).toBeUndefined();
    expect(out[1]?.other).toBeUndefined();
    // WaniKani mode passes no words; meaning mode only kanji meanings
    expect(
      runItems(defaultProgress(), after, rows, [true, true], KANA, KANJI),
    ).toEqual([]);
  });

  it("gives a missed word gate its right answer", () => {
    const [e] = run(
      withBoxes({ [mk(kw.word, "wordreading")]: 2 }),
      withBoxes({ [mk(kw.word, "wordreading")]: 0 }),
      [row("wordreading", kw.word, kw.reading)],
      [false],
    );
    expect(e?.change).toBe("slip");
    expect(e?.gates[0]?.answers).toEqual([kw.reading]);
  });
});
