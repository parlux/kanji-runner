import { describe, expect, it } from "vitest";
import type { KanjiItem } from "../../src/core/types";
import {
  applyRenames,
  applyReviews,
  batches,
  idKey,
  parseDoc,
  parseVersionList,
  parseReview,
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
  type Existing,
  type Files,
  type Review,
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

  it("part items carry the note and, for a renamed part, was", () => {
    const p = partItems(
      { 口: { name: "lips", note: "A small open box." }, 日: { name: "sun" } },
      ks,
      new Map([["口", "mouth"]]),
    );
    expect(p[0]?.data).toMatchObject({
      note: "A small open box.",
      was: "mouth",
    });
    expect(p[1]?.data).not.toHaveProperty("note");
    expect(p[1]?.data).not.toHaveProperty("was");
  });

  it("items carry alts when present, and omit them otherwise", () => {
    const p = partItems(
      { 口: { name: "lips", alts: ["door", "box"] }, 日: { name: "sun" } },
      ks,
    );
    expect(p[0]?.data.alts).toEqual(["door", "box"]);
    expect(p[1]?.data).not.toHaveProperty("alts");
    const s = soundItems(
      { こう: { keyword: "cone", alts: ["cove"] }, か: { keyword: "car" } },
      ks,
    );
    expect(s[0]?.data.alts).toEqual(["cove"]);
    expect(s[1]?.data).not.toHaveProperty("alts");
  });

  it("fixed parts (named by their own meaning) are not seeded", () => {
    const p = partItems(
      { 口: { name: "mouth", fixed: true }, 日: { name: "sun" } },
      ks,
    );
    expect(p.map((w) => w.data.key)).toEqual(["日"]);
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
    expect(() =>
      withVersions(
        w(1),
        new Map([["part-0", { version: null, data: { pass: 1 } }]]),
      ),
    ).toThrow(/version-list/);
  });

  it("--bump bumps only listed ids; all existing items keep if_version", () => {
    const existing = new Map([
      ["part-0", { version: 3, data: { pass: 2 } }],
      ["part-1", { version: 5, data: { pass: 4 } }],
    ]);
    const out = withVersions(w(3), existing, new Set(["part-1", "part-2"]));
    expect(out[0]).toMatchObject({ if_version: 3, data: { pass: 2 } });
    expect(out[1]).toMatchObject({ if_version: 5, data: { pass: 5 } });
    expect(out[2]).not.toHaveProperty("if_version");
    expect(out[2]?.data.pass).toBe(1);
  });

  it("reads versions from a listing's tool output", () => {
    const text = `- "story-6298"  202 bytes  version 3  "/x/story-6298.json"\n- set "items"/"part-4e00" (version 1)`;
    expect([...parseVersionList(text)]).toEqual([
      ["story-6298", 3],
      ["part-4e00", 1],
    ]);
  });
});

