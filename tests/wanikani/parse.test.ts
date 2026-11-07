import { describe, expect, it } from "vitest";
import { KANJI } from "../../src/core/kanji";
import { buildList, trim } from "../../src/wanikani/parse";
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

describe("buildList", () => {
  const r = trim(user, subjects, assignments);
  if (!r.ok) throw new Error(r.error);
  const NOW = Date.parse("2026-11-07T00:00:00Z");
  const list = buildList(r.value, KANJI, NOW);
  const get = (c: string) => list.kanji.find((k) => k.char === c);

  it("lists taught kanji with readings, ordered by level", () => {
    expect(list.level).toBe(5);
    // 十 has no on/kun reading, so it cannot be asked and is left out.
    expect(list.kanji.map((k) => k.char)).toEqual(["休", "明", "龘"]);
  });

  it("uses WaniKani glosses, level and accepted readings", () => {
    const k = get("休");
    expect(k?.glosses[0]).toBe("Zorblat");
    expect(k?.level).toBe(2);
    expect(k?.on).toBe("きゅう");
    expect(k?.readings).toEqual(["きゅう", "やすむ"]);
  });

  it("takes okurigana and components from the built-in data when known", () => {
    expect(get("休")?.kun).toEqual({ base: "やす", okurigana: "む" });
    expect(get("休")?.components).toEqual(["⺅", "木"]);
    expect(get("休")?.grade).toBe(1);
  });

  it("uses WaniKani's dot for okurigana and no components when unknown", () => {
    const k = get("龘");
    expect(k?.on).toBeNull();
    expect(k?.kun).toEqual({ base: "うご", okurigana: "く" });
    expect(k?.components).toEqual([]);
    expect(k?.freq).toBeNull();
  });

  it("similar names only kanji in the list", () => {
    // 休 is similar to 明, 龘 (taught), 人 (not taught) and 999 (unknown).
    expect(list.extras.get("休")?.similar).toEqual(["明"]);
    expect(list.extras.get("明")?.similar).toEqual(["休"]);
    expect(list.extras.get("龘")?.similar).toEqual(["休"]);
  });

  it("due uses the injected now", () => {
    expect(list.extras.get("休")?.due).toBe(true);
    expect(list.extras.get("明")?.due).toBe(false);
    expect(list.extras.get("龘")?.due).toBe(false);
    const later = buildList(r.value, KANJI, Date.parse("2027-01-01T00:00:00Z"));
    expect(later.extras.get("明")?.due).toBe(true);
    const before = buildList(
      r.value,
      KANJI,
      Date.parse("2026-10-31T00:00:00Z"),
    );
    expect(before.extras.get("休")?.due).toBe(false);
  });

  it("keeps stage, mnemonics and hints as extras", () => {
    const e = list.extras.get("休");
    expect(e?.srsStage).toBe(3);
    expect(e?.mnemonics.reading).toBe("Test reading mnemonic about a quux");
    expect(e?.hints.meaning).toBe("Test hint about a flimflam");
  });
});
