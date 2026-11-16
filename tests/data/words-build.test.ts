import { describe, expect, it } from "vitest";
import {
  byFrequency,
  KANJI_WORDS_PER_LEVEL,
  WORD_PICKER,
  wordCandidates,
  wordReport,
  type Candidate,
  type WordKanji,
  type WordPicker,
} from "../../scripts/words";

type K = { keb: string; pri?: string[] };
type R = { reb: string; pri?: string[]; restr?: string[]; nokanji?: boolean };
type S = { pos?: string[]; misc?: string[]; glosses?: string[] };

/** A tiny made-up JMdict entry; entities stay raw, as in the real file. */
function entry(ks: K[], rs: R[], sense: S = {}): string {
  const k = ks
    .map(
      (e) =>
        `<k_ele>\n<keb>${e.keb}</keb>\n${(e.pri ?? ["ichi1"]).map((p) => `<ke_pri>${p}</ke_pri>\n`).join("")}</k_ele>`,
    )
    .join("\n");
  const r = rs
    .map(
      (e) =>
        `<r_ele>\n<reb>${e.reb}</reb>\n${e.nokanji ? "<re_nokanji/>\n" : ""}${(e.restr ?? []).map((x) => `<re_restr>${x}</re_restr>\n`).join("")}${(e.pri ?? []).map((p) => `<re_pri>${p}</re_pri>\n`).join("")}</r_ele>`,
    )
    .join("\n");
  const s = [
    ...(sense.pos ?? ["&n;"]).map((p) => `<pos>${p}</pos>`),
    ...(sense.misc ?? []).map((m) => `<misc>${m}</misc>`),
    ...(sense.glosses ?? ["thing"]).map((g) => `<gloss>${g}</gloss>`),
  ].join("\n");
  return `<entry>\n<ent_seq>1</ent_seq>\n${k}\n${r}\n<sense>\n${s}\n</sense>\n<sense>\n<pos>&n;</pos>\n<gloss>later sense</gloss>\n</sense>\n</entry>`;
}
const jmdict = (...entries: string[]) =>
  `<?xml version="1.0"?>\n<JMdict>\n${entries.join("\n")}\n</JMdict>`;

const KANJI: WordKanji[] = [
  { char: "一", level: 2, on: "いち", kun: { base: "ひと", okurigana: "つ" } },
  { char: "人", level: 2, on: "じん", kun: { base: "ひと", okurigana: "" } },
  {
    char: "入",
    level: 2,
    on: "にゅう",
    kun: { base: "はい", okurigana: "る" },
  },
  { char: "金", level: 3, on: "きん", kun: { base: "かね", okurigana: "" } },
  { char: "今", level: 4, on: "こん", kun: { base: "いま", okurigana: "" } },
  { char: "日", level: 5, on: "にち", kun: { base: "ひ", okurigana: "" } },
  { char: "上", level: 2, on: "じょう", kun: { base: "うえ", okurigana: "" } },
  { char: "出", level: 2, on: "しゅつ", kun: { base: "で", okurigana: "る" } },
  { char: "来", level: 3, on: "らい", kun: { base: "く", okurigana: "る" } },
  { char: "語", level: 6, on: "ご", kun: null },
];

const words = (...entries: string[]) =>
  wordCandidates(jmdict(...entries), KANJI).candidates.map(
    (c) => `${c.word} ${c.reading}`,
  );
const removedBy = (...entries: string[]) =>
  Object.fromEntries(
    Object.entries(wordCandidates(jmdict(...entries), KANJI).removed).filter(
      ([, n]) => n > 0,
    ),
  );

