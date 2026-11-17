# Tasks: useful-words order (v1.6.0)

Spec: `docs/specs/SPEC-useful-order.md` (2026-11-17). Intent: `docs/intent/useful-words-order.md`. Epic: `docs/ideas/useful-japanese.md` (round 2). Started 2026-11-17.
Review: https://claude.ai/artifact/TZ4TSiMPUqozQZkecva4yF
Every task: `npm run check` passes before it is checked off. Never commit `.data-cache`, raw EDRDG, Tatoeba or Aozora downloads, or anything derived from WaniKani.

## Plan
- **Measure first.** U1 builds the coverage report and logs today's order as the baseline before anything changes, so every later number has something to beat.
- **Independent test texts.** U1 writes the travel texts; U2 writes the themes without reading them. Otherwise the order is tuned to its own exam.
- **Order, then tune.** U3 builds the greedy order with the starting weights and logs the first coverage; U4 tunes the weights against the pass bands. U5 carries progress over; U6 ships.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Order tuned to its own test (we write both themes and texts) | High | Separate tasks, U2 forbidden from reading `scripts/coverage/`; the Aozora reader is an outside check. |
| Greedy pulls rare building blocks early (寸 for 時) | Med | Agreed cost of keeping stories; order report shows "building block of X"; cost counts them, so expensive chains wait. |
| Old progress lands badly (too low, or loses items) | High | Migration keeps every item; tests with an old-order fixture; owner checks the start screen. |
| Long tail of useless kanji early because a theme word needs them | Med | Value/cost ratio, complexity-weighted cost; Kanji 1–3 "no leftovers" test. |
| Build gets slow (greedy over ~15k words × 2,136 kanji) | Low | Incremental cost updates; spec cap +60 s. |

