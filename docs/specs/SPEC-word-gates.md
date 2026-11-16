# Spec: word gates (v1.5.0)

Extends `docs/specs/done/SPEC.md` (v1) through `docs/specs/done/SPEC-reading-choice.md` (v1.4.0); `docs/specs/done/SPEC-kana-words.md` (loanwords) most directly. Everything there still holds unless this spec says otherwise. Intent: `docs/intent/word-gates.md`. Epic: `docs/ideas/useful-japanese.md` (round 1).

**Changes SPEC-kana-words Out of Scope:** multi-kanji words are now in scope. Glosses for kanji words come from JMdict (CC BY-SA, credited); loanword glosses stay hand-written.

## Objective
In Built-in mode, each kanji level brings about 30 JMdict words built from learned kanji: a kanji on its own (人 ひと), kanji plus kana (入る はいる) and compounds (今日 きょう). Each word has a meaning gate and a reading gate, and the reading gate tests the word's own reading. Which words a level gets is decided by one swappable picker in the data build, with no hand curation.

### User stories
- As the player on Kanji 1, once I've learned 一 and 人, I meet 一人 and pick ひとり, not いちにん.
- As the player, I never get a word with a kanji I haven't learned.
- As the player, runs still feel like kanji runs: at most 2 new words per run, and words never slow the level unlock.
- As the player, I can tell a word gate from a kanji gate at a glance (tint).
- As the owner, if the words feel wrong after a while, the ordering rule can be swapped in one module and the data rebuilt, with nothing to review by hand.

## Rules

### Data build: candidates (`scripts/words.ts`, pure)
- Source: JMdict (already cached for readings). A **candidate** is a JMdict entry with a common kanji spelling (same `ke_pri` set as `SPEC-reading-choice`) that passes every filter below. Its spelling is the first common `keb` that passes; its reading is the first common `reb` that applies to it (`re_restr`), else the first that applies, kept as written (アメリカ人 アメリカじん); `re_nokanji` skipped.
- **Filters** (each one a named, tested predicate; the report counts how many each removes):
  - Characters: only our Jōyō kanji (every kanji in `kanji.json`), hiragana, katakana (with `ー` and small kana) and `々`. No other kanji. The reading is all kana.
  - At least one kanji. Spelling starts with a kanji, with katakana (アメリカ人, ローマ字), or with お/ご followed by a kanji (お金, ご飯). Drops fragments like その上, と言うもの.
  - Not usually written in kana: the first sense has no `&uk;` (drops 出来る, 何方).
  - First sense's part of speech is not only a prefix, suffix or counter (`&pref;`, `&suf;`, `&ctr;`), and not tagged archaic, obsolete, rare or obscure (`&arch;`, `&obs;`, `&rare;`, `&obsc;`).
  - Fits a gate: spelling ≤ 6 characters; reading ≤ 7 kana.
  - Usable gloss: the first sense's glosses run through the existing `cleanGloss`/`pickGlosses`; empty, or a primary gloss over 20 characters → dropped (amended after W1: glosses weren't capped).
  - **Not a repeat of its kanji:** dropped when the word is one kanji alone (no kana) and its reading equals one of the kanji's main readings as taught (`on` or `kun.base`): 人 ひと, 山 やま. Kanji-plus-kana words are always kept, even when they match the kanji's kun'yomi (入る はいる, 大きい, 一つ): the whole verb or adjective is what's learned. (Amended after W1, owner 2026-11-17: the wider rule dropped 入る はいる and nearly every single.)
  - **Singles must be frequent:** a one-kanji word (kind `single`) needs an `nf` rank; drops rarities like 子 ね "the Rat". (Added after W1, owner 2026-11-17.)
  - One entry per spelling: when two candidates share a spelling, keep the better-ranked one.
- **Kind** (stored): `single` (one kanji, no kana), `okurigana` (one kanji plus hiragana), `compound` (two or more kanji, any kana; or any katakana: アメリカ人).
- **Level:** the highest `level` of its kanji (`々` adds none).
- **Frequency facts** kept on the candidate for pickers: the `nfXX` number (1–48, lower is more frequent) or null, and the priority tags.

