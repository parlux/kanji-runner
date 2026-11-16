import { describe, expect, it } from "vitest";
import { commonWords } from "../../scripts/readings";

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