describe("wordCandidates: spelling and reading", () => {
  it("needs a common kanji spelling", () => {
    expect(
      words(entry([{ keb: "一人", pri: ["news2"] }], [{ reb: "ひとり" }])),
    ).toEqual([]);
  });

  it("takes the first common spelling that passes, with its reading", () => {
    const e = entry(
      [{ keb: "壱人" }, { keb: "一人", pri: ["news2"] }, { keb: "一人人" }],
      [{ reb: "ひとり" }],
    );
    expect(words(e)).toEqual(["一人人 ひとり"]);
  });

  it("follows re_restr and prefers a common reading", () => {
    const e = entry(
      [{ keb: "一人" }],
      [
        { reb: "いちにん", restr: ["独り"] },
        { reb: "ひとりい" },
        { reb: "ひとり", pri: ["ichi1"] },
      ],
    );
    expect(words(e)).toEqual(["一人 ひとり"]);
    const restricted = entry(
      [{ keb: "一人" }],
      [{ reb: "ひとり", pri: ["ichi1"], restr: ["独り"] }, { reb: "いちにん" }],
    );
    expect(words(restricted)).toEqual(["一人 いちにん"]);
  });

  it("skips re_nokanji readings", () => {
    const e = entry(
      [{ keb: "一人" }],
      [{ reb: "ひとり", pri: ["ichi1"], nokanji: true }, { reb: "いちにん" }],
    );
    expect(words(e)).toEqual(["一人 いちにん"]);
  });

  it("keeps the better-ranked entry per spelling", () => {
    const a = entry([{ keb: "入る", pri: ["ichi1"] }], [{ reb: "いる" }]);
    const b = entry(
      [{ keb: "入る", pri: ["ichi1", "news1", "nf05"] }],
      [{ reb: "いれる" }],
    );
    expect(words(a, b)).toEqual(["入る いれる"]);
    expect(words(b, a)).toEqual(["入る いれる"]);
    expect(removedBy(a, b)).toEqual({ duplicateSpelling: 1 });
  });
});

describe("wordCandidates: filters", () => {
  it("characters: only our kanji, kana and 々", () => {
    expect(words(entry([{ keb: "一匹" }], [{ reb: "いっぴき" }]))).toEqual([]);
    expect(words(entry([{ keb: "人々" }], [{ reb: "ひとびと" }]))).toEqual([
      "人々 ひとびと",
    ]);
    expect(removedBy(entry([{ keb: "一匹" }], [{ reb: "いっぴき" }]))).toEqual({
      characters: 1,
    });
  });

  it("katakana words: kept as compounds, reading as written", () => {
    const { candidates } = wordCandidates(
      jmdict(entry([{ keb: "アメリカ人" }], [{ reb: "アメリカじん" }])),
      KANJI,
    );
    expect(candidates).toMatchObject([
      { word: "アメリカ人", reading: "アメリカじん", kind: "compound" },
    ]);
  });

  it("startsWithKanji: needs a kanji, at the start or after お/ご", () => {
    expect(words(entry([{ keb: "その上" }], [{ reb: "そのうえ" }]))).toEqual(
      [],
    );
    expect(words(entry([{ keb: "お金" }], [{ reb: "おかね" }]))).toEqual([
      "お金 おかね",
    ]);
    expect(words(entry([{ keb: "テレビ" }], [{ reb: "テレビ" }]))).toEqual([]);
    expect(removedBy(entry([{ keb: "テレビ" }], [{ reb: "テレビ" }]))).toEqual({
      startsWithKanji: 1,
    });
  });

  it("notUsuallyKana: drops &uk; in the first sense only", () => {
    const uk = entry([{ keb: "出来る" }], [{ reb: "できる" }], {
      misc: ["&uk;"],
    });
    expect(words(uk)).toEqual([]);
    expect(removedBy(uk)).toEqual({ notUsuallyKana: 1 });
  });

  it("usualSense: drops affix-only and archaic/rare first senses", () => {
    const suf = entry([{ keb: "人人" }], [{ reb: "じんじん" }], {
      pos: ["&suf;", "&ctr;"],
    });
    const mixed = entry([{ keb: "人人" }], [{ reb: "じんじん" }], {
      pos: ["&n;", "&suf;"],
    });
    expect(words(suf)).toEqual([]);
    expect(words(mixed)).toEqual(["人人 じんじん"]);
    for (const m of ["&arch;", "&obs;", "&rare;", "&obsc;"])
      expect(
        removedBy(
          entry([{ keb: "人人" }], [{ reb: "じんじん" }], { misc: [m] }),
        ),
      ).toEqual({ usualSense: 1 });
  });

  it("fitsGate: spelling ≤ 6 characters, reading ≤ 7 kana", () => {
    expect(
      words(entry([{ keb: "一人一人一人" }], [{ reb: "ひとりひとり" }])),
    ).toHaveLength(1);
    expect(
      words(entry([{ keb: "一人一人一人一" }], [{ reb: "ひとりひと" }])),
    ).toEqual([]);
    expect(
      words(entry([{ keb: "一人" }], [{ reb: "ひとりひとりひ" }])),
    ).toHaveLength(1);
    expect(
      words(entry([{ keb: "一人" }], [{ reb: "ひとりひとりひと" }])),
    ).toEqual([]);
  });

  it("usableGloss: first sense needs a clean gloss; picks with pickGlosses", () => {
    const bad = entry([{ keb: "一人" }], [{ reb: "ひとり" }], {
      glosses: ["(abbreviation)", "counter for people"],
    });
    expect(removedBy(bad)).toEqual({ usableGloss: 1 });
    const { candidates } = wordCandidates(
      jmdict(
        entry([{ keb: "一人" }], [{ reb: "ひとり" }], {
          glosses: ["one person (alone)", "single person", "R&amp;D"],
        }),
      ),
      KANJI,
    );
    expect(candidates[0]?.glosses).toEqual([
      "one person",
      "single person",
      "R&D",
    ]);
  });

  it("notRepeatOfKanji: drops one kanji read as taught, keeps the rest", () => {
    const rep = (keb: string, reb: string) =>
      words(entry([{ keb }], [{ reb }]));
    expect(rep("人", "ひと")).toEqual([]); // kun base
    expect(rep("人", "じん")).toEqual([]); // on
    expect(rep("入る", "はいる")).toEqual([]); // kun with its okurigana
    expect(rep("人", "にん")).toEqual(["人 にん"]); // reading not taught
    expect(rep("入る", "いる")).toEqual(["入る いる"]);
    expect(rep("一人", "ひとり")).toEqual(["一人 ひとり"]); // two kanji
    expect(rep("一つ", "ひとつ")).toEqual([]);
    expect(rep("一", "ひとつ")).toEqual(["一 ひとつ"]); // okurigana not written
    expect(removedBy(entry([{ keb: "人" }], [{ reb: "ひと" }]))).toEqual({
      notRepeatOfKanji: 1,
    });
  });
});

