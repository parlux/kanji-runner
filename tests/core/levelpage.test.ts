import { describe, expect, it } from "vitest";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { levelPage } from "../../src/core/levelpage";
import {
  meaningProgress,
  place,
  placeMeaning,
} from "../../src/core/progression";
import { defaultProgress, itemKey } from "../../src/core/srs";
import { WORDS } from "../../src/core/words";
import type { Progress } from "../../src/core/types";

const page = (p: Progress, level: number) =>
  levelPage(p, level, KANA, KANJI, WORDS);

const at = (box: number) => ({
  box,
  seen: 1,
  correct: 1,
  wrong: 0,
  lastSeen: 1,
});

/** At Kanji 1 (level 2): 日 learned, 一 meaning Strong and reading Met. */
function current(): Progress {
  const p = place(defaultProgress(), 1, KANA, KANJI, WORDS);
  p.items[itemKey("日", "meaning")] = at(4);
  p.items[itemKey("日", "reading")] = at(3);
  p.items[itemKey("一", "meaning")] = at(4);
  p.items[itemKey("一", "reading")] = at(1);
  return p;
}

describe("levelPage", () => {
  it("header: title, counts, reading to go; not locked at the current level", () => {
    const l = page(current(), 2);
    expect(l.title).toBe("Kanji 1 · Foundations");
    expect([l.learned, l.total, l.readingToGo]).toEqual([1, 15, 1]);
    expect(l.locked).toBe(false);
    expect(page(defaultProgress(), 0).title).toBe("Hiragana · Kana");
  });

  it("unlearned first in teaching order (kanji, its words; loanword last), then learned", () => {
    const l = page(current(), 2);
    expect(l.items.map((i) => i.key)).toEqual([
      "一",
      "一つ",
      "一日",
      "一人",
      "人",
      "人々",
      "大",
      "大人",
      "手",
      "下",
      "下手",
      "下車",
      "車",
      "テレビ",
      "日",
    ]);
    expect(l.items.at(-1)?.learned).toBe(true);
    expect(l.items.slice(0, -1).every((i) => !i.learned)).toBe(true);
  });

  it("rows: reading, meaning, stages per kind", () => {
    const l = page(current(), 2);
    const by = (k: string) => l.items.find((i) => i.key === k);
    expect(by("一")).toMatchObject({
      kind: "kanji",
      reading: "いち",
      stages: "M Strong · R Met",
    });
    expect(by("一")?.meaning).toBeTruthy();
    expect(by("日")?.stages).toBe("M Strong · R Learned");
    expect(by("一日")).toMatchObject({ kind: "word", stages: "M New · R New" });
    expect(by("一日")?.reading).toBeTruthy();
    const tv = by("テレビ");
    expect(tv).toMatchObject({ kind: "loanword", stages: "New" });
    expect(tv?.reading).toBeUndefined();
    const kana = page(defaultProgress(), 0).items[0];
    expect(kana).toMatchObject({ key: "あ", kind: "kana", reading: "a" });
    expect(kana?.stages).toBe("New");
  });

  it("a learned level: all learned, ticks on every row", () => {
    const l = page(place(defaultProgress(), 5, KANA, KANJI, WORDS), 2);
    expect(l.learned).toBe(l.total);
    expect(l.items.every((i) => i.learned)).toBe(true);
  });

  it("a locked level is marked locked; stages still shown", () => {
    const p = current();
    p.items[itemKey("見", "meaning")] = at(2);
    const lvl = KANJI.find((k) => k.char === "見")?.level ?? 99;
    const l = page(p, lvl);
    expect(lvl).toBeGreaterThan(p.unlockedLevel);
    expect(l.locked).toBe(true);
    expect(l.items.find((i) => i.key === "見")?.stages).toBe(
      "M Recalled · R New",
    );
  });

  it("meaning mode: kanji only, meaning stage only", () => {
    const p = placeMeaning(meaningProgress(), 1, KANJI);
    const l = levelPage(p, 2, [], KANJI, [], true);
    expect(l.items).toHaveLength(7);
    expect(l.items.every((i) => i.kind === "kanji")).toBe(true);
    expect(l.items[0]?.stages).toBe("New");
  });
});
