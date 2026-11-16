/**
 * Which readings to teach (SPEC-reading-choice): the on'yomi and kun'yomi
 * entry used by the most common JMdict words. Pure functions, called by
 * `build-data.ts`:
 *
 * - `commonWords(jmdictXml)` → one `CommonWord` per common entry, holding its
 *   (spelling, reading) pairs.
 * - `countReadings(words, kanji)` → per kanji char, how many common entries
 *   use each of its KANJIDIC2 on'yomi and kun entries (`ReadingCounts`,
 *   parallel to `on` and `kun`).
 * - `pickReadings(kanji, counts, override?)` → `{ on, kun }`: the raw
 *   KANJIDIC2 on'yomi and kun entry to teach (null when it has none).
 * - `reportRow(kanji, level, counts, override?)` → a report line when the
 *   pick differs from the first-listed readings, else null.
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

/** A kanji's KANJIDIC2 readings, raw: on `メイ`, kun `あか.るい`, `-あ.げる-`. */
export type KanjiReadings = { char: string; on: string[]; kun: string[] };

/** Common-entry counts, parallel to `KanjiReadings.on` and `.kun`. */
export type ReadingCounts = { on: number[]; kun: number[] };

/** Katakana to hiragana; other characters pass through. */
const hira = (s: string) =>
  s.replace(/[\u30a1-\u30f6]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
const strip = (r: string) => hira(r.replace(/^-|-$/g, ""));
const isKana = (c: string) => /^[\u3041-\u3096\u30a1-\u30fa\u30fc]$/.test(c);

const VOICED: Record<string, string[]> = {};
for (const [plain, voiced] of [
  ["かきくけこさしすせそたちつてと", "がぎぐげござじずぜぞだぢづでど"],
  ["はひふへほ", "ばびぶべぼ"],
  ["はひふへほ", "ぱぴぷぺぽ"],
] as const)
  [...plain].forEach((c, i) => (VOICED[c] ??= []).push(voiced[i] ?? ""));

/** One way a kanji can be read: its id (`on:めい`, `kun:あか`) and surface forms. */
type Option = {
  id: string;
  /** Forms anywhere in a word: the reading, and its sokuon form. */
  forms: string[];
  /** Rendaku forms, not allowed word-initially. */
  voiced: string[];
};

type Indexed = {
  options: Option[];
  on: string[];
  kun: { base: string; okurigana: string }[];
};

/**
 * Options for a kanji. A sound-changed form that is itself one of the kanji's
 * readings is left out, so the plain reading isn't made ambiguous.
 */
function index(k: KanjiReadings): Indexed {
  const on = k.on.map(strip);
  const kun = k.kun.map((r) => {
    const [base = "", okurigana = ""] = strip(r).split(".");
    return { base, okurigana };
  });
  const plain = new Set([...on, ...kun.map((r) => r.base)]);
  const option = (kind: string, r: string): Option => {
    const sokuon =
      kind === "on" && /[くつちき]$/.test(r) && r.length > 1
        ? [r.slice(0, -1) + "っ"]
        : [];
    const voiced = (VOICED[r[0] ?? ""] ?? []).map((v) => v + r.slice(1));
    const extra = (xs: string[]) => xs.filter((x) => !plain.has(x));
    return {
      id: `${kind}:${r}`,
      forms: [r, ...extra(sokuon)],
      voiced: extra([
        ...voiced,
        ...voiced.flatMap((v) =>
          sokuon.length ? [v.slice(0, -1) + "っ"] : [],
        ),
      ]),
    };
  };
  const ids = new Map<string, Option>();
  for (const r of on) ids.set(`on:${r}`, option("on", r));
  for (const r of kun) ids.set(`kun:${r.base}`, option("kun", r.base));
  return { options: [...ids.values()], on, kun };
}

/** Cap on alignments per pair; real words have a handful. */
const MAX_ALIGNMENTS = 64;

/**
 * Every way `chars` (kanji, kana, 々) reads as `reading`: per alignment, the
 * option id each position used ("" for kana).
 */
function alignments(
  chars: string[],
  reading: string,
  idx: Map<string, Indexed>,
): string[][] {
  const out: string[][] = [];
  const path: string[] = [];
  const walk = (i: number, j: number): void => {
    if (out.length >= MAX_ALIGNMENTS) return;
    if (i === chars.length) {
      if (j === reading.length) out.push([...path]);
      return;
    }
    const c = chars[i] ?? "";
    if (isKana(c)) {
      if (reading[j] !== c) return;
      path.push("");
      walk(i + 1, j + 1);
      path.pop();
      return;
    }
    const k = idx.get(c === "々" ? (chars[i - 1] ?? "") : c);
    for (const o of k?.options ?? []) {
      const forms = i === 0 ? o.forms : [...o.forms, ...o.voiced];
      for (const f of forms) {
        if (!reading.startsWith(f, j)) continue;
        path.push(o.id);
        walk(i + 1, j + f.length);
        path.pop();
      }
    }
  };
  walk(0, 0);
  return out;
}

/**
 * Readings one pair gives its kanji, as `<char>|on|<i>` / `<char>|kun|<i>`:
 * a position counts only when every alignment agrees on its reading. A kun
 * match goes to the entry with that base whose okurigana the spelling writes
 * next, the longest such; an entry without okurigana matches anything.
 */
function pairCredits(
  spelling: string,
  reading: string,
  idx: Map<string, Indexed>,
): string[] {
  const chars = [...hira(spelling)];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i] ?? "";
    if (
      c === "々"
        ? i === 0 || isKana(chars[i - 1] ?? "")
        : !isKana(c) && !idx.has(c)
    )
      return [];
  }
  const all = alignments(chars, hira(reading), idx);
  if (!all.length) return [];
  const credits: string[] = [];
  chars.forEach((c, i) => {
    const id = all[0]?.[i] ?? "";
    if (!id || all.some((a) => a[i] !== id)) return;
    const char = c === "々" ? (chars[i - 1] ?? "") : c;
    const k = idx.get(char);
    if (!k) return;
    const [kind, r] = id.split(":") as [string, string];
    if (kind === "on") {
      credits.push(`${char}|on|${k.on.indexOf(r)}`);
      return;
    }
    let next = i + 1;
    while (next < chars.length && isKana(chars[next] ?? "")) next++;
    const after = chars.slice(i + 1, next).join("");
    let best = -1;
    k.kun.forEach((e, n) => {
      if (e.base !== r || !after.startsWith(e.okurigana)) return;
      const len = k.kun[best]?.okurigana.length ?? -1;
      if (e.okurigana.length > len) best = n;
    });
    if (best >= 0) credits.push(`${char}|kun|${best}`);
  });
  return credits;
}