### Task U1: Coverage report and travel texts, baseline (highest risk: opus)
**Description:** Write `scripts/coverage/menu.txt`, `signs.txt`, `phrasebook.txt` per the spec: natural Japanese as written in Japan, our own text. Add 3–5 Aozora Bunko children's stories as a cached source (pinned URLs, ruby stripped). Write `scripts/coverage.ts` (`npm run data:coverage`, optional `--wk <file>`), with `byGrade` as today's order (move `orderKanji` into `scripts/order.ts` unchanged, named `byGrade`). The data output is unchanged. Log the baseline table (today's order, Kanji 1/3/5/10/20, both measures, per text) under "Numbers", and say whether the spec's pass bands look reachable.
**Acceptance:**
- [x] Texts meet the spec's sizes; stories cached, not committed.
- [x] Coverage unit tests pass (`tests/data/coverage.test.ts`).
- [x] `src/data/` unchanged after `npm run data:build`.
- [x] Baseline logged.
- [x] `npm run check` passes.
**Verification:** `npm run data:coverage`; `npm run data:build && git diff --exit-code src/data`; `npm test -- coverage`
**Files:** `scripts/coverage/*.txt`, `scripts/coverage.ts`, `scripts/order.ts`, `scripts/build-data.ts`, `package.json`, `tests/data/coverage.test.ts`, this file
**Scope:** M

### Task U2: Themes and word value (highest risk: opus)
**Description:** Write `scripts/themes.json` (about 10 situations, 40–80 words each, JMdict spellings) **without reading `scripts/coverage/`**. Add Tatoeba Japanese sentences as a cached source. Write `scripts/useful.ts`: theme membership, spoken (existing `usageRanks`), easy-text counts, `value` with the named weights. It isn't wired into the order yet. The build prints how many theme words matched a candidate, and lists the unmatched ones in `.data-cache/useful-report.txt`. Log under "Numbers": themes and their sizes, matched/unmatched counts, and the top 30 words by value.
**Acceptance:**
- [x] `tests/data/useful.test.ts` passes (formula, each part alone).
- [x] At least 90% of theme words match a candidate; unmatched ones reported.
- [x] `src/data/` unchanged.
- [x] Numbers logged.
- [x] `npm run check` passes.
**Verification:** `npm run data:build && git diff --exit-code src/data`; `npm test -- useful`
**Dependencies:** U1
**Files:** `scripts/themes.json`, `scripts/useful.ts`, `scripts/build-data.ts`, `tests/data/useful.test.ts`, this file
**Scope:** M

### Task U3: Greedy kanji order and useful words per level (highest risk: opus)
**Description:** Build the greedy order in `scripts/order.ts` per the spec (cost with building blocks, value/cost, leftover tail by `byGrade`, overrides), plus the order report. Candidates get built before levels, and levels are set after ordering. Add `byUsefulness` as `WORD_PICKER`. Regenerate `src/data/`. Update the real-data tests (`kanji.test.ts`, `words.test.ts`, confusables, reading golden if it is order-bound) to the spec's checks. Fix any core/game test that hard-codes a level's kanji. Log under "Numbers": the coverage table (new vs today), the order summary, Kanji 1–3's kanji with their "why", Kanji 1–2's words, and build time before/after.
**Acceptance:**
- [ ] Synthetic order tests pass (`tests/data/order.test.ts`).
- [ ] Real-data checks pass; two builds give identical JSON.
- [ ] `npm run test:slow` passes.
- [ ] Numbers logged.
- [ ] `npm run check` passes.
**Verification:** `npm run data:build` twice + `git diff --exit-code src/data`; `npm run data:coverage`; `npm run check && npm run test:slow`
**Dependencies:** U2
**Files:** `scripts/order.ts`, `scripts/words.ts`, `scripts/build-data.ts`, `src/data/*.json`, `tests/data/*.test.ts`, this file
**Scope:** L

### Task U4: Tune against the pass bands (opus)
**Description:** Tune `W_THEME`, `W_SPOKEN`, `W_EASY` and the kanji cost formula (named constants only) until the spec's travel and easy-reader bands are met, or show they can't be met. Read Kanji 1–4's order report and words, and fix anything plainly useless by a rule change, never by a list. Log every tried setting with its coverage row under "Numbers", and the chosen one with the reason.
**Acceptance:**
- [ ] Travel band met (+15 points average at Kanji 5 and 10) and easy-reader band met (≥ −5 at Kanji 10), or the shortfall is logged with the best setting found.
- [ ] Kanji 1–3 have no leftovers.
- [ ] `npm run check && npm run test:slow` pass.
**Verification:** `npm run data:coverage`; `npm run check && npm run test:slow`
**Dependencies:** U3
**Files:** `scripts/useful.ts`, `scripts/order.ts`, `src/data/*.json`, tests if a constant is pinned, this file
**Scope:** M

### Task U5: Progress carry-over (schema 2)
**Description:** Schema version 2 with the `MIGRATIONS[1]` from the spec (items kept, `unlockedLevel` recomputed by `applyUnlock` from 0), for both the main and Meaning stores. Change the `version` literal to 2 in types, `srs.ts`, `merge.ts` and storage. Sync goes through `migrate`; check that remote v1 + local v2 merges correctly. Add tests per the spec's Storage list, including a fixture of "levels 2–12 learned in today's order" landing on the first level under 80% in the new order (log that level).
**Acceptance:**
- [ ] Storage tests pass; no item is lost in migration.
- [ ] Sync tests pass with v1 and v2 saves mixed.
- [ ] `npm run check` passes.
**Verification:** `npm test -- storage sync`; `npm run check`
**Dependencies:** U4
**Files:** `src/storage/storage.ts`, `src/storage/meaning.ts`, `src/core/{types,srs,merge}.ts`, `src/sync/sync.ts` if needed, `tests/storage/*`, `tests/sync/*`, this file
**Scope:** S

### Task U6: Ship 1.6.0
**Description:** Add Tatoeba (CC BY 2.0 FR) and Aozora Bunko (public domain) credits to the README. Bump to 1.6.0 and add `## 1.6.0 (date)` in `CHANGELOG.md`. Wait for the deploy to go green. Take a screenshot at 390×844 of the start screen on migrated old-order progress (the fixture from U5) and of a Kanji 1 run with a gate.
**Acceptance:**
- [ ] Credits in README; version and changelog done; deploy green.
- [ ] Screenshots in the scratchpad.
- [ ] `npm run check` passes.
**Verification:** `npm run check`; deploy green.
**Dependencies:** U5
**Files:** `README.md`, `package.json`, `CHANGELOG.md`, this file
**Scope:** S

### Checkpoint U: v1.6.0 (owner, on the phone)
- [ ] Open the app: your learned kanji are still there, and the start screen puts you on a sensible level.
- [ ] Skim Kanji 1–4 (study cards or a few runs): kanji and words look useful for a trip, with no odd characters except building blocks.
- [ ] Coverage table on the checkpoint page: new order beats today's on menu, signs and phrasebook. If you want the WaniKani column, give a read-only token or kanji list (scratchpad only).

## Numbers
(Logged by each task.)

### U1 baseline (2026-11-17, today's order = `byGrade`; `new` equals it until U3)
Texts: menu 80 lines (269 kanji tokens), signs 123 (357), phrasebook 117 (273); stories = 5 Aozora texts (ごん狐, 手袋を買いに, 注文の多い料理店, セロ弾きのゴーシュ, 蜘蛛の糸), 1,152 sentences. Cells: kanji coverage % / readable lines %.

| text | Kanji 1 | Kanji 3 | Kanji 5 | Kanji 10 | Kanji 20 |
|---|---|---|---|---|---|
| menu | 9 / 1 | 33 / 15 | 42 / 19 | 57 / 26 | 70 / 38 |
| signs | 11 / 3 | 21 / 5 | 36 / 9 | 54 / 19 | 78 / 46 |
| phrasebook | 18 / 5 | 26 / 10 | 42 / 17 | 63 / 39 | 86 / 71 |
| stories | 20 / 3 | 30 / 5 | 43 / 10 | 58 / 19 | 72 / 33 |
| travel avg (coverage) | 13 | 27 | 40 | 58 | 78 |

**Pass bands look reachable.** Travel needs about 55 at Kanji 5 and 73 at Kanji 10 (+15). The ceiling, the texts' own most frequent kanji first (pooled travel tokens), is 71 at 150 kanji and 91 at 300, so +15 is about half the headroom: reachable but not trivial. Easy reader floor at Kanji 10 is 53 (today 58). Caveats: each travel text has only about 270–360 kanji tokens, so one token is about 0.3 points; 7 menu tokens are non-Jōyō (醤, 噌, 餃, 姜, 鮭) and stay unknown under every order.

### U2 themes and word value (2026-11-17)
- **Themes** (`scripts/themes.json`, written without the coverage texts): eating and drinking 64, trains and stations 63, shopping and money 59, hotel 59, directions and places 65, numbers/time/dates 68, people and family 64, small talk and feelings 66, health and emergencies 64, signs and notices 66. 638 entries, 603 distinct words.
- **Match:** 638 of 638 (100%) match a candidate, 8 of them through another spelling of the entry (入口 → 入り口, 立入禁止 → 立ち入り禁止, 税込 → 税込み, 朝ご飯 → 朝ごはん, 晩ご飯 → 晩御飯, 落とし物 → 落し物, 出入口 → 出入り口). First draft matched 77%: almost every single-kanji word (駅, 右, 人, 水, 肉) is not a candidate (`notRepeatOfKanji` drops a kanji read as taught), nor are words past the gate's 7-kana reading (駐車場, 救急車, 領収書), usually-kana ones (分かる, 火傷) or non-Jōyō ones (味噌汁, 嬉しい). Those were swapped for candidate words of the same situation (右手, 駅員, 父親, 体温). Dropped as wrong-spelling matches: 卵 (→ 玉子), 目 (→ 眼), 温かい (→ 暖かい).
- **Tatoeba:** `jpn_sentences.tsv.bz2` fetched 2026-11-17 (live export; the cached file is the pin), 248,989 sentences. Usefulness step adds 4.8 s to the build from cache (13.4 s with the download).
- **Top 30 by value** (all theme words; every one of the top 100 is a theme word, as `W_THEME` = 3 outweighs spoken + easy ≤ 1.5): 一つ 4.10, 言う 4.08, 行く 4.06, 思う 4.04, 自分 4.02, 後ろ 4.02, 彼女 4.00, 来る 3.99, 良い 3.97, 日本 3.97, 時間 3.97, 見る 3.96, 今日 3.96, 好き 3.96, 本当 3.95, 仕事 3.91, 子供 3.89, 少し 3.88, お金 3.86, 一番 3.86, 言葉 3.85, 一緒 3.85, 一人 3.84, 学校 3.84, 高い 3.84, 部屋 3.83, 悪い 3.82, 先生 3.82, 話す 3.82, 食べる 3.82.