describe("wordCandidates: kind, level, frequency facts", () => {
  it("kind: single, okurigana, compound", () => {
    const { candidates } = wordCandidates(
      jmdict(
        entry([{ keb: "人" }], [{ reb: "にん" }]),
        entry([{ keb: "出る" }], [{ reb: "でる" }], { glosses: ["go out"] }),
        entry([{ keb: "お金" }], [{ reb: "おかね" }]),
        entry([{ keb: "今日" }], [{ reb: "きょう" }]),
        entry([{ keb: "人々" }], [{ reb: "ひとびと" }]),
        entry([{ keb: "出来る" }], [{ reb: "できる" }]),
      ),
      KANJI.map((k) => (k.char === "出" ? { ...k, kun: null } : k)),
    );
    expect(candidates.map((c) => `${c.word} ${c.kind}`)).toEqual([
      "人 single",
      "出る okurigana",
      "お金 okurigana",
      "今日 compound",
      "人々 compound",
      "出来る compound",
    ]);
  });

  it("level: the highest level of its kanji; 々 adds none", () => {
    const { candidates } = wordCandidates(
      jmdict(
        entry([{ keb: "今日" }], [{ reb: "きょう" }]),
        entry([{ keb: "人々" }], [{ reb: "ひとびと" }]),
        entry([{ keb: "お金" }], [{ reb: "おかね" }]),
      ),
      KANJI,
    );
    expect(candidates.map((c) => c.level)).toEqual([5, 2, 3]);
  });

  it("keeps nf and the other priority tags of the spelling", () => {
    const { candidates } = wordCandidates(
      jmdict(
        entry(
          [{ keb: "一人", pri: ["ichi1", "news1", "nf02"] }],
          [{ reb: "ひとり" }],
        ),
        entry([{ keb: "大人", pri: ["spec1"] }], [{ reb: "おとな" }]),
      ),
      [...KANJI, { char: "大", level: 2, on: "だい", kun: null }],
    );
    expect(candidates.map((c) => [c.nf, c.pri])).toEqual([
      [2, ["ichi1", "news1"]],
      [null, ["spec1"]],
    ]);
  });
});

/** A made-up candidate. */
const cand = (
  word: string,
  kind: Candidate["kind"],
  level = 2,
  nf: number | null = null,
  pri: string[] = ["ichi1"],
): Candidate => ({
  word,
  reading: "よみ",
  glosses: [`${word} gloss`],
  kind,
  level,
  nf,
  pri,
});
const names = (cs: Candidate[]) => cs.map((c) => c.word);