/**
 * For each kanji, how many common entries use each on'yomi and kun entry.
 * An entry counts at most once per reading, however many pairs match.
 */
export function countReadings(
  words: CommonWord[],
  kanji: KanjiReadings[],
): Map<string, ReadingCounts> {
  const idx = new Map(kanji.map((k) => [k.char, index(k)]));
  const counts = new Map(
    kanji.map((k) => [
      k.char,
      { on: k.on.map(() => 0), kun: k.kun.map(() => 0) },
    ]),
  );
  for (const w of words) {
    const credits = new Set(
      w.pairs.flatMap(([s, r]) => pairCredits(s, r, idx)),
    );
    for (const key of credits) {
      const [char = "", kind, n] = key.split("|");
      const c = counts.get(char);
      const list = kind === "on" ? c?.on : c?.kun;
      if (list) list[Number(n)] = (list[Number(n)] ?? 0) + 1;
    }
  }
  return counts;
}

/** An entry of `reading-overrides.json`. */
export type Override = { on?: string; kun?: string; why: string };

/** Index of the reading with the most counts; ties and all-zero → first. */
function most(counts: number[]): number {
  let best = 0;
  counts.forEach((n, i) => {
    if (n > (counts[best] ?? 0)) best = i;
  });
  return best;
}

/** Index of `want` in `list`, exactly or ignoring dashes and kana script. */
function find(k: KanjiReadings, list: string[], want: string): number {
  const exact = list.indexOf(want);
  const i =
    exact >= 0 ? exact : list.findIndex((r) => strip(r) === strip(want));
  if (i < 0) throw new Error(`reading override ${k.char}: no reading ${want}`);
  return i;
}

/**
 * The readings to teach: the on'yomi and kun entry with the most common
 * entries (ties and all-zero → KANJIDIC2 order). An override wins; one naming
 * a reading the kanji doesn't have throws.
 */
export function pickReadings(
  k: KanjiReadings,
  counts: ReadingCounts | undefined,
  override?: Override,
): { on: string | null; kun: string | null } {
  const on = override?.on ? find(k, k.on, override.on) : most(counts?.on ?? []);
  const kun = override?.kun
    ? find(k, k.kun, override.kun)
    : most(counts?.kun ?? []);
  return { on: k.on[on] ?? null, kun: k.kun[kun] ?? null };
}

/** `old → new (top three candidates with counts)` for one reading kind. */
function change(
  kind: string,
  list: string[],
  counts: number[],
  picked: string | null,
): string {
  const old = list[0] ?? null;
  if (picked === old) return "";
  const top = list
    .map((r, i) => ({ r, n: counts[i] ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map((c) => `${c.r} ${c.n}`);
  return `${kind} ${old} → ${picked} (${top.join(", ")})`;
}

/**
 * One report line for a kanji whose taught on or kun changed from the first
 * listed: kanji, level, old → new with the top three candidates, and the
 * override reason if any. Null when nothing changed.
 */
export function reportRow(
  k: KanjiReadings,
  level: number,
  counts: ReadingCounts | undefined,
  override?: Override,
): string | null {
  const pick = pickReadings(k, counts, override);
  const parts = [
    change("on", k.on, counts?.on ?? [], pick.on),
    change("kun", k.kun, counts?.kun ?? [], pick.kun),
  ].filter(Boolean);
  if (!parts.length) return null;
  const why = override ? `  [override: ${override.why}]` : "";
  return `${k.char} L${level}  ${parts.join("; ")}${why}`;
}
