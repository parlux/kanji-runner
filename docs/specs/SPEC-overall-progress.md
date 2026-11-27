# Spec: overall progress, finish every level

Intent: `docs/intent/overall-progress.md` (revised 2026-11-28). Tasks: `tasks/todo-overall-progress.md`. Epic round 4 of `docs/ideas/useful-japanese.md`. Extends `docs/specs/done/SPEC.md` ("Progression and levels"), `docs/specs/done/SPEC-useful-order.md` (level size, coverage) and `docs/specs/done/SPEC-word-gates.md` ("words never slow the unlock" no longer holds); where they disagree, this spec wins. Version: **1.8.0** (a round).

## Objective
Levels of 15 new things you finish completely, grouped into stages, and one place that says how far you are. Today a level unlocks at a hidden 80% of its kanji meanings at box ≥ 2; readings and words don't count, and the end card never says why ("19 of 30 learned · 5 more to unlock Kanji 6"). Success:
- A level is 15 new things (kanji, words, a loanword); you finish it when every one is learned (meaning and reading right three times running); that takes a few days of play (checked at the checkpoint).
- The end card and start screen numbers add up with no explanation needed.
- The overall view gives a coverage number the owner can set against WaniKani in February.

## 1. Stages and learned (core)
- **Box names** (`src/core/srs.ts`, `stageName(box)`), one per box; each says how many right answers running, never a time promise. Draft, final wording at spec approval:

  | Box | Name | Means |
  |---|---|---|
  | 0 | New | never right yet, or just missed |
  | 1 | Met | right once |
  | 2 | Recalled | right twice running |
  | 3 | Learned | right three times running |
  | 4 | Strong | four running |
  | 5 | Solid | top box, asked least |

- `LEARNED_BOX` becomes **3** (equal to `READING_UNLOCK_BOX`). The Leitner update is unchanged: right +1, wrong → 0.
- **Learned item** (live: whatever the boxes say now):
  - Kanji (Built-in and WaniKani modes): `meaning` and `reading` both ≥ `LEARNED_BOX`. A reading without a record is box 0.
  - Kanji word (`single`, `okurigana`, `compound`): `word` and `wordreading` both ≥ `LEARNED_BOX`.
  - Kana, loanword: its one gate ≥ `LEARNED_BOX`.
  - Meaning mode (no readings, no words): `meaning` ≥ `LEARNED_BOX`.
- **A level's items** (`levelItems` / `levelKeys`): kana levels → their kana; kanji levels → their kanji **and every word whose `level` is that level** (kanji words and loanwords). Meaning mode: kanji only.
- **Unlock:** the next level unlocks when **every** item of the current level is learned at once. `UNLOCK_SHARE` goes. `applyUnlock` never lowers the level, so slips in passed levels never re-lock anything.
- **Word eligibility** (`isWordEligible`): a kanji word may be asked once its level is unlocked and every kanji it needs is a learned item (meaning and reading ≥ 3). Loanwords: every kana at ≥ 3. A word's reading gate still opens at its meaning box ≥ `READING_UNLOCK_BOX`.
- **Placement** (`place`): marks every gate of every item of the placed levels at box 4 (never lowering): kana, kanji meaning and reading, word and word reading. Re-picking lower works as today.
- **`LevelProgress` / `LevelCard`** count learned items by this rule and also expose: `kanji` and `words` (each `{ learned, total }`) and **`readingToGo`**: kanji and kanji words whose meaning is at ≥ 3 but whose reading is not yet (0 in meaning mode and on kana levels).
- **Groups** (`src/core/progression.ts`): kana levels form group 0, "Kana". Kanji levels form groups of `GROUP_SIZE` 25 levels: group g holds Kanji 25(g−1)+1 … 25g; the last group holds what is left (Kanji 276–296). `groupOf(level)` and `groupName(g)`. Draft names (reviewed by the owner at spec approval; changeable later in one list):

  | Group | Kanji levels | Draft name |
  |---|---|---|
  | 0 | Hiragana, Katakana | Kana |
  | 1 | 1–25 | Foundations |
  | 2 | 26–50 | Everyday |
  | 3 | 51–75 | Getting around |
  | 4 | 76–100 | Out and about |
  | 5 | 101–125 | Signs and notices |
  | 6 | 126–150 | Daily life |
  | 7 | 151–175 | Reading the news |
  | 8 | 176–200 | Wider reading |
  | 9 | 201–225 | Advanced |
  | 10 | 226–250 | Fluent reading |
  | 11 | 251–275 | Nearly all |
  | 12 | 276–296 | Every Jōyō kanji |