describe("byFrequency", () => {
  it("orders by level, then nf (null last), tag count, spelling", () => {
    const cs = [
      cand("d", "compound", 3, 1),
      cand("c", "compound", 2, null, ["ichi1", "news1"]),
      cand("b", "compound", 2, null),
      cand("a", "compound", 2, null),
      cand("e", "compound", 2, 40),
      cand("f", "compound", 2, 7),
    ];
    expect(names(byFrequency(cs, 30))).toEqual(["f", "e", "c", "a", "b", "d"]);
  });

  it("fills each kind's share from its best-ranked candidates", () => {
    const cs = [
      ...Array.from({ length: 5 }, (_, i) => cand(`s${i}`, "single", 2, i + 1)),
      ...Array.from({ length: 5 }, (_, i) =>
        cand(`o${i}`, "okurigana", 2, i + 10),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        cand(`c${i}`, "compound", 2, i + 20),
      ),
    ];
    // 8 per level: 2 single, 2 okurigana, 4 compound, despite singles ranking best.
    expect(names(byFrequency(cs, 8))).toEqual([
      "s0",
      "s1",
      "o0",
      "o1",
      "c0",
      "c1",
      "c2",
      "c3",
    ]);
  });

  it("fills a kind's shortfall from the best-ranked of the rest", () => {
    const cs = [
      cand("s0", "single", 2, 30),
      ...Array.from({ length: 4 }, (_, i) =>
        cand(`o${i}`, "okurigana", 2, i + 10),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        cand(`c${i}`, "compound", 2, i + 1),
      ),
    ];
    // Share 2/2/4; one single short → next best is c4 (nf 5).
    expect(names(byFrequency(cs, 8))).toEqual([
      "c0",
      "c1",
      "c2",
      "c3",
      "c4",
      "o0",
      "o1",
      "s0",
    ]);
  });

  it("takes every candidate of a level with fewer than perLevel", () => {
    const cs = [cand("a", "single"), cand("b", "compound", 3)];
    expect(names(byFrequency(cs, KANJI_WORDS_PER_LEVEL))).toEqual(["a", "b"]);
  });

  it("WORD_PICKER (whichever it is) keeps teaching order and the cap", () => {
    const cs = [
      cand("b", "compound", 3, 1),
      ...Array.from({ length: 4 }, (_, i) => cand(`a${i}`, "compound", 2, i)),
    ];
    const out = WORD_PICKER(cs, 3);
    expect(out.map((c) => c.level)).toEqual([2, 2, 2, 3]);
  });

  it("another picker of the same type swaps in", () => {
    const alphabetical: WordPicker = (cs, perLevel) =>
      [...cs]
        .sort((a, b) => a.level - b.level || (a.word < b.word ? -1 : 1))
        .filter(
          (c, _, all) =>
            all.filter((o) => o.level === c.level).indexOf(c) < perLevel,
        );
    const { candidates } = wordCandidates(
      jmdict(
        entry([{ keb: "人人", pri: ["ichi1", "nf01"] }], [{ reb: "じんじん" }]),
        entry([{ keb: "一人" }], [{ reb: "ひとり" }]),
        entry([{ keb: "入る" }], [{ reb: "いる" }]),
      ),
      KANJI,
    );
    const run = (pick: WordPicker) => names(pick(candidates, 2));
    expect(run(byFrequency)).toEqual(["人人", "一人"]);
    expect(run(alphabetical)).toEqual(["一人", "人人"]);
  });
});

describe("wordReport", () => {
  it("summarises removals, kind mix and the listed levels", () => {
    const chosen = [
      cand("一人", "compound", 2),
      cand("人", "single", 2),
      cand("今日", "compound", 11),
    ];
    const removed = {
      characters: 3,
      startsWithKanji: 0,
      notUsuallyKana: 1,
      usualSense: 0,
      fitsGate: 0,
      usableGloss: 0,
      notRepeatOfKanji: 2,
      duplicateSpelling: 0,
    };
    const report = wordReport(removed, chosen);
    expect(report.split("\n")[0]).toBe("words: 3 over 2 levels");
    expect(report).toContain("characters 3\n");
    expect(report).toContain("notRepeatOfKanji 2\n");
    expect(report).toContain("L2  single 1  okurigana 0  compound 1  (2)");
    expect(report).toContain("L11  single 0  okurigana 0  compound 1  (1)");
    expect(report).toContain("# Level 2\n一人 よみ 一人 gloss compound\n");
    expect(report).not.toContain("# Level 11");
  });
});
