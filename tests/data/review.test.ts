import { describe, expect, it } from "vitest";
import type { KanjiItem } from "../../src/core/types";
import {
  batches,
  idKey,
  parseDoc,
  parseJudge,
  partId,
  partItems,
  sample,
  seededPick,
  soundId,
  soundItems,
  storyId,
  storyItems,
  withVersions,
  type Write,
} from "../../scripts/stories/review";

const kanji = (
  char: string,
  level: number,
  components: string[] = [],
  on: string | null = "こう",
): KanjiItem =>
  ({
    char,
    level,
    glosses: ["g-" + char],
    on,
    kun: null,
    readings: [],
    components,
  }) as unknown as KanjiItem;

const parts = { 口: { name: "mouth" }, 日: { name: "sun" } };

describe("review seed: ids", () => {
  it("makes ASCII ids from lowercase hex codepoints and reads them back", () => {
    expect(storyId("折")).toBe("story-6298");
    expect(partId("口")).toBe("part-53e3");
    expect(soundId("しょう")).toBe("sound-3057-3087-3046");
    expect(partId("𠂉")).toMatch(/^part-[0-9a-f]+$/);
    expect(idKey("sound-3057-3087-3046")).toEqual({
      kind: "sound",
      key: "しょう",
    });
    expect(idKey("story-6298")).toEqual({ kind: "story", key: "折" });
    expect(idKey("nope")).toBeNull();
  });
});

describe("review seed: judge files", () => {
  it("takes the first round's verdict, fails on any round, hides close reasons", () => {
    const j = parseJudge([
      {
        a: { verdict: "fail", reason: "weak", text: "dull" },
        b: { verdict: "fail", reason: "close", text: "quotes WaniKani" },
        c: "pass",
      },
      { a: "pass", c: { verdict: "fail", reason: "wrong", text: "bad on" } },
    ]);
    expect(j.get("a")).toEqual({
      first: { verdict: "weak", reason: "dull" },
      failed: true,
    });
    expect(j.get("b")).toEqual({ first: { verdict: "close" }, failed: true });
    expect(j.get("c")).toEqual({ first: { verdict: "pass" }, failed: true });
    expect(parseJudge({ kanji: { x: "pass" } }).get("x")?.failed).toBe(false);
  });
});

describe("review seed: sample rule", () => {
  const chars = Array.from({ length: 30 }, (_, i) =>
    String.fromCharCode(0x4e00 + i),
  );
  const judge = parseJudge({
    [chars[3] as string]: { verdict: "fail", reason: "weak" },
  });

  it("pilot levels get every kanji", () => {
    const m = sample(6, chars, null, false);
    expect(m.size).toBe(30);
    expect([...m.values()].every((w) => w === "all")).toBe(true);
  });

  it("later levels: judge fails plus 10 seeded random, same on re-run", () => {
    const a = sample(8, chars, judge, false);
    expect([...a.values()].filter((w) => w === "judge-fail")).toHaveLength(1);
    expect(a.get(chars[3] as string)).toBe("judge-fail");
    expect([...a.values()].filter((w) => w === "random")).toHaveLength(10);
    expect([...sample(8, chars, judge, false)]).toEqual([...a]);
    expect([...sample(9, chars, judge, false)]).not.toEqual([...a]);
  });

  it("no judge file: random only", () => {
    const a = sample(8, chars, null, false);
    expect([...a.values()].every((w) => w === "random")).toBe(true);
    expect(a.size).toBe(10);
  });

  it("--all seeds the rest as extra", () => {
    const a = sample(8, chars, judge, true);
    expect(a.size).toBe(30);
    expect([...a.values()].filter((w) => w === "extra")).toHaveLength(19);
  });

  it("seededPick is stable and has no repeats", () => {
    const p = seededPick(chars, 10, 8);
    expect(new Set(p).size).toBe(10);
    expect(seededPick(chars, 10, 8)).toEqual(p);
  });
});

describe("review seed: items", () => {
  const ks = [
    kanji("A", 6, ["口", "日"]),
    kanji("B", 6, ["口"], null),
    kanji("C", 8, ["日"]),
  ];

  it("parts and sounds carry names, keywords and uses", () => {
    const p = partItems(parts, ks);
    expect(p.map((w) => w.doc_id)).toEqual([partId("口"), partId("日")]);
    expect(p[0]?.data).toMatchObject({
      kind: "part",
      key: "口",
      pass: 1,
      why: "all",
      name: "mouth",
      uses: ["A", "B"],
    });
    const s = soundItems({ こう: { keyword: "cone", note: "n" } }, ks);
    expect(s[0]?.data).toMatchObject({
      kind: "sound",
      keyword: "cone",
      note: "n",
      uses: ["A", "C"],
    });
  });

  it("uses are capped at 8", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      kanji("k" + i, 2, ["口"]),
    );
    expect(partItems(parts, many)[0]?.data.uses).toHaveLength(8);
  });

  it("story items hold glosses, parts with names, texts and the judge verdict, no close reason", () => {
    const file = { level: "Kanji 5", kanji: { A: { meaning: "m", on: "o" } } };
    const judge = parseJudge({
      A: { verdict: "fail", reason: "close", text: "same as WK" },
    });
    const w = storyItems(6, file, judge, parts, ks, false);
    expect(w).toHaveLength(1);
    expect(w[0]?.doc_id).toBe("story-41");
    expect(w[0]?.data).toMatchObject({
      kind: "story",
      key: "A",
      level: "Kanji 5",
      why: "all",
      glosses: ["g-A"],
      on: "こう",
      parts: [
        { part: "口", name: "mouth" },
        { part: "日", name: "sun" },
      ],
      text: { meaning: "m", on: "o" },
      judge: { verdict: "close" },
    });
    expect(JSON.stringify(w)).not.toContain("WK");
  });
});

describe("review seed: batches and versions", () => {
  const w = (n: number, pad = ""): Write[] =>
    Array.from({ length: n }, (_, i) => ({
      op: "set",
      collection: "items",
      doc_id: "part-" + i,
      data: { kind: "part", key: "x", pass: 1, why: "all", name: pad },
    }));

  it("at most 50 writes per file", () => {
    expect(batches(w(120)).map((b) => b.length)).toEqual([50, 50, 20]);
  });

  it("under 1 MiB per file", () => {
    const out = batches(w(10, "x".repeat(300_000)));
    for (const b of out)
      expect(JSON.stringify(b).length).toBeLessThan(1024 * 1024);
    expect(out.flat()).toHaveLength(10);
  });

  it("adds if_version and bumps pass for existing items, both file shapes", () => {
    const existing = new Map([
      ["part-0", parseDoc({ version: 3, pass: 2 })],
      ["part-1", parseDoc({ version: 5, data: { pass: 4 } })],
    ]) as Map<string, NonNullable<ReturnType<typeof parseDoc>>>;
    const out = withVersions(w(3), existing);
    expect(out[0]).toMatchObject({ if_version: 3, data: { pass: 3 } });
    expect(out[1]).toMatchObject({ if_version: 5, data: { pass: 5 } });
    expect(out[2]).not.toHaveProperty("if_version");
    expect(out[2]?.data.pass).toBe(1);
    expect(parseDoc({ pass: 1 })).toBeNull();
  });
});
