/**
 * Which readings to teach (SPEC-reading-choice): the on'yomi and kun'yomi
 * entry used by the most common JMdict words. Pure functions, called by
 * `build-data.ts`:
 *
 * - `commonWords(jmdictXml)` → one `CommonWord` per common entry, holding its
 *   (spelling, reading) pairs.
 */

/** A common JMdict entry: every (kanji spelling, reading) pair it allows. */
export type CommonWord = { pairs: [spelling: string, reading: string][] };

const COMMON = /^(news1|ichi1|spec1|spec2|gai1)$/;

const tags = (body: string, tag: string): string[] =>
  [...body.matchAll(new RegExp(`<${tag}>(.*?)</${tag}>`, "g"))].map(
    (m) => m[1] ?? "",
  );
const isCommon = (body: string, tag: string) =>
  tags(body, tag).some((p) => COMMON.test(p));

/**
 * Common entries of JMdict: those with a kanji spelling whose `ke_pri` is
 * news1/ichi1/spec1/spec2/gai1. Each common spelling pairs with the readings
 * that apply to it (`re_restr`), common ones only when any are common;
 * `re_nokanji` readings are skipped.
 */
export function commonWords(xml: string): CommonWord[] {
  const out: CommonWord[] = [];
  for (const entry of xml.split("<entry>")) {
    if (!entry.includes("<ke_pri>")) continue;
    const kebs = [...entry.matchAll(/<k_ele>([\s\S]*?)<\/k_ele>/g)]
      .map((m) => m[1] ?? "")
      .filter((k) => isCommon(k, "ke_pri"))
      .map((k) => tags(k, "keb")[0] ?? "");
    if (!kebs.length) continue;
    const rebs = [...entry.matchAll(/<r_ele>([\s\S]*?)<\/r_ele>/g)]
      .map((m) => m[1] ?? "")
      .filter((r) => !r.includes("<re_nokanji"))
      .map((r) => ({
        reb: tags(r, "reb")[0] ?? "",
        restr: tags(r, "re_restr"),
        common: isCommon(r, "re_pri"),
      }));
    const pairs: CommonWord["pairs"] = [];
    for (const keb of kebs) {
      const apply = rebs.filter(
        (r) => !r.restr.length || r.restr.includes(keb),
      );
      const common = apply.filter((r) => r.common);
      for (const r of common.length ? common : apply) pairs.push([keb, r.reb]);
    }
    if (pairs.length) out.push({ pairs });
  }
  return out;
}