### Data build: picker (swappable)
- Interface: `type WordPicker = (candidates: Candidate[], perLevel: number) => Candidate[]`. Returns the chosen words in teaching order (level, then rank within the level). Build-data calls exactly one picker, named in one constant (`WORD_PICKER` in `scripts/words.ts`); swapping the ordering means writing another function with this type and changing that constant.
- **Today's picker, `byFrequency`:** per level, rank candidates by `nf` (null ranks after 48; ties by number of priority tags, more first; then by spelling for determinism). Take `KANJI_WORDS_PER_LEVEL = 30` per level, aiming at a mix of about 25% `single`, 25% `okurigana`, 50% `compound`: fill each kind's share from its best-ranked candidates, then fill any shortfall from the best-ranked of the rest. Levels with fewer candidates take all of them.
- **Number cap (in `byFrequency`):** at most `MAX_NUMBER_WORDS_PER_LEVEL = 3` number words per level; a number word is made only of the numeral kanji 〇一二三四五六七八九十百千万, optionally ending in 月 (十一, 三十, 十二月). Skipped number words don't fill shortfalls. (Added after W1, owner 2026-11-17: JMdict's nf bands tie ~24 numbers and months at nf01 on level 2, crowding out 一人 and 大人.)
- Output: `src/data/words.json`, one line per word: `{ "word", "reading", "glosses", "kind", "level" }`, in teaching order. Deterministic: two builds give identical JSON.
- **Report** `.data-cache/word-report.txt`: removals per filter; per level 2–10 the chosen words (`word reading gloss kind`); the kind mix per level for all levels; total count. Build prints a one-line summary.
- Credit: README already credits JMdict; add "words and glosses" to that credit.

### Model (`src/core`)
- `WordItem` gains `reading?: string` and `kind: "loanword" | "single" | "okurigana" | "compound"`. Loanwords: `kind: "loanword"`, no reading, unchanged otherwise (hand-written glosses, kana eligibility, 5 per level).
- `src/core/words.ts` loads both lists into `WORDS` (loanwords first, then kanji words, each in its own order).
- **Kanji a word needs:** its kanji characters, `々` dropped, each once. Pure, tested.
- **Eligible:** level ≤ `unlockedLevel` and every kanji it needs has its **meaning** record at `box ≥ LEARNED_BOX` (2). Loanword rule unchanged.
- **Gate types:** loanword and kanji-word meaning gates stay type `"word"` (key `今日:word`). New type `"wordreading"` (key `今日:wordreading`) for a kanji word's reading gate: prompt the word, answer its reading in hiragana. Progress schema unchanged (`version: 1`); sync and merge work per key, untouched.
- A word's reading entry joins the pool once its meaning box is ≥ `READING_UNLOCK_BOX` (3), like kanji.

### Pool and runs (Built-in mode)
- `unlockedPool` adds eligible words after the kanji: words of the current level (`unlockedLevel`) first, then the lower levels from the lowest up; within a level, loanwords then kanji words, in list order. Each kanji word's reading entry follows its meaning entry. So new words come from the current level first and the backlog of earlier levels fills in behind (owner, 2026-11-17).
- **New words:** `MAX_NEW_WORDS_PER_RUN` 1 → **2**, still inside `MAX_NEW_PER_RUN` (4). Both `word` and `wordreading` count as words.
- Level unlock unchanged: `levelKeys` stays kana or kanji meaning only.
- **Placement:** placing up to level N marks both keys of every kanji word of levels ≤ N at box 4 (same rule as loanwords; unanswered marks above N removed on re-placement).
- **Distractors:**
  - `word` (meaning): unchanged rule (first glosses of other words of unlocked levels plus the next; never a word sharing a gloss with the prompt; pad from all words). Kanji-word and loanword glosses share one pool.
  - `wordreading`: readings of other kanji words of unlocked levels plus the next, within ±1 kana of the answer's length (wider only if short), never equal to the answer; prefer words sharing a kanji with the prompt (so 一人 meets いちにち, not random words); pad from all kanji words.
