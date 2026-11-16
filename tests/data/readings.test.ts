import { describe, expect, it } from "vitest";
import {
  commonWords,
  countReadings,
  type CommonWord,
  type KanjiReadings,
} from "../../scripts/readings";

type K = { keb: string; pri?: string[] };
type R = { reb: string; pri?: string[]; restr?: string[]; nokanji?: boolean };

/** A tiny made-up JMdict entry. */
function entry(ks: K[], rs: R[]): string {
  const k = ks
    .map(
      (e) =>
        `<k_ele>\n<keb>${e.keb}</keb>\n${(e.pri ?? []).map((p) => `<ke_pri>${p}</ke_pri>\n`).join("")}</k_ele>`,
    )
    .join("\n");
  const r = rs
    .map(
      (e) =>
        `<r_ele>\n<reb>${e.reb}</reb>\n${e.nokanji ? "<re_nokanji/>\n" : ""}${(e.restr ?? []).map((x) => `<re_restr>${x}</re_restr>\n`).join("")}${(e.pri ?? []).map((p) => `<re_pri>${p}</re_pri>\n`).join("")}</r_ele>`,
    )
    .join("\n");
  return `<entry>\n<ent_seq>1</ent_seq>\n${k}\n${r}\n<sense><gloss>x</gloss></sense>\n</entry>`;
}
const jmdict = (...entries: string[]) =>
  `<?xml version="1.0"?>\n<JMdict>\n${entries.join("\n")}\n</JMdict>`;

describe("commonWords", () => {
  it("keeps entries with a common kanji spelling only", () => {
    const xml = jmdict(
      entry(
        [{ keb: "明るい", pri: ["ichi1", "news2"] }],
        [{ reb: "あかるい" }],
      ),
      entry([{ keb: "明かり", pri: ["news2", "nf30"] }], [{ reb: "あかり" }]),
      entry([], [{ reb: "あれ", pri: ["ichi1"] }]),
    );
    expect(commonWords(xml)).toEqual([{ pairs: [["明るい", "あかるい"]] }]);
  });

  it("skips uncommon spellings of a common entry", () => {
    const xml = jmdict(
      entry(
        [{ keb: "学校", pri: ["spec1"] }, { keb: "學校" }],
        [{ reb: "がっこう" }],
      ),
    );
    expect(commonWords(xml)).toEqual([{ pairs: [["学校", "がっこう"]] }]);
  });

  it("honours re_restr and skips re_nokanji", () => {
    const xml = jmdict(
      entry(
        [
          { keb: "上手", pri: ["ichi1"] },
          { keb: "上手い", pri: ["gai1"] },
        ],
        [
          { reb: "じょうず", restr: ["上手"] },
          { reb: "うまい", restr: ["上手い"] },
          { reb: "ジョーズ", nokanji: true },
        ],
      ),
    );
    expect(commonWords(xml)).toEqual([
      {
        pairs: [
          ["上手", "じょうず"],
          ["上手い", "うまい"],
        ],
      },
    ]);
  });

  it("prefers common readings over uncommon ones", () => {
    const xml = jmdict(
      entry(
        [{ keb: "日本", pri: ["news1"] }],
        [{ reb: "にほん", pri: ["spec1"] }, { reb: "にっぽん" }],
      ),
      entry([{ keb: "図る", pri: ["spec2"] }], [{ reb: "はかる" }]),
    );
    expect(commonWords(xml)).toEqual([
      { pairs: [["日本", "にほん"]] },
      { pairs: [["図る", "はかる"]] },
    ]);
  });
});

const KANJI: KanjiReadings[] = [
  {
    char: "明",
    on: ["メイ", "ミョウ"],
    kun: ["あ.かり", "あか.るい", "あか.るむ", "あ.ける", "あか"],
  },
  { char: "学", on: ["ガク"], kun: ["まな.ぶ"] },
  { char: "校", on: ["コウ", "キョウ"], kun: [] },
  { char: "人", on: ["ジン", "ニン"], kun: ["ひと", "-り", "-と"] },
  { char: "会", on: ["カイ", "エ"], kun: ["あ.う"] },
  { char: "社", on: ["シャ"], kun: ["やしろ"] },
  { char: "日", on: ["ニチ", "ジツ"], kun: ["ひ", "-び", "-か"] },
  { char: "本", on: ["ホン"], kun: ["もと"] },
  {
    char: "上",
    on: ["ジョウ", "ショウ"],
    kun: [
      "うえ",
      "-うえ",
      "うわ-",
      "かみ",
      "あ.げる",
      "-あ.げる",
      "あ.がる",
      "のぼ.る",
    ],
  },
  { char: "手", on: ["シュ", "ズ"], kun: ["て", "て-", "-て", "た-"] },
];
const words = (...pairs: [string, string][][]): CommonWord[] =>
  pairs.map((p) => ({ pairs: p }));
