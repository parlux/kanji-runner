# Tasks: useful-words order (v1.6.0)

Spec: `docs/specs/done/SPEC-useful-order.md` (2026-11-17). Intent: `docs/intent/useful-words-order.md`. Epic: `docs/ideas/useful-japanese.md` (round 2). Started 2026-11-17, closed 2026-11-20 (owner ticked Checkpoint U).
Review: https://claude.ai/artifact/TZ4TSiMPUqozQZkecva4yF · Checkpoint U: https://claude.ai/artifact/KZDbNTEdhyxEsoGY7k6N2C
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
- [x] Synthetic order tests pass (`tests/data/order.test.ts`).
- [x] Real-data checks pass; two builds give identical JSON.
- [x] `npm run test:slow` passes.
- [x] Numbers logged.
- [x] `npm run check` passes.
**Verification:** `npm run data:build` twice + `git diff --exit-code src/data`; `npm run data:coverage`; `npm run check && npm run test:slow`
**Dependencies:** U2
**Files:** `scripts/order.ts`, `scripts/words.ts`, `scripts/build-data.ts`, `src/data/*.json`, `tests/data/*.test.ts`, this file
**Scope:** L

### Task U4: Tune against the pass bands (opus)
**Description:** Tune `W_THEME`, `W_SPOKEN`, `W_EASY` and the kanji cost formula (named constants only) until the spec's travel and easy-reader bands are met, or show they can't be met. Read Kanji 1–4's order report and words, and fix anything plainly useless by a rule change, never by a list. Log every tried setting with its coverage row under "Numbers", and the chosen one with the reason.
**Acceptance:**
- [x] Travel band met (+15 points average at Kanji 5 and 10) and easy-reader band met (≥ −5 at Kanji 10), or the shortfall is logged with the best setting found.
- [x] Kanji 1–3 have no leftovers.
- [x] `npm run check && npm run test:slow` pass.
**Verification:** `npm run data:coverage`; `npm run check && npm run test:slow`
**Dependencies:** U3
**Files:** `scripts/useful.ts`, `scripts/order.ts`, `src/data/*.json`, tests if a constant is pinned, this file
**Scope:** M

### Task U5: Progress carry-over (schema 2)
**Description:** Schema version 2 with the `MIGRATIONS[1]` from the spec (items kept, `unlockedLevel` recomputed by `applyUnlock` from 0), for both the main and Meaning stores. Change the `version` literal to 2 in types, `srs.ts`, `merge.ts` and storage. Sync goes through `migrate`; check that remote v1 + local v2 merges correctly. Add tests per the spec's Storage list, including a fixture of "levels 2–12 learned in today's order" landing on the first level under 80% in the new order (log that level).
**Acceptance:**
- [x] Storage tests pass; no item is lost in migration.
- [x] Sync tests pass with v1 and v2 saves mixed.
- [x] `npm run check` passes.
**Verification:** `npm test -- storage sync`; `npm run check`
**Dependencies:** U4
**Files:** `src/storage/storage.ts`, `src/storage/meaning.ts`, `src/core/{types,srs,merge}.ts`, `src/sync/sync.ts` if needed, `tests/storage/*`, `tests/sync/*`, this file
**Scope:** S

### Task U6: Ship 1.6.0
**Description:** Add Tatoeba (CC BY 2.0 FR) and Aozora Bunko (public domain) credits to the README. Bump to 1.6.0 and add `## 1.6.0 (date)` in `CHANGELOG.md`. Wait for the deploy to go green. Take a screenshot at 390×844 of the start screen on migrated old-order progress (the fixture from U5) and of a Kanji 1 run with a gate.
**Acceptance:**
- [x] Credits in README; version and changelog done; deploy green.
- [x] Screenshots in the scratchpad.
- [x] `npm run check` passes.
**Verification:** `npm run check`; deploy green.
**Dependencies:** U5
**Files:** `README.md`, `package.json`, `CHANGELOG.md`, this file
**Scope:** S

### Checkpoint U: v1.6.0 (owner, on the phone)
- [x] Open the app: your learned kanji are still there, and the start screen puts you on a sensible level.
- [x] Skim Kanji 1–4 (study cards or a few runs): kanji and words look useful for a trip, with no odd characters except building blocks.
- [x] Coverage table on the checkpoint page: new order beats today's on menu, signs and phrasebook. If you want the WaniKani column, give a read-only token or kanji list (scratchpad only).

