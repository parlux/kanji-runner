import { describe, expect, it } from "vitest";
import { trim } from "../../src/wanikani/parse";
import assignments from "./fixtures/assignments.json";
import subjects from "./fixtures/subjects.json";
import user from "./fixtures/user.json";

describe("trim", () => {
  const r = trim(user, subjects, assignments);
  if (!r.ok) throw new Error(r.error);
  const cache = r.value;
  const get = (c: string) => cache.kanji.find((k) => k.char === c);

  it("keeps the user level and a schema version", () => {
    expect(cache.version).toBe(1);
    expect(cache.level).toBe(5);
  });

  it("keeps only taught kanji: stage 0, hidden and unassigned are out", () => {
    expect(cache.kanji.map((k) => k.char).sort()).toEqual(
      ["休", "十", "明", "龘"].sort(),
    );
  });

  it("orders glosses primary, accepted, whitelist and drops blacklist", () => {
    expect(get("休")?.glosses).toEqual([
      "Zorblat",
      "Zorblat Rest",
      "Extra Whitelisted",
    ]);
  });

  it("keeps accepted readings only, primary first", () => {
    expect(get("休")?.readings.map((x) => x.reading)).toEqual([
      "きゅう",
      "やす.む",
    ]);
    expect(get("十")?.readings).toEqual([]);
  });

  it("keeps mnemonics, hints, stage and available_at", () => {
    const k = get("休");
    expect(k?.mnemonics.meaning).toBe("Test mnemonic about a zorblat");
    expect(k?.hints.reading).toBe("Test reading hint");
    expect(k?.srsStage).toBe(3);
    expect(k?.availableAt).toBe("2026-11-01T00:00:00.000000Z");
    expect(get("明")?.mnemonics.reading).toBeUndefined();
  });

  it("round-trips through JSON", () => {
    expect(JSON.parse(JSON.stringify(cache))).toEqual(cache);
  });
});

describe("trim errors", () => {
  const bad: [string, unknown, unknown, unknown][] = [
    ["null user", null, subjects, assignments],
    ["user without level", { data: {} }, subjects, assignments],
    ["subjects not an array", user, { data: [] }, assignments],
    ["page without data", user, [{}], assignments],
    ["subject missing characters", user, [{ data: [{ id: 1, data: {} }] }], []],
    [
      "assignment missing stage",
      user,
      subjects,
      [{ data: [{ data: { subject_id: 101 } }] }],
    ],
    ["undefined everything", undefined, undefined, undefined],
    ["strings", "x", "y", "z"],
  ];
  it.each(bad)("%s gives an error result, not a throw", (_n, u, s, a) => {
    const r = trim(u, s, a);
    expect(r.ok).toBe(false);
  });
});
