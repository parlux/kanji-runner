import { describe, expect, it } from "vitest";
import {
  countRanks,
  easyCounts,
  logScore,
  matchThemes,
  parseTatoeba,
  usefulness,
  usefulReport,
  W_EASY,
  W_SPOKEN,
  W_THEME,
  wordValue,
} from "../../scripts/useful";
import type { Candidate } from "../../scripts/words";

const cand = (word: string, spellings: string[] = []): Candidate => ({
  word,
  reading: "",
  glosses: [],
  kind: "compound",
  level: 2,
  nf: null,
  pri: [],
  spellings,
  homograph: false,
});

describe("logScore", () => {
  it("is 1 at rank 1, 0 at the list's end, log-scaled between", () => {
    expect(logScore(1, 100)).toBe(1);
    expect(logScore(100, 100)).toBeCloseTo(0);
    expect(logScore(10, 100)).toBeCloseTo(0.5);
  });

  it("is 0 when unlisted", () => {
    expect(logScore(null, 100)).toBe(0);
    expect(logScore(Infinity, 100)).toBe(0);
  });
});

describe("wordValue", () => {
  it("weighs theme, spoken and easy each alone", () => {
    expect(wordValue({ theme: true, spoken: 0, easy: 0 })).toBe(W_THEME);
    expect(wordValue({ theme: false, spoken: 0.5, easy: 0 })).toBe(
      W_SPOKEN * 0.5,
    );
    expect(wordValue({ theme: false, spoken: 0, easy: 0.5 })).toBe(
      W_EASY * 0.5,
    );
    expect(wordValue({ theme: false, spoken: 0, easy: 0 })).toBe(0);
  });

  it("adds the parts", () => {
    expect(wordValue({ theme: true, spoken: 1, easy: 1 })).toBe(
      W_THEME + W_SPOKEN + W_EASY,
    );
  });
});

describe("matchThemes", () => {
  it("lets the later of two same-spelled words win (racers come last)", () => {
    const moto = cand("下");
    const shita = cand("下");
    expect(matchThemes({ places: ["下"] }, [moto, shita])[0]?.candidate).toBe(
      shita,
    );
  });

  it("matches by spelling, else by another kanji spelling", () => {
    const eki = cand("駅");
    const dekakeru = cand("出かける", ["出掛ける"]);
    const ms = matchThemes({ trains: ["駅", "出掛ける", "切符"] }, [
      eki,
      dekakeru,
    ]);
    expect(ms).toEqual([
      { theme: "trains", word: "駅", candidate: eki, viaSpelling: false },
      {
        theme: "trains",
        word: "出掛ける",
        candidate: dekakeru,
        viaSpelling: true,
      },
      { theme: "trains", word: "切符", candidate: null, viaSpelling: false },
    ]);
  });
});

describe("easyCounts", () => {
  it("counts sentences holding the spelling or another spelling, once each", () => {
    const sentences = ["駅に行く。", "出掛ける前に駅へ。", "出かける。", "水"];
    const eki = cand("駅");
    const dekakeru = cand("出かける", ["出掛ける"]);
    const mizu = cand("水道");
    const counts = easyCounts(sentences, [eki, dekakeru, mizu]);
    expect(counts.get(eki)).toBe(2);
    expect(counts.get(dekakeru)).toBe(2);
    expect(counts.get(mizu)).toBe(0);
  });
});

describe("countRanks", () => {
  it("ranks by count, ties share the rank, 0 is unlisted", () => {
    const { ranks, size } = countRanks(
      new Map([
        ["a", 5],
        ["b", 3],
        ["c", 3],
        ["d", 1],
        ["e", 0],
      ]),
    );
    expect([...ranks.entries()].sort()).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4],
      ["e", null],
    ]);
    expect(size).toBe(4);
  });
});

describe("usefulness", () => {
  it("scores each part alone", () => {
    const themed = cand("切符");
    const spoken = cand("今日");
    const easy = cand("水道");
    const none = cand("干支");
    const all = [themed, spoken, easy, none];
    const u = usefulness(
      all,
      new Set([themed]),
      new Map([
        [themed, Infinity],
        [spoken, 0],
        [easy, Infinity],
        [none, Infinity],
      ]),
      1000,
      new Map([
        [themed, 0],
        [spoken, 0],
        [easy, 7],
        [none, 0],
      ]),
    );
    expect(u.get(themed)?.value).toBe(W_THEME);
    expect(u.get(spoken)).toMatchObject({ spoken: 1, value: W_SPOKEN });
    expect(u.get(easy)).toMatchObject({ easy: 1, value: W_EASY });
    expect(u.get(none)?.value).toBe(0);
  });

  it("gives a one-kanji word no easy score", () => {
    const mizu = cand("水");
    const u = usefulness(
      [mizu],
      new Set(),
      new Map(),
      10,
      new Map([[mizu, 7]]),
    );
    expect(u.get(mizu)).toMatchObject({ easy: 0, value: 0 });
  });

  it("takes 0-based usage ranks", () => {
    const c = cand("今日");
    const u = usefulness([c], new Set(), new Map([[c, 9]]), 100, new Map());
    expect(u.get(c)?.spoken).toBeCloseTo(0.5);
  });
});

describe("parseTatoeba and usefulReport", () => {
  it("reads the sentence column", () => {
    expect(parseTatoeba("1\tjpn\t駅です。\n2\tjpn\t水。\n")).toEqual([
      "駅です。",
      "水。",
    ]);
  });

  it("summarizes matches and lists the unmatched", () => {
    const eki = cand("駅");
    const ms = matchThemes({ trains: ["駅", "切符"] }, [eki]);
    const u = usefulness([eki], new Set([eki]), new Map(), 10, new Map());
    const text = usefulReport(ms, u);
    expect(text.split("\n")[0]).toBe(
      "theme words: 1 of 2 match a candidate (50%)",
    );
    expect(text).toContain("trains 1 / 2");
    expect(text).toContain("trains: 切符");
    expect(text).toContain("1. 駅");
  });
});