## 2. Levels of 15 new things (data)
- **A level is 15 items**, not a fixed number of kanji. Teaching order is one line: each kanji in `kanji.json` order, followed by the words whose last-taught kanji it is (in their current `words.json` order). Kanji levels take items from that line in turn: levels 2–232 take **14** plus one loanword (loanword i → level 2 + i, `WORDS_PER_LEVEL` 1; 231 loanwords); later levels take 15. The last level takes what is left.
- Result on today's data: **Kanji 1–296** (levels 2–297), 5–15 kanji per level (median 7), last level 9 items. A word is never in a level before its kanji's (same level or later). Kanji order is unchanged.
- **One pure slicer**, `scripts/levels.ts` (`sliceLevels(kanji, words, loanwordCount)` → each kanji's and word's level), tested, used by `build-data.ts` after the word picker and by a one-off re-level of the shipped data. Picking words is unchanged (the picker still works in 30-kanji blocks, `KANJI_WORDS_PER_LEVEL` 30); only the levels come from the slicer.
- **Re-level the shipped data in place**, no full rebuild (KANJIDIC2's host is unreachable from the cloud sandbox): `kanji.json` and `words.json` get their levels from the slicer; `words.json` is written in line order. The word set stays.
- `scripts/coverage.ts` reads kanji levels from `kanji.json` instead of `LEVEL_SIZE`.
- **Stories:** `dictionary/stories/` re-split by the new kanji levels into 296 files (`"level": "Kanji N"`), entries moved unchanged; file names zero-padded to three digits (`kanji-001.json`) with the story scripts updated to match. `npm run stories:check` passes. Docs and comments that say "30 per level" are updated (`dictionary/README.md`, comments).
- The save format does not change. An existing save's `unlockedLevel` now points at a much smaller slice; the owner resets it with the picker. No migration.

## 3. Level card, start screen, study card
- **End card:** "Kanji 9" left, "11 of 15 learned" right; the bar fills to `learned / total` with this run's gain faded, as today; **no unlock mark**. Bottom line: "+N learned this run" left; right "4 more to unlock Kanji 10", "Kanji 10 unlocks next run" or "Last level".
- A third dim line: "Kanji 5/7 · words 6/8" on kanji levels; when `readingToGo` > 0, append " · 3 need their reading" (singular "1 needs its reading"). The bar shows those items as a dim segment after the learned part.
- **Start screen level block:** group name above the level ("Foundations · Kanji 9"), the same count and copy ("11/15 learned · 4 more to unlock Kanji 10"), no unlock mark, the same dim segment. A small "Progress ›" under it; tapping the block opens the overall view.
- **Study card:** each kanji or word shows its stages, dim, under the answer: "Meaning: Recalled · Reading: New" (one stage for kana and loanwords).
- "Learned" in all copy means the rule in §1.

## 4. Overall view
A canvas screen (`src/game/screens/progress.ts`) opened from the start screen level block; Back (button, Esc, browser back if wired like the picker) returns to the start screen. Built-in and WaniKani modes; meaning mode shows the same view with kanji levels only and no coverage line.
- **Header:** "Kanji 9 of 296 · Foundations" and "71 of 2,136 kanji learned", with one long bar of learned / all kanji.
- **Travel coverage:** "You can read **34%** of the kanji in travel text" (menu, station signs, phrasebook; the mean of the three texts' kanji-token coverage, from learned kanji only). Under it, dim: "Finishing Kanji 9 adds +1%" (coverage if every kanji of the current level were learned too, minus now).
- **Group list:** one row per group up to the current one, then the next group dimmed. A past group is one row: name, levels ("Kanji 1–25"), `finished/levels`, a mini bar, a tick when every level in it is finished now. The **current group is open**: one row per level from its first to the unlocked level, then the next level dimmed: name, `learned/total`, a mini bar, a tick when finished. Rows past what fits scroll (drag, wheel).
- No JLPT line this round.
- **Data:** `src/data/travel.json`, generated by `npm run data:travel` (`scripts/travel.ts`, offline) from `scripts/coverage/{menu,signs,phrasebook}.txt` with `kanjiOf`: per text `{ name, total, counts: { char: n } }`. **`src/core/coverage.ts`**: `travelCoverage(known: (char) => boolean): number` (mean of per-text shares), tested against `scripts/coverage.ts`'s `measure` on the same texts.

## Commands
`npm run check` (test, typecheck, lint, knip, deps, build) before every tick; `npm run check:fast` per slice; `npm run test:slow` after tasks 1 and 2. `npm run stories:check` after task 2. `npm run data:travel` regenerates `travel.json`.

## Project structure
- `src/core/srs.ts`, `src/core/progression.ts`, `src/core/words.ts`, `src/core/pool.ts`, `src/core/tuning.ts`: stages, rule, groups, word eligibility, placement, loanword pace.
- `src/core/coverage.ts` (new), `src/data/travel.json` (new), `scripts/travel.ts` (new).
- `scripts/levels.ts` (new); `src/data/kanji.json`, `src/data/words.json`, `dictionary/stories/*.json`, `scripts/stories/*`: re-levelled.
- `src/game/screens/levelcard.ts`, `src/game/screens/start.ts`, `src/game/start.ts`, `src/game/ui/study.ts`, `src/game/screens/progress.ts` (new), `src/game/scenes.ts`.
- Layers per `AGENTS.md`: `core/` imports only `core/` and `data/`.

## Testing
- `srs.test.ts`: `stageName` for 0–5.
- `progression.test.ts`: kanji meaning 3 / reading 2 is not learned, 3/3 is; a word likewise; a slip (reading → 0) un-learns it; a level's items include its words; unlock needs every kanji and word; `applyUnlock` never lowers; kana and meaning mode at box 3; `place` marks readings and words; `readingToGo`, `kanji`/`words` counts; `groupOf`/`groupName` at the edges (Katakana, Kanji 1, 25, 26, 296).
- `words.test.ts`: a word is not eligible while one of its kanji's readings is below 3.
- `levels.test.ts` and a data test: every level 2–296 has 15 items counting its loanword, the last at most 15; loanwords on levels 2–232, one each; kanji order equals the previous `kanji.json`'s; no word's level is below any of its kanji's; the word set is unchanged; every story file's kanji are exactly its level's.
- `coverage.test.ts`: `travelCoverage` with no kanji = 0, all = 1, and equals `measure`'s mean for a sample known set.
- Screens: offscreen renders at 390×844 of the end card (gain, unlock, last level, with/without reading-to-go), start block, study card stages, and the overall view (fresh save, mid-way save with a slipped item in a passed level, meaning mode).

## Boundaries
- Always: keep the kanji order; keep save format; `npm run check` green; commit and push each slice.
- Ask first: changing box thresholds beyond §1, weights, `MAX_NEW_PER_RUN`, `MAX_NEW_WORDS_PER_RUN`, or the word set.
- Never: auto-convert or lower the owner's save; commit raw KANJIDIC2/KRADFILE downloads or `.data-cache`.

## Success criteria
- Rule and data tests above pass; `npm run check`, `test:slow` and `stories:check` pass.
- On the phone (checkpoint): the end card's numbers add up; the overall view shows Kanji N of 296, the groups, the current group's levels and a coverage %.
- The owner sets their level with the picker and plays; over the following days a level takes a few days (judged by the owner after the checkpoint).

## Out of scope
Coverage-based groups; JLPT share; time-based review; sticky learned; automatic save conversion; WaniKani mode beyond sharing the kanji rule; the kanji order; sound and feel; SRS weights and timing.

## Open questions
- **Word tail (not blocking):** words only appear once their kanji are learned, and a word needs at least ~6 runs (3 meaning, then 3 reading) with at most 2 new words per run. So each level ends with a few runs of mostly its last words. Judge at the checkpoint; the levers are `MAX_NEW_WORDS_PER_RUN` or letting words in at kanji meaning ≥ 3.
- Stage and group names are drafts; the owner edits them on the spec page.