const count = (...pairs: [string, string][][]) =>
  countReadings(words(...pairs), KANJI);

describe("countReadings", () => {
  it("counts plain on + on", () => {
    const c = count([["明日", "みょうにち"]]);
    expect(c.get("明")?.on).toEqual([0, 1]);
    expect(c.get("日")?.on).toEqual([1, 0]);
  });

  it("counts a kun reading with okurigana", () => {
    const c = count([["明るい", "あかるい"]]);
    expect(c.get("明")).toEqual({ on: [0, 0], kun: [0, 1, 0, 0, 0] });
  });

  it("counts rendaku towards the plain reading", () => {
    const c = count([["会社", "かいしゃ"]], [["本社", "ほんじゃ"]]);
    expect(c.get("社")?.on).toEqual([2]);
    expect(count([["日本", "にっぽん"]]).get("本")?.on).toEqual([1]);
  });

  it("counts sokuon towards the plain on'yomi", () => {
    const c = count([["学校", "がっこう"]]);
    expect(c.get("学")?.on).toEqual([1]);
    expect(c.get("校")?.on).toEqual([1, 0]);
  });

  it("reads 々 as the previous kanji, sound changes included", () => {
    const c = count([["人々", "ひとびと"]]);
    expect(c.get("人")?.kun).toEqual([1, 0, 0]);
    expect(c.get("人")?.on).toEqual([0, 0]);
  });

  it("matches katakana in a spelling as hiragana", () => {
    const c = count([["学ブ", "まなぶ"]]);
    expect(c.get("学")?.kun).toEqual([1]);
  });

  it("skips a pair with a character that is not one of our kanji", () => {
    const c = count([["明朝", "みょうちょう"]]);
    expect(c.get("明")?.on).toEqual([0, 0]);
  });

  it("gives nothing to a kanji whose alignment is ambiguous, only to it", () => {
    const ambiguous: KanjiReadings[] = [
      { char: "甲", on: ["カ"], kun: ["かな"] },
      { char: "乙", on: ["ナイ", "イ"], kun: [] },
      { char: "丙", on: ["ヘイ"], kun: [] },
    ];
    // 甲乙丙 かないへい: 甲 か + 乙 ない, or 甲 かな + 乙 い; 丙 is clear.
    const c = countReadings(words([["甲乙丙", "かないへい"]]), ambiguous);
    expect(c.get("甲")).toEqual({ on: [0], kun: [0] });
    expect(c.get("乙")?.on).toEqual([0, 0]);
    expect(c.get("丙")?.on).toEqual([1]);
  });

  it("counts an entry once per reading, however many pairs match", () => {
    const c = count([
      ["学校", "がっこう"],
      ["学校", "がくこう"],
    ]);
    expect(c.get("学")?.on).toEqual([1]);
  });
});

describe("kun entry attribution", () => {
  it("tells あか.るい from あ.かり by the okurigana written", () => {
    const c = count([["明るい", "あかるい"]], [["明かり", "あかり"]]);
    expect(c.get("明")?.kun).toEqual([1, 1, 0, 0, 0]);
  });

  it("prefers the longest okurigana", () => {
    const k: KanjiReadings[] = [
      { char: "上", on: [], kun: ["あ.が", "あ.がる", "あ"] },
    ];
    const c = countReadings(words([["上がる", "あがる"]]), k);
    expect(c.get("上")?.kun).toEqual([0, 1, 0]);
  });

  it("lets an entry without okurigana match whatever follows", () => {
    const c = count([["手", "て"]], [["手さき", "てさき"]], [["明", "あか"]]);
    expect(c.get("手")?.kun).toEqual([2, 0, 0, 0]);
    expect(c.get("明")?.kun).toEqual([0, 0, 0, 0, 1]);
  });
});