## Numbers
**Checkpoint U (owner, 2026-11-20):** ticked. Accepted travel +12 at Kanji 5 (target +15). Dropped the single-kanji quota in `byUsefulness` (v1.6.1, 483d815): 38 → 1 single words.

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

### U3 greedy order, starting weights (2026-11-17)
- **Themes:** 81 lone-kanji travel words added (now racers, never in `words.json`): 駅 車 線 券 席 便, 水 肉 魚 茶 酒 箸 皿 塩 味 鳥, 円 札 値 服 靴 傘 箱 紙, 鍵 湯 宿 階 窓, 右 左 道 北 南 東 西 外 横 隣 角 町 橋, 朝 昼 夜 晩 時 年 週 今, 父 母 兄 姉 弟 妹 夫 妻 友 子 男 女 名 国, 雨 雪 春 夏 秋 冬 誰, 薬 熱 血 体 足 手 歯 耳 顔 火. Sizes 64–78; 719 entries, 100% match. 人, 金, 店, 米, 前, 上, 中 can't race: their lone entry has no nf, so `frequentSingle` drops it too (spec: racers are dropped *only* by `notRepeatOfKanji`).
- **Racers:** 695 lone-kanji words race beside 14,792 candidates.
- **Order summary:** 575 kanji from theme words, 1,503 from other words (57 of them building blocks), 58 leftovers. Kanji 1–3 have no leftovers.
- **Coverage** (kanji coverage % / readable lines %):

| text | order | Kanji 1 | Kanji 3 | Kanji 5 | Kanji 10 | Kanji 20 |
|---|---|---|---|---|---|---|
| menu | new | 26 / 9 | 35 / 12 | 43 / 15 | 67 / 37 | 82 / 60 |
| menu | today | 9 / 1 | 33 / 15 | 42 / 19 | 57 / 26 | 70 / 38 |
| signs | new | 11 / 4 | 23 / 7 | 33 / 12 | 55 / 29 | 94 / 81 |
| signs | today | 11 / 3 | 21 / 5 | 36 / 9 | 54 / 19 | 78 / 46 |
| phrasebook | new | 19 / 5 | 34 / 13 | 43 / 22 | 67 / 46 | 95 / 89 |
| phrasebook | today | 18 / 5 | 26 / 10 | 42 / 17 | 63 / 39 | 86 / 71 |
| stories | new | 16 / 2 | 28 / 6 | 34 / 9 | 48 / 14 | 70 / 30 |
| stories | today | 20 / 3 | 30 / 5 | 43 / 10 | 58 / 19 | 72 / 33 |
| travel avg | new | 19 | 31 | 40 | 63 | 90 |
| travel avg | today | 13 | 27 | 40 | 58 | 78 |

  Bands not met with the starting weights: travel +0 at Kanji 5 and +5 at Kanji 10 (need +15), stories 48 at Kanji 10 (floor 53). Big gain only at Kanji 20 (+12).
- **Why it falls short (for U4):** `W_THEME` = 3 makes every theme word worth about 3–4, so value/cost turns into "cheapest theme word first": 甘, 包, 他, 払, 老 come in Kanji 1–3 while 駅 (with its block 馬) waits until level 19, 出 until 10, 時 until 11. The real-data check "駅, 円, 出, 入, 口, 何, 時 in Kanji 1–5" fails on 駅, 出, 時 and is marked `it.fails` in `tests/data/kanji.test.ts`.
- **Kanji 1–3 and why** (all from theme words; value in brackets):
  - Kanji 1: 一 一つ (4.04), 人 一人 (3.79), 二 二人, 女 女, 子 子, 今 今, 手 手, 日 今日, 下 下, 上 上手, 大 大人, 三 三人, 水 水, 父 父, 火 火, 夫 夫, 丈 大丈夫, 円 円, 母 母, 行 行く, 月 今月, 好 好き, 冬 冬, 北 北, 口 北口, 入 入り口, 右 右, 兄 兄, 万 一万, 甘 甘い.
  - Kanji 2: 五 五つ, 払 払う, 言 言う, 他 他人, 皿 皿, 小 小皿, 少 少し, 会 会う, 良 良い, 毎 毎日, 車 車, 内 車内, 肉 肉, 牛 牛肉, 安 安い, 包 包む, 耳 耳, 四 四つ, 向 向かう, 方 方向, 夕 夕方, 外 外, 名 名, 有 有名, 列 列車, 危 危ない, 血 血, 西 西, 何 何, 老 老人.
  - Kanji 3: 曲 曲がる, 回 一回, 伝 手伝う, 生 生ビール, 供 子供, 夜 夜, 中 夜中, 央 中央, 後 後ろ, 明 明日, 雨 雨, 冷 冷たい, 性 女性, 店 お店, 角 角, 若 若い, 学 学生, 妻 妻, 食 食べる, 事 食事, 工 工事中, 左 左, 物 食べ物, 前 名前, 目 目の前, 見 見る, 私 私たち, 昨 昨日, 変 大変, 乗 乗る.