- Squad charges and wall gates may ask both types.
- Meaning mode and WaniKani mode: unchanged, no words.

### Screens
- **Labels:** a 6-character word prompt and a 7-kana reading option fit a gate at 390×844 in 2D and `?3d`, readable at `GATE_MIN_W` (0.18, about 70 px).
- **Tint:** gates of type `word` and `wordreading` (loanwords too) get one tint on the prompt text and the gate frame, the same in 2D and 3D. Kanji and kana gates look as today. One colour constant; subtle (frame and prompt only, no badge). The answer options stay as today.
- **Answer reveal:** as for other gates (the word, its reading and first gloss).
- **Summary:** missed words listed with reading and meaning.
- **Study card (`kind: "word"`, kanji words):** the word, its reading, its glosses, and a kanji breakdown (each kanji with its first gloss and taught readings). Loanword card unchanged. Studying never changes SRS.
- Start screen: unchanged (words aren't counted).

## Project Structure (changes)
```
scripts/words.ts            → candidates, filters, kinds, WordPicker, byFrequency, report rows (new)
scripts/build-data.ts       → calls scripts/words.ts, writes src/data/words.json + report
src/data/words.json         → generated kanji words (new)
src/core/types.ts           → WordItem reading/kind; GateType + "wordreading"
src/core/words.ts           → load both lists, kanjiNeeded, eligibility
src/core/pool.ts, run.ts    → word reading entries, cap 2
src/core/distractors.ts     → wordReadingRow
src/core/progression.ts     → place() covers word readings
src/core/study.ts, tuning.ts
src/game/…                  → tint, labels, reveal, summary, study card (2D and 3D)
README.md                   → JMdict credit covers words
```

## Commands
`npm run data:build`, `npm run check`, `npm run check:fast`, `npm run test:slow`.

## Testing Strategy
- **Synthetic JMdict fixtures** for `scripts/words.ts`: each filter keeps/drops the right entry; `re_restr`; kind; level; the repeat-of-its-kanji rule (人 ひと dropped, 一人 and 入る はいる kept); singles need nf; gloss cap; number cap; `byFrequency` order, mix and shortfall fill; a second picker with the same type swaps in (test-only).
- **Real data** (`tests/data/words.test.ts`): 一人 ひとり, 今日 きょう, 大人 おとな, 入る はいる, お金 おかね are present at the level of their last kanji with those readings; no 出来る, その上; every word's kanji are in `kanji.json`; label limits hold; levels 2–10 have 30 words each (or all candidates); `words.json` is deterministic.
- **Core:** pool order (current level's words before lower levels' words); eligibility (unlearned kanji blocks, learned unlocks); reading entry after meaning box 3; new-word cap 2; placement marks both keys; `wordReadingRow` length band, no answer duplicate, shared-kanji preference; summary and study card for a kanji word.
- **Balance:** `npm run test:slow` passes; bot win rate stays in its existing band with words in the pool.

## Boundaries
- Always: `npm run check` before commit; push after each task; re-run `npm run data:build` and commit regenerated `src/data/`.
- Ask first: a different per-level count; letting words count toward the unlock; any data source besides JMdict.
- Never: hand-curated word lists or override files for words (filters only); copy anything from WaniKani; commit `.data-cache` or raw EDRDG downloads; change kanji gates, level order or the save format.

## Success Criteria
- Levels 2–6 each bring about 30 words of the three kinds, with irregular readings asked as such.
- A run never asks a word with an unlearned kanji; at most 2 new words per run.
- Word gates are told apart by tint in 2D and 3D; labels readable at 390×844.
- Swapping `WORD_PICKER` to another function changes `words.json` and nothing else needs editing.
- Owner checkpoint: the words feel right on the phone.

## Open Questions
- None blocking. Possible follow-ups: kana-only conversation words (すみません); words in the start-screen progress (round 3).
