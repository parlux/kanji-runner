# Spec: useful-words order (v1.6.0)

Extends `docs/specs/done/SPEC.md` (v1) through `docs/specs/done/SPEC-word-gates.md` (v1.5.0). Everything there still holds unless this spec says otherwise. Intent: `docs/intent/useful-words-order.md`. Epic: `docs/ideas/useful-japanese.md` (round 2).

**Changes SPEC-word-gates Boundaries:** the level order now changes ("Never: change … level order"), and two open data sources join JMdict and TUBELEX (Tatoeba sentences for easy-text frequency; Aozora Bunko children's stories, for the coverage check only). The save schema goes to version 2, for the progress carry-over only.

## Objective
Built-in kanji levels are ordered by usefulness for a trip to Japan, not by school grade. The build picks the kanji order word by word: the next kanji to teach are the ones that unlock the most useful words for the fewest, simplest new kanji. A kanji's building blocks still come first. Each level still holds 30 kanji and about 30 words, and the words a level teaches are its most useful ones. A coverage report proves the new order beats today's: you can read more of a menu, station signs and a phrasebook at the same level.

### User stories
- As the owner in Japan at Kanji 5, I can read 駅, 円, 出口, 入口, 東口, 何, 時, 分 and 水, because travel words come first.
- As the player, levels 1–3 teach no near-useless character (干, 乙, 弓, 矛) unless it is a building block of a kanji in a useful word.
- As the player, a level's kanji form words together, and old kanji come back in new words.
- As the owner, my learned kanji stay learned after the update, and I'm placed at the first level I haven't mostly learned. No wipe, nothing to redo.
- As the owner, I get one coverage table: what share of each sample text I can read at Kanji 5, 10 and 20, for the new order, today's order and WaniKani.

## Rules

### Sample texts and coverage (`scripts/coverage.ts`, dev-only)
- **Travel texts** (`scripts/coverage/*.txt`, committed, written by us; not copied from any source):
  - `menu.txt`: 60+ menu lines as a shop, izakaya, ramen bar or konbini writes them (prices, 税込, 定食, 大盛り).
  - `signs.txt`: 80+ station, street, shop and hotel signs (改札口, 乗り場, 営業中, 非常口, 禁煙, 出口).
  - `phrasebook.txt`: 100+ polite travel and small-talk phrases in normal kanji spelling.
  - They are written **before and apart from** the theme lists (Task U1 comes before U2, and the U2 prompt forbids reading them), so the order isn't tuned to its own test.
- **Easy reader:** 3–5 public-domain children's stories from Aozora Bunko (e.g. 新美南吉 ごんぎつね, 宮沢賢治 注文の多い料理店), downloaded into `.data-cache/` like the other sources and never committed. Ruby (《…》) and markup are stripped.
- **Measures, per text and level:**
  - **Kanji coverage:** the share of the text's kanji characters (tokens, not distinct) whose kanji is in levels ≤ N.
  - **Readable lines:** the share of lines whose every kanji is known by level N.
- **Orders compared:** the new order (`src/data/kanji.json`), today's order (computed by the frozen `byGrade` order function kept in the build), and optionally WaniKani: `--wk <file>` takes a JSON of the owner's WaniKani kanji per level. That file and every number from it stay in the scratchpad, never committed (`docs/intent/kanji-runner.md`).
- **Levels reported:** Kanji 1, 3, 5, 10, 20 (30, 90, 150, 300, 600 kanji). WaniKani is compared at the same kanji count (its levels cumulated until they reach the count).
- Output: a table on stdout and `.data-cache/coverage-report.txt`. Command `npm run data:coverage`. Deterministic.

### Usefulness of a word (`scripts/useful.ts`, pure)
- **Themes** (`scripts/themes.json`, committed, written by us): about 10 situations, each a list of words as JMdict spells them. The situations are eating and drinking, trains and stations, shopping and money, hotel, directions and places, numbers/time/dates, people and family, small talk and feelings, health and emergencies, and signs and notices. That's 40–80 words each, the words a traveller needs most, in normal kanji spelling. A theme word that isn't a JMdict candidate is reported, never an error. This is the one hand-written list the round allows. Words are picked by situation; the owner doesn't review it.
- **Spoken:** TUBELEX rank via the existing `usageRanks` (word-gates rules: spellings, katakana reading, お/ご stem, nf-median for unlisted words).
- **Easy text:** frequency in Tatoeba's Japanese sentences (CC BY 2.0 FR), cached like the others. A word's count is the number of sentences containing its spelling (or another of its kanji spellings) as a substring. Counts are computed once per build.
- **Score:** `value = W_THEME·theme + W_SPOKEN·spoken + W_EASY·easy`.
  - `theme` is 1 if the word is in any theme, else 0.
  - `spoken` and `easy` are log-scaled ranks in [0, 1]: `1 − log(rank)/log(listSize)`, or 0 if the word is unlisted.
  - Starting weights: `W_THEME = 3`, `W_SPOKEN = 1`, `W_EASY = 0.5`. These are named constants, tuned in U4 against the coverage report.

### Kanji order (`scripts/order.ts`, pure; replaces `orderKanji`'s grade sort)
- **Cost of a kanji:** `1 + strokes / 10`, so a 14-stroke 駅 costs 2.4 and 一 costs 1.1.
- **Cost of a word:** the sum, over the kanji it needs that aren't placed yet, of their cost, **plus the cost of their unplaced building blocks** (KRADFILE elements that are themselves Jōyō kanji, recursively, as the component pass does today).
- **Greedy order:**
  1. Repeatedly take the candidate word with the highest `value / cost` among words with cost > 0. Ties go by value, then spelling.
  2. Append its unplaced kanji to the order, building blocks first (by the old order's rank).
  3. Words whose kanji are now all placed cost nothing and drop out of the race.
  4. When no candidate with value > 0 remains, the leftover kanji follow in today's order (grade, then frequency, with the component pass).
- `scripts/order-overrides.json` still applies afterwards (empty today).
- Levels stay 30 kanji each from level 2 (`LEVEL_SIZE`).
- Candidates are built once, before levels exist. A word's `level` is the highest level of its kanji in the new order, and is set after ordering.
- **"Why here" report:** `.data-cache/order-report.txt` lists, per level 2–21, each kanji and why it came: the word that pulled it in (with that word's value), "building block of X", or "leftover". The build prints a one-line summary: how many kanji came from theme words, from other words, and as leftovers.
- Old order function kept as `byGrade` for the coverage comparison and tests.
- Performance: the full data build takes no more than 60 s longer than today.

### Words per level
- New `WordPicker` `byUsefulness`, which becomes `WORD_PICKER`. It ranks candidates within a level by `value` (ties by today's `byUsage` comparison). It keeps the 30 per level, the kind mix (about 25/25/50) and the number cap of 3. `byUsage` and `byFrequency` stay.
- Loanwords (`loanwords.json`, hand-written levels): unchanged.

### Progress carry-over (`src/storage`)
- **Schema version 2.** Migration `MIGRATIONS[1]` keeps every item record unchanged (keys are per character, so learned kanji stay learned wherever they land). It recomputes `unlockedLevel` as `applyUnlock` from level 0 over the new levels: the player lands on the first level with less than 80% learned. Placement marks (box 4) count as learned, as today.
- The same migration runs for the Meaning mode store, whose levels start at Kanji 1.
- Sync: remote saves go through `migrate` like local ones, so both sides are at v2 before `merge` takes the max `unlockedLevel`. Merge and sync logic are otherwise unchanged. The `version` literal becomes 2 everywhere.
- Unlearned kanji left in lower levels after the move fill in through normal runs (the pool already draws new items from all unlocked levels).
- Placement ("I already know up to level N") and WaniKani mode are unchanged. WaniKani mode keeps its own order.

### Unchanged
Taught readings and glosses per kanji, stories (built from components, which still come first), gates, runs, balance tuning, screens.

## Project Structure (changes)
```
scripts/coverage/*.txt     → travel sample texts (new, committed)
scripts/coverage.ts        → coverage report, npm run data:coverage (new)
scripts/themes.json        → hand-written situation word lists (new)
scripts/useful.ts          → word value: theme, spoken, easy (new)
scripts/order.ts           → greedy kanji order, byGrade, order report (new; orderKanji moves here)
scripts/words.ts           → byUsefulness picker; candidates without levels, level set after ordering
scripts/build-data.ts      → Tatoeba + Aozora sources; wiring
src/data/*.json            → regenerated (kanji.json, words.json, confusables.json)
src/storage/storage.ts     → schema 2 + migration; src/core/types.ts, merge.ts, srs.ts version literal
README.md                  → Tatoeba and Aozora credits
```

## Commands
`npm run data:build`, `npm run data:coverage [-- --wk <file>]`, `npm run check`, `npm run check:fast`, `npm run test:slow`.

## Testing Strategy
- **Synthetic (`tests/data/order.test.ts`, `useful.test.ts`):**
  - The value formula, with theme, spoken and easy each alone.
  - Word cost includes unplaced building blocks, recursively.
  - The greedy picks the best value/cost, places building blocks first, drops free words, and is deterministic on ties.
  - The leftover tail follows `byGrade`.
  - Overrides still apply.
  - `byUsefulness` keeps the mix and the number cap.
- **Coverage (`tests/data/coverage.test.ts`):** kanji coverage and readable lines on tiny fixtures; ruby stripping; WaniKani cumulation by kanji count.
- **Real data (`tests/data/kanji.test.ts`, `words.test.ts`, updated):**
  - Every kanji's building blocks come before it.
  - Every Jōyō kanji appears exactly once.
  - Levels have 30 kanji.
  - 駅, 円, 出, 入, 口, 何, 時 are in Kanji 1–5.
  - None of 干, 乙, 弓, 矛 is in Kanji 1–3 unless the order report shows it as a building block.
  - Words sit at their last kanji's level.
  - Two builds give identical JSON.
- **Storage (`tests/storage`):**
  - v1 → v2 keeps every item.
  - Old-order progress lands on the first level under 80%, never one that is mostly learned.
  - The Meaning store migrates the same way.
  - A v1 remote merged with a v2 local works.
  - Fresh progress is v2 at level 0.
- **Balance:** `npm run test:slow` passes; the bot band is unchanged (gates draw from new levels but the run rules are the same).

## Boundaries
- Always: `npm run check` before commit; push after each task; re-run `npm run data:build` and commit the regenerated `src/data/`; log the coverage table in the task list after every order change.
- Ask first: a level size other than 30; data sources beyond the ones named here; any per-kanji or per-word override list (themes are the only hand list).
- Never: copy from WaniKani or commit WaniKani-derived numbers; commit `.data-cache`, raw EDRDG, Tatoeba or Aozora downloads; let theme writers read the coverage texts; change gates, run rules or Meaning/WaniKani mode logic.

## Success Criteria
Pass bands are checked in U4. If U1's baseline shows a band can't be met, or is met trivially, the orchestrator logs it and proposes a new band on the checkpoint page.
- **Travel texts:** at Kanji 5 and Kanji 10, the new order's kanji coverage on menu, signs and phrasebook is at least **15 points** above today's order on average.
- **Easy reader:** at Kanji 10, coverage is no more than **5 points** below today's order (the order mustn't sacrifice general reading).
- **Against WaniKani** (scratchpad only, at equal kanji count): travel-text coverage at or above WaniKani's at Kanji 5 and 10.
- No kanji of Kanji 1–3 is a leftover. Every one comes from a word or is a building block of one.
- The owner's real progress carries over: no learned item lost, and placement lands on a level under 80%.
- Owner checkpoint: levels 1–4's kanji and words look useful at a skim; the start screen shows a sensible level.

## Open Questions
- **WaniKani column:** approved by the owner (2026-11-17). The orchestrator builds the kanji-per-level file once from the owner's `WANIKANI_TOKEN` in `.env.local` (read-only) into the scratchpad; subagents never read the token. The report works without it.
- If the greedy pulls rare building blocks early (寸 for 時, 尺 for 駅), that's the agreed cost of keeping stories working. The order report makes it visible.
