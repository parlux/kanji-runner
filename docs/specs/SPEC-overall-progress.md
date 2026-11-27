# Spec: overall progress, finish every level

Intent: `docs/intent/overall-progress.md` (2026-11-27). Tasks: `tasks/todo-overall-progress.md`. Epic round 4 of `docs/ideas/useful-japanese.md`. Extends `docs/specs/done/SPEC.md` ("Progression and levels") and `docs/specs/done/SPEC-useful-order.md` (level size, coverage); where they disagree, this spec wins. Version: **1.8.0** (a round).

## Objective
Levels you finish completely, and one place that says how far you are. Today a level unlocks at 80% of its kanji meanings at box ≥ 2, the end card never says so ("19 of 30 learned · 5 more to unlock Kanji 6"), and readings don't count at all. Success:
- A level is 15 kanji; you finish it by learning every kanji's meaning and reading; that takes about 3–4 days of play.
- The end card and start screen numbers add up with no explanation needed.
- The overall view gives a coverage number the owner can set against WaniKani in February.

## 1. Learned and unlock (core)
- **Kanji, Built-in and WaniKani modes:** a kanji is learned when `meaning` box ≥ `LEARNED_BOX` (2) **and** `reading` box ≥ `LEARNED_BOX`. A reading without a record counts as box 0. Readings still only come up once the meaning reaches `READING_UNLOCK_BOX` (3); unchanged.
- **Kana:** learned at `kana` box ≥ 2, as today.
- **Meaning mode** (no readings exist there): a kanji is learned at `meaning` box ≥ 2, as today.
- **Unlock:** the next level unlocks when **every** item of the current level is learned. `UNLOCK_SHARE` goes. `applyUnlock` still never lowers the level, so an existing save keeps its unlocked level.
- **Word gates** never count toward a level (unchanged).
- **Placement** ("I already know some…", `place`): marks both the meaning and the reading of each placed kanji at box 4 (never lowering), so placed levels count as learned. Re-picking lower works as today: the unlocked level becomes N + 1 and unanswered placement marks above N go.
- `LevelProgress` / `LevelCard` count learned kanji by this rule and also expose **`meaningOnly`**: kanji whose meaning is learned but whose reading is not yet (0 in meaning mode and for kana).