- **Words, Kanji 1:** 一つ 行く 今日 好き 一人 二人 大丈夫 一日 人々 大好き 女の子 行き 下 上手 大人 甘い 三人 女子 二つ 下手 お母さん 入り口 下り 今月 お父さん 右手 上り 三つ 北口 行.
- **Words, Kanji 2:** 言う 良い 少し 何 会う 毎日 有名 安い 方向 向かう 向こう 列車 危ない 払う 他人 老人 夕方 包む 向かい 車内 牛肉 四つ 何人 五つ 下車 西口 小皿 何日 一方 少女.
- **Odd words for U4:** 下 is taught as もと "under" and 行 as ぎょう "line": the theme's 下 (meant した) matches the only 下 candidate, and 行's easy count comes from every 行 in Tatoeba.
- **Build time:** 8.6 s before, 9.0 s after (the greedy itself 0.3 s, a simple scan over live words with incrementally kept costs). Two builds give identical JSON.
- **test:slow:** 902 tests pass; balance bands unchanged (11 balance tests, 66 s).

### U4 tuning (2026-11-17)
Graded only by the coverage table (travel texts never opened). Row = travel avg kanji coverage at Kanji 1/3/5/10/20, then stories at Kanji 10. Bands: travel ≥ 55 at Kanji 5 and ≥ 73 at Kanji 10; stories ≥ 53.

| setting | travel 1/3/5/10/20 | stories K10 |
|---|---|---|
| U3 start: `value/cost`, W_THEME 3, cost 1 + strokes/10 | 19/31/40/63/90 | 48 |
| W_THEME 1 | 19/31/42/61/89 | 49 |
| W_THEME 0.5 | 19/31/41/60/85 | 53 |
| lookahead over a word's whole closure (blocks get gain), λ 0.1 / 0.3 / 1 | 11/31/49/66/89 · 11/29/43/67/90 · 10/26/42/67/86 | 54 · 56 · 56 |
| lookahead, own kanji only, W_THEME 3, λ 0.1 / 0.3 / 1 | 21/33/43/64/90 · 18/39/48/66/88 · 19/34/51/65/85 | 49 · 53 · 52 |
| λ 0.3, strokes/20 | 18/37/49/66/88 | 52 |
| λ 0.3, blocks at 0.5 | 19/33/50/68/90 | 54 |
| λ 0.3, strokes/20, blocks 0.5 | 19/36/51/68/90 | 54 |
| λ 1, strokes/20, blocks 0.5 | 19/34/45/69/87 | 55 |
| λ 0.3, cost 1 per kanji (no strokes) | 18/36/46/65/89 | 50 |
| steeper curve: spoken and easy squared / cubed (λ 0.3, strokes/20, blocks 0.5) | 17/39/51/66/90 · 17/39/51/66/90 | 53 · 54 |
| theme as multiplier `(spoken + easy/2 + 0.05)·(1 + 3·theme)`, λ 0.3; squared | 18/33/43/66/87 · 16/31/44/67/87 | 56 · 56 |
| multiplier, λ 1, ·(1 + 10·theme) / ·(1 + 30·theme) (floor 0.1) | 20/34/45/69/87 · 19/34/51/71/90 | 56 · 56 |
| additive W_THEME 10, λ 0.3, strokes/20, blocks 0.5 | 17/39/50/67/90 | 55 |
| W_THEME 10, λ 1 (same cost) | 19/41/52/71/90 | 56 |
| W_THEME 30, λ 1 | 18/41/50/73/90 | 54 |
| W_THEME 10, λ 1, squared | 18/41/50/73/90 | 54 |
| W_THEME 10, λ 3 | 19/41/51/70/89 | 55 |
| W_THEME 10, λ 1, no strokes / strokes/10 | 19/34/51/72/90 · 19/40/51/71/90 | 55 · 55 |
| W_THEME 10, λ 1, W_EASY 0 | 19/41/51/71/90 | 56 |
| W_THEME 10, λ 1, strokes/20, **blocks 0.25** | **19/34/52/73/90** | **56** |
| same, W_THEME 20 / no strokes / blocks 0 | 19/34/51/72/90 · 19/34/51/72/90 · 18/34/46/72/90 | 54 · 56 · 55 |
| kanji-centric pick (best kanji by gain / closure cost), W_THEME 10 / 3 | 20/34/51/73/90 · 20/34/45/69/87 | 56 · 56 |
| slice 1 as committed (lookahead and cost, W_THEME still 3) | 20/34/45/69/88 | 56 |