describe("review apply", () => {
  const files = (): Files => ({
    parts: { 口: { name: "mouth" }, 日: { name: "sun" }, 木: { name: "tree" } },
    sounds: { こう: { keyword: "cone", note: "n" }, し: { keyword: "shield" } },
    stories: {
      "kanji-05.json": {
        level: "Kanji 5",
        kanji: {
          A: {
            meaning: "A <part>mouth</part> and a <part>sun</part>.",
            on: "<part>mouth</part> again",
            kun: "none",
          },
          B: { meaning: "Only a <part>sun</part>.", on: "x" },
        },
      },
      "kanji-06.json": {
        level: "Kanji 6",
        kanji: { C: { meaning: "The <part>mouth</part> speaks." } },
      },
    },
  });
  const rv = (o: Partial<Review> = {}): Review => ({ pass: 1, ...o });
  const run = (
    m: Record<string, Review>,
    items: Map<string, Existing> | null = null,
  ) => applyReviews(new Map(Object.entries(m)), files(), items);

  it("skips reviews of an older pass than the item's, only with items", () => {
    const m = { [partId("口")]: rv({ edit: "lips" }) };
    const items = new Map<string, Existing>([
      [partId("口"), { version: 3, data: { kind: "part", pass: 2 } }],
    ]);
    const r = run(m, items);
    expect(r.stale).toEqual([partId("口")]);
    expect(r.files.parts["口"]).toEqual({ name: "mouth" });
    expect(r.changed).toEqual([]);
    expect(run(m).files.parts["口"]).toEqual({ name: "lips" });
  });

  it("a part rename rewrites <part> text in every story using it and lists them", () => {
    const r = run({ [partId("口")]: rv({ edit: "lips" }) });
    expect(r.files.parts["口"]).toEqual({ name: "lips" });
    expect(r.renames).toEqual([
      { part: "口", from: "mouth", to: "lips", touched: ["A", "C"] },
    ]);
    const a = (
      r.files.stories["kanji-05.json"] as {
        kanji: Record<string, Record<string, string>>;
      }
    ).kanji["A"];
    expect(a?.["meaning"]).toBe("A <part>lips</part> and a <part>sun</part>.");
    expect(a?.["on"]).toBe("<part>lips</part> again");
    expect(JSON.stringify(r.files.stories["kanji-06.json"])).toContain(
      "<part>lips</part>",
    );
    expect(
      JSON.stringify(r.files.stories["kanji-05.json"]).match(/sun/g),
    ).toHaveLength(2);
    expect(r.changed).toEqual([
      "parts.json",
      "stories/kanji-05.json",
      "stories/kanji-06.json",
    ]);
  });

  it("rejects duplicate, empty and 4-word names but continues", () => {
    const r = run({
      [partId("口")]: rv({ edit: "Sun" }),
      [partId("日")]: rv({ edit: "big hot yellow ball" }),
      [partId("木")]: rv({ edit: "wood" }),
    });
    expect(r.rejected).toHaveLength(2);
    expect(r.rejected[0]).toContain("already used");
    expect(r.rejected[1]).toContain("over 3 words");
    expect(r.files.parts["口"]).toEqual({ name: "mouth" });
    expect(r.files.parts["木"]).toEqual({ name: "wood" });
    expect(r.changed).toEqual(["parts.json"]);
  });

  it("rename ripples like an apply edit, keeps the note, lists touched stories", () => {
    const input = files();
    input.parts["口"] = { name: "mouth", note: "A small box, open." };
    const r = applyRenames(
      [{ part: "口", from: "mouth", to: "lips", why: "visible" }],
      input,
    );
    expect(r.files.parts["口"]).toEqual({
      name: "lips",
      note: "A small box, open.",
    });
    expect(r.renames).toEqual([
      { part: "口", from: "mouth", to: "lips", touched: ["A", "C"] },
    ]);
    expect(JSON.stringify(r.files.stories)).not.toContain("<part>mouth</part>");
    expect(r.changed).toEqual([
      "parts.json",
      "stories/kanji-05.json",
      "stories/kanji-06.json",
    ]);
    // same result as apply's edit path
    const viaApply = run({ [partId("口")]: rv({ edit: "lips" }) });
    expect(r.files.stories).toEqual(viaApply.files.stories);
    expect(input.parts["口"]?.["name"]).toBe("mouth");
  });

  it("rename rejects duplicate, 4-word and stale-from names, and goes on", () => {
    const r = applyRenames(
      [
        { part: "口", from: "mouth", to: "Sun", why: "" },
        { part: "日", from: "sun", to: "big hot yellow ball", why: "" },
        { part: "木", from: "old", to: "wood", why: "" },
        { part: "木", from: "tree", to: "wood", why: "" },
      ],
      files(),
    );
    expect(r.rejected).toHaveLength(3);
    expect(r.rejected[0]).toContain("already used");
    expect(r.rejected[1]).toContain("over 3 words");
    expect(r.rejected[2]).toContain('"from" is "old"');
    expect(r.files.parts["木"]).toEqual({ name: "wood" });
    expect(r.changed).toEqual(["parts.json"]);
  });

  it("saves a sound keyword edit, unique among keywords", () => {
    const r = run({
      [soundId("こう")]: rv({ edit: "coat" }),
      [soundId("し")]: rv({ edit: "coat" }),
    });
    expect(r.files.sounds["こう"]).toEqual({ keyword: "coat", note: "n" });
    expect(r.files.sounds["し"]).toEqual({ keyword: "shield" });
    expect(r.keywords).toEqual([{ sound: "こう", from: "cone", to: "coat" }]);
    expect(r.rejected).toHaveLength(1);
    expect(r.changed).toEqual(["sounds.json"]);
  });

  it("✗ notes land per scope with our text and the note only", () => {
    const r = run({
      [partId("日")]: rv({ name: { verdict: "work", note: "too plain" } }),
      [soundId("し")]: rv({ keyword: { verdict: "work", note: "no" } }),
      [storyId("A")]: rv({
        meaning: { verdict: "ok" },
        on: { verdict: "work", note: "dull" },
      }),
      [storyId("C")]: rv({ meaning: { verdict: "ok" } }),
    });
    expect(r.notes["parts"]).toEqual([
      { key: "日", field: "name", note: "too plain", text: "sun" },
    ]);
    expect(r.notes["sounds"]).toEqual([
      { key: "し", field: "keyword", note: "no", text: "shield" },
    ]);
    expect(r.notes["kanji-05"]).toEqual([
      { key: "A", field: "on", note: "dull", text: "<part>mouth</part> again" },
    ]);
    expect(r.notes["kanji-06"]).toBeUndefined();
    expect(r.scopes["kanji-05"]).toEqual({
      reviewed: 1,
      ok: 0,
      work: 1,
      edits: 0,
    });
    expect(r.scopes["kanji-06"]).toEqual({
      reviewed: 1,
      ok: 1,
      work: 0,
      edits: 0,
    });
    expect(r.changed).toEqual([]);
  });

  it("counts random stories with a ✗ per level, and skips without items", () => {
    const m = {
      [storyId("A")]: rv({ on: { verdict: "work" } }),
      [storyId("B")]: rv({ meaning: { verdict: "work" } }),
      [storyId("C")]: rv({ meaning: { verdict: "work" } }),
    };
    expect(run(m).randomMisses).toBeNull();
    const item = (why: string): Existing => ({ version: 1, data: { why } });
    const items = new Map([
      [storyId("A"), item("random")],
      [storyId("B"), item("all")],
      [storyId("C"), item("random")],
    ]);
    expect(run(m, items).randomMisses).toEqual({
      "kanji-05": 1,
      "kanji-06": 1,
    });
  });

  it("parses review documents and rejects other shapes", () => {
    expect(
      parseReview({
        pass: 2,
        name: { verdict: "work", note: "n" },
        meaning: { verdict: "maybe" },
        edit: "x",
        at: "t",
      }),
    ).toEqual({
      pass: 2,
      name: { verdict: "work", note: "n" },
      edit: "x",
      at: "t",
    });
    expect(parseReview({ name: { verdict: "ok" } })).toBeNull();
  });
});