## 2. Levels of 15 (data)
- Kanji levels hold **15 kanji** (`LEVEL_SIZE` 15 in `scripts/build-data.ts` and `scripts/coverage.ts`). The order in `src/data/kanji.json` is unchanged; level = 2 + ⌊i / 15⌋. 2,136 kanji → Kanji 1–143 (levels 2–144); the last level holds 6.
- **Re-level the shipped data in place**, no full rebuild (KANJIDIC2's host is unreachable from the cloud sandbox): `kanji.json` levels as above; each word in `words.json` gets the highest new level of its kanji (what `setLevels` does). The word set and order stay; only levels change. Future builds: `KANJI_WORDS_PER_LEVEL` 15.
- **Loanwords:** `WORDS_PER_LEVEL` 5 → **3** (one per 5 kanji, close to today's one per 6).
- **Stories:** `dictionary/stories/kanji-NN.json` re-split by the new levels (143 files, `"level": "Kanji N"`), entries moved unchanged. `npm run stories:check` passes. Docs that say "30 per level" are updated (`dictionary/README.md`, comments).
- The save format does not change. An existing save's `unlockedLevel` now points at a smaller slice (old Kanji 5 = level 6 = kanji 61–75 now); the owner resets it with the picker. No migration.

## 3. Level card and start screen
- **End card:** "Kanji 9" left, "11 of 15 learned" right; the bar fills to `learned / total` with this run's gain faded, as today; **no unlock mark**. Bottom line: "+N learned this run" left; right "4 more to unlock Kanji 10", "Kanji 10 unlocks next run" or "Last level".
- When `meaningOnly` > 0, a third dim line: "3 need their reading" (singular "1 needs its reading"). The bar shows those kanji as a dim segment after the learned part, so the reader can see they are on the way.
- **Start screen level block:** same rule and copy ("11/15 learned · 4 more to unlock Kanji 10"), no unlock mark, the same dim meaning-only segment. It gains a small "Progress ›" affordance under it; tapping the block opens the overall view.

## 4. Overall view
A canvas screen (`src/game/screens/progress.ts`) opened from the start screen level block; Back (button, Esc, browser back if wired like the picker) returns to the start screen. Built-in and WaniKani modes; meaning mode shows the same view with kanji levels only and no coverage line.
- **Header:** "Kanji 9 of 143" and "135 of 2,136 kanji learned", with one long bar of learned / all kanji.
- **Travel coverage:** "You can read **34%** of the kanji in travel text" (menu, station signs, phrasebook; the mean of the three texts' kanji-token coverage, from learned kanji only). Under it, dim: "Finishing Kanji 9 adds +2%" (coverage if every kanji of the current level were learned too, minus now), so a level's worth is visible.
- **Level list:** one row per level from Hiragana to the unlocked level, then the next level dimmed: name, `learned/total`, a mini bar, and a tick when finished. A run of finished levels before the first unfinished one collapses into one row ("Hiragana – Kanji 6 ✓"). Rows past what fits scroll (drag, wheel).
- No JLPT line this round (out of scope; KANJIDIC2's JLPT field needs a full rebuild).
- **Data:** `src/data/travel.json`, generated by `npm run data:travel` (`scripts/travel.ts`, offline) from `scripts/coverage/{menu,signs,phrasebook}.txt` with `kanjiOf`: per text `{ name, total, counts: { char: n } }`. **`src/core/coverage.ts`**: `travelCoverage(known: (char) => boolean): number` (mean of per-text shares), tested against `scripts/coverage.ts`'s `measure` on the same texts.

## Commands
`npm run check` (test, typecheck, lint, knip, deps, build) before every tick; `npm run check:fast` per slice; `npm run test:slow` after task 1 (core rule). `npm run stories:check` after task 2. `npm run data:travel` regenerates `travel.json`.

## Project structure
- `src/core/progression.ts`, `src/core/srs.ts`, `src/core/pool.ts`, `src/core/tuning.ts`, `src/core/words.ts`: rule, placement, loanword pace.
- `src/core/coverage.ts` (new), `src/data/travel.json` (new), `scripts/travel.ts` (new).
- `src/data/kanji.json`, `src/data/words.json`, `dictionary/stories/*.json`: re-levelled.
- `src/game/screens/levelcard.ts`, `src/game/screens/start.ts`, `src/game/start.ts` (layout, taps), `src/game/screens/progress.ts` (new), `src/game/scenes.ts`.
- Layers per `AGENTS.md`: `core/` imports only `core/` and `data/`.

## Testing
- `progression.test.ts`: a kanji with meaning 2 / reading 1 is not learned, meaning 2 / reading 2 is; kana and meaning mode unchanged; unlock needs all 15; `applyUnlock` never lowers; `place` marks readings; `meaningOnly` counts.
- Data test: every kanji level 2–143 has 15 kanji, 144 has 6; kanji order equals the previous `kanji.json`'s; every word's level is the max of its kanji's levels; every story file's kanji are exactly its level's.
- `coverage.test.ts`: `travelCoverage` with no kanji = 0, all = 1, and equals `measure`'s mean for a sample known set.
- Screens: offscreen renders at 390×844 of the end card (with and without meaning-only kanji, unlock, last level), start block, and the overall view (fresh save, mid-way save, meaning mode).

## Boundaries
- Always: keep the kanji order; keep save format; `npm run check` green; commit and push each slice.
- Ask first: changing box thresholds, weights, `MAX_NEW_PER_RUN`, or the word set.
- Never: auto-convert or lower the owner's save; commit raw KANJIDIC2/KRADFILE downloads or `.data-cache`.

## Success criteria
- Rule and data tests above pass; `npm run check`, `test:slow` and `stories:check` pass.
- On the phone (checkpoint): the end card's numbers add up; the overall view shows level N of 143, every level's count, and a coverage %.
- The owner sets their level with the picker and plays; over the following days a level takes about 3–4 days (judged by the owner after the checkpoint).

## Out of scope
The kanji order; word gates counting toward a level; JLPT share; WaniKani mode beyond sharing the rule; sound and feel; SRS weights and timing; automatic save conversion.

## Open questions
- None blocking. The "N need their reading" line and dim segment are the spec's answer to "why doesn't 西 count?"; the owner can drop them at the checkpoint.