**Chosen** (slices 1–2): lookahead `LOOKAHEAD = 1`, cost `1 + strokes/20` (`STROKES_PER_UNIT = 20`), building blocks at `BLOCK_COST = 0.25`, `W_THEME = 10`, `W_SPOKEN = 1`, `W_EASY = 0.5`, plus three logged rules: no easy score for one-kanji words (substring counts are the kanji's, not the word's); racers skip `frequentSingle` and race beside a same-spelled candidate; a theme spelling matches the racer over the candidate (下 した, not 下 もと). The rules move no number (19/34/52/73/90, stories 56) but stop 下 もと from counting as a theme word. Why: best Kanji 5 and Kanji 10 of everything tried while the stories row stays above the floor; it was the plateau's best, not a tuned outlier (its neighbours are within one point). The lookahead was the step change (+5 to +10 at Kanji 10); weights alone moved nothing (rows 1–3).

**Bands:** Kanji 10 met (73 vs today 58, +15); stories met (56 vs 58, −2). **Kanji 5 short: 52 vs today 40, +12 (needs +15).** Every principled setting plateaued at 50–52 at Kanji 5. Likely reason: themes list each word once, so the order follows how many theme words use a kanji, not how often signs and menus repeat it (円 and 駅 tokens). 駅 lands in Kanji 10 (only a few theme words, plus 馬); the spec test is split: 円 出 入 口 何 時 by Kanji 5 passes, 駅 by Kanji 5 stays `it.fails`. Kanji 1–3 have no leftovers.

Final table (kanji coverage % / readable lines %):

| text | order | Kanji 1 | Kanji 3 | Kanji 5 | Kanji 10 | Kanji 20 |
|---|---|---|---|---|---|---|
| menu | new | 13 / 1 | 26 / 3 | 53 / 22 | 67 / 32 | 82 / 56 |
| menu | today | 9 / 1 | 33 / 15 | 42 / 19 | 57 / 26 | 70 / 38 |
| signs | new | 16 / 4 | 34 / 7 | 50 / 19 | 74 / 45 | 93 / 81 |
| signs | today | 11 / 3 | 21 / 5 | 36 / 9 | 54 / 19 | 78 / 46 |
| phrasebook | new | 29 / 6 | 43 / 18 | 54 / 29 | 77 / 53 | 96 / 90 |
| phrasebook | today | 18 / 5 | 26 / 10 | 42 / 17 | 63 / 39 | 86 / 71 |
| stories | new | 19 / 4 | 33 / 7 | 41 / 9 | 56 / 17 | 69 / 30 |
| stories | today | 20 / 3 | 30 / 5 | 43 / 10 | 58 / 19 | 72 / 33 |
| travel avg | new | 19 | 34 | 52 | 73 | 90 |
| travel avg | today | 13 | 27 | 40 | 58 | 78 |

Order summary: 522 kanji from theme words, 1,558 from other words (79 of them building blocks), 56 leftovers; 795 racers; order step 4.5 s.

**Kanji 1–4 (why):**
- Kanji 1: 日 (lookahead; reported word 日々), 一 一つ, 人 一人, 大 大人, 手 手, 下 下手, 車 車, 行 行く, 子 子, 女 女の子, 今 今日, 食 食べる, 口 (lookahead; 人口), 何 何人, 上 上手, 牛 (block of 物) 物 食べ物, 気 (lookahead; 人気), 入 入り口, 乗 乗る, 用 (block of 通) 通 通り, 木 (block of 本) 本 日本, 生 生ビール, 向 向かう, 山 (block of 出) 出 出口, 刀 (block of 分) 分 気分.
- Kanji 2: 方 方向, 中 (lookahead; 日中), 事 食事, 店 お店, 内 車内, 当 本当, 右 右, 曜 日曜日, 火 火, 月 今月, 前 手前, 夕 (block of 名) 名 名前, 二 二人, 発 出発, 水 水, 土 (block of 場) 場 入場, 寸 (block of 時) 時 何時, 週 今週, 先 先生, 地 地下, 士 (block of 売) 売 売る, 会 会う, 休 休み, 定 定食, 母 母, 父 父.
- Kanji 3: 毎 毎日, 十 干 (blocks of 年) 年 今年, 朝 朝食, 外 外, 王 (block of 国) 国 外国, 金 お金, 痛 痛い, 品 品物, 切 売り切れ, 門 (block of 間) 間 時間, 開 開く, 昼 昼間, 館 休館, 夜 今夜, 米 (block of 来) 来 来る, 茶 お茶, 面 方面, 肉 肉, 半 半分, 体 体, 三 三人, 者 (lookahead; 者), 旅 旅行, 券 券, 回 一回.
- Kanji 4: 学 学生, 工 (block of 左) 左 左右, 穴 (block of 空) 空 空く, 目 貝 (blocks of 側) 側 左側, 北, 西, 自 自分, 見 見る, 南, 斗 (block of 料) 料 料金, 有 有名, 祖 祖父, 斤 戸 (blocks of 所) 所 場所, 近 近く, 止 通行止め, 足, 元 元気, 社 会社, 員 店員, 閉 閉まる, 払 払う, 午 午前, 後 後ろ.

"Lookahead" kanji are picked for the words they unlock; the report names the best word whose only unplaced kanji it is, which can be a non-theme word (日々, 人口).

**Kanji 1 words:** 一つ, 行く, 日本, 今日, 一人, 食べる, 通り, 一日, 乗る, 人々, 女の子, 向かう, 行き, 上手, 気分, 向こう, 本日, 大人, 日本人, 通る, 食べ物, 女子, 下手, 入り口, 下り, 出口, 上り, 行 ぎょう, 何, 下 もと.
**Kanji 2 words:** 本当, 先生, 何時, 二人, 名前, 会う, お店, 食事, 方向, 売る, 出発, 一時, 休み, 地下, 今週, 先週, 二つ, お母さん, 夕食, 夕方, 今月, お父さん, 右手, 手前, 火事, 先月, 入場, 車内, 発車, 前方.

Rough edges: 下 もと (value 0.30, no longer a theme word) and 行 ぎょう (0.40) still close Kanji 1, as fillers of the single-kanji quota (about 25%): Kanji 1 has only three single candidates. Fixing that means changing the kind mix, which the spec keeps, so it's left for the owner. `npm run check` and `npm run test:slow` pass (balance bands untouched; run golden snapshot and the "level 2 starts with 一" check follow the new order).

### U5 migration fixture (2026-11-17)
Kana levels learned plus levels 2-12 (330 kanji, v1.5.0 order) at box 5, saved as v1 at level 13. `migrate` lands on level 6 (Kanji 5): 21/30 learned, 24 needed. Learned per new level: Kanji 1 (L2) 29/30, Kanji 2 (L3) 30/30, Kanji 3 (L4) 26/30, Kanji 4 (L5) 25/30, Kanji 5 (L6) 21/30, Kanji 6 (L7) 13/30. Fixture chars: `tests/storage/fixtures/old-order.ts`.
