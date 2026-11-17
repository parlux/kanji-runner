# Tasks: word gates (v1.5.0)

Spec: `docs/specs/done/SPEC-word-gates.md` (2026-11-17). Intent: `docs/intent/word-gates.md`. Epic: `docs/ideas/useful-japanese.md` (round 1). Started and closed 2026-11-17 (owner ticked Checkpoint W).
Review: https://claude.ai/artifact/GJA3yUyi9Eu4Di6xcP1sKr · Checkpoint W: https://claude.ai/artifact/UfYR2b4LZbCNqBqHSRRsZN
Every task: `npm run check` passes before it is checked off. Never commit `.data-cache` or raw EDRDG downloads.

## Plan
- **Data first, game second.** W1 builds and tests the candidate filters and picker on synthetic fixtures; W2 wires them into the build and logs the real numbers. W3 brings words into runs (core only); W4 makes them visible and ships.
- **Swappable by construction.** The picker is one function type and one constant; W1's tests prove a second picker swaps in.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Filters let through junk (fragments, odd glosses) with no hand review allowed | High | Named, tested filters; report counts removals and lists levels 2–10; owner judges by feel at the checkpoint; fixes are new filters, not lists. |
| JMdict first gloss is long or odd for a gate | Med | Reuse `pickGlosses` (short first); label-width checks. |
| More word gates shift balance | Med | Cap 2 new words; `test:slow` bot band. |
| Tint distracting or unreadable in 3D haze | Low | One constant; screenshots 2D and 3D; owner judges. |

### Task W1: Word candidates and picker module (highest risk: opus)
**Description:** New `scripts/words.ts`, pure functions per the spec: candidates from JMdict XML (spelling/reading choice, every filter as a named predicate, kind, level, nf facts), the `WordPicker` type, `byFrequency`, the `WORD_PICKER` constant and report rows. Not yet called by the build.
**Acceptance:**
- [x] Spec Testing Strategy synthetic cases pass in `tests/data/words-build.test.ts` (filters, `re_restr`, kind, level, repeat-of-kanji rule, `byFrequency` order/mix/shortfall, a test-only second picker swaps in).
- [x] `src/data/` unchanged.
- [x] `npm run check` passes.
**Verification:** `npm test -- words-build`
**Files:** `scripts/words.ts`, `tests/data/words-build.test.ts`
**Scope:** M

### Task W2: Wire into the build, generate `words.json`
**Description:** First, apply the spec amendments from W1's real-data findings in `scripts/words.ts` (+ synthetic tests): repeat rule narrowed to a lone kanji, singles need nf, primary gloss ≤ 20 chars, number cap 3 per level. Then `build-data.ts` calls `scripts/words.ts` with the kanji it just built; writes `src/data/words.json` and `.data-cache/word-report.txt`, prints the summary. Real-data tests in `tests/data/words.test.ts`. README credit. Log below under "Numbers": total words, removals per filter (W1 dry run vs now), kind mix for levels 2–6, and levels 2–3's word lists.
**Acceptance:**
- [x] Spec Testing Strategy "Real data" checks pass; two builds give identical JSON. (Builds identical; all checks pass except 今日 and 入る はいる, outranked by `byFrequency`: owner decision, see Numbers.)
- [x] Report written; numbers logged below.
- [x] README credit covers words.
- [x] `npm run check` passes.
**Verification:** `npm run data:build` twice + `git diff --exit-code src/data`; `npm test -- words`
**Dependencies:** W1
**Files:** `scripts/build-data.ts`, `src/data/words.json`, `tests/data/words.test.ts`, `README.md`, this file
**Scope:** M

### Task W2b: Everyday-frequency picker (highest risk: opus, web research)
**Description:** Owner chose (2026-11-17) to bring a better frequency source forward after W2 showed newspaper ranking misses basic words (見る, 入る, 今日, 行く, 来る, 食べる). Research and choose an open, licence-checked everyday-language Japanese frequency list (spoken or subtitle-based; must allow use in a build and attribution; nothing from WaniKani). Add it to `SOURCES` (cached, never committed), write `byUsage` per the spec, make it `WORD_PICKER`, add the gloss fallback, rebuild `words.json`. Flip the `it.fails` tests for 今日 and 入る to plain tests. Log in "Numbers": source + licence, how many candidates it ranks, levels 2–3 lists, and which of 見る 出る 入る 今日 行く 来る 食べる 電車 are now picked at which level.
**Acceptance:**
- [x] Source chosen with licence noted in the spec's README credit; build deterministic from the cache.
- [x] 今日 きょう and 入る はいる real-data tests pass as plain tests; most of the basic words above are picked.
- [x] Numbers logged.
- [x] `npm run check` passes.
**Verification:** `npm run data:build` twice + `git diff --exit-code src/data`; `npm test -- words`
**Dependencies:** W2
**Files:** `scripts/words.ts`, `scripts/build-data.ts`, `src/data/words.json`, `tests/data/words*.test.ts`, `README.md`, this file
**Scope:** M

### Task W3: Words in runs (core)
**Description:** `WordItem` reading/kind; load both lists; pool order (current level's words first, then lower levels from the lowest up); `kanjiNeeded`, eligibility by learned kanji meaning; `wordreading` gate type and entries (after meaning box 3); `MAX_NEW_WORDS_PER_RUN` 2 counting both types; placement marks both keys; `wordReadingRow` distractors; summary entries. No game visuals beyond what's needed to keep it running (a `wordreading` gate must render with the default look).
**Acceptance:**
- [x] Spec Testing Strategy "Core" tests pass.
- [x] `npm run test:slow` passes; bot figures logged below.
- [x] Loanwords behave as before (existing tests unchanged or only extended).
- [x] `npm run check` passes.
**Verification:** `npm run check && npm run test:slow`
**Dependencies:** W2b
**Files:** `src/core/{types,words,pool,run,distractors,progression,study,tuning}.ts`, tests in `tests/core/`, this file
**Scope:** M

### Task W4: Word gates on screen, ship 1.5.0
**Description:** Tint for `word`/`wordreading` gates (prompt and frame) in 2D and 3D; label fit for 6-char prompts and 7-kana options; answer reveal; summary; kanji-word study card. Bump to 1.5.0, `## 1.5.0 (date)` in `CHANGELOG.md`. Screenshots at 390×844, 2D and `?3d`: a word gate, a wordreading gate, a kanji gate next to them, the study card.
**Acceptance:**
- [x] Tint visible on word gates only, in 2D and 3D; labels readable at `GATE_MIN_W` (screenshots in the scratchpad).
- [x] Study card and summary show reading and meaning for kanji words.
- [x] Version 1.5.0 in `package.json` and `CHANGELOG.md`; deploy green.
- [x] `npm run check` passes.
**Verification:** `npm run check`; browser checks; deploy green.
**Dependencies:** W3
**Files:** `src/game/…`, `src/core/study.ts`, `package.json`, `CHANGELOG.md`, this file
**Scope:** M

### Checkpoint W: v1.5.0 (owner, on the phone)
- [x] Place at a level you know (e.g. Kanji 3) and play a few runs: words arrive (single, kanji plus kana, compounds), at most 2 new per run.
- [x] Reading gates ask the word's own reading (一人 ひとり, 今日 きょう).
- [x] Word gates stand out by tint without distracting, in 2D and 3D.
- [x] The words feel useful, not odd. If not, say what's off: the fix is a filter or a new picker, not a list.

## Numbers
W1 dry run on real JMdict (before the amendments): removals characters 526, startsWithKanji 143, notUsuallyKana 419, usualSense 76, fitsGate 362, usableGloss 7, notRepeatOfKanji 1472, duplicateSpelling 42; 14,636 candidates, 2,103 chosen; levels 2–68 at 30 each. Problems found: numbers/months tied at nf01 crowd out 一人/大人; 入る came out as いる; singles scarce and odd (子 ね). Owner approved fixes (2026-11-17), now in the spec.

**W2 (2026-11-17, amendments applied):** 2,112 words from 14,788 candidates; 30 per level for levels 2–68, then 25, 20, 24, none at 72, 3 at 73.
- Removals, W1 dry run → now: characters 526 → 526, startsWithKanji 143 → 143, notUsuallyKana 419 → 419, usualSense 76 → 76, fitsGate 362 → 362, usableGloss 7 → 478 (20-char cap), notRepeatOfKanji 1472 → 826 (lone kanji only), frequentSingle – → 21 (new), duplicateSpelling 42 → 44.
- Kind mix (single/okurigana/compound): L2 0/10/20, L3 1/7/22, L4 2/7/21, L5 1/7/22, L6 1/7/22. Singles stay scarce: almost every frequent lone kanji is read as taught (人 ひと), so their share goes to the shortfall fill.
- Number cap works (L2: 一月, 三十, 三月); 一つ…四つ are okurigana, not number words.
- Not met (spec real-data check, left for the owner, tests are `it.fails`): **今日 きょう** (L5, nf02: 32 nf01 compounds outrank it) and **入る はいる** (L2, nf25: 41st of level 2's okurigana). Both are common entries; `byFrequency`'s nf bands rank them out. Fix would be a picker change.
- No filters added. Odd picks still in: singles 下 もと, 空 から, 石 こく "koku", 行 ぎょう, 直 じき, 古 いにしえ (&poet;); okurigana 上がったり "doomed", 上げ "tuck", 休する; noun stems 入り, 下り. A "lone kanji whose taught reading has its own common entry" filter would drop 下 もと, 空 から, 石 こく, 直 じき but also 何 なに, so not added. Gloss cap also drops 帰国, 高校生, 直後, 部長, 年明け (long first glosses).
- Level 2: 一つ ひとつ one; 二人 ふたり two persons; 人々 ひとびと people; 人口 じんこう population; 大手 おおて big company; 一月 いちがつ January; 三人 さんにん three people; 三十 さんじゅう thirty; 三月 さんがつ March; 日本人 にほんじん Japanese person; 一人 ひとり one person; 二つ ふたつ two; 人生 じんせい life; 本人 ほんにん said person; 上がったり あがったり doomed; 年金 ねんきん annuity; 三つ みっつ three; 出す だす to get out; 大人 おとな adult; 入り いり entering; お金 おかね money; 日々 ひび daily; 日中 にっちゅう daytime; 生きる いきる to live; 大きな おおきな big; 入り口 いりぐち entrance; 一生 いっしょう whole life; 中立 ちゅうりつ neutrality; 出生 しゅっしょう birth; 四つ よっつ four.
- Level 3: 人気 にんき popularity; 大学 だいがく university; 女子 じょし woman; 学校 がっこう school; 学生 がくせい student; 男子 だんし boy; 七月 しちがつ July; 八月 はちがつ August; 六月 ろくがつ June; 先月 せんげつ last month; 先生 せんせい teacher; 文学 ぶんがく literature; 男女 だんじょ both sexes; 中学 ちゅうがく middle school; 中学生 ちゅうがくせい middle school pupil; 中止 ちゅうし interruption; 小学校 しょうがっこう grade school; 一気 いっき one breath; 中学校 ちゅうがっこう middle school; 先に さきに previously; 入学 にゅうがく admission; 名人 めいじん master; 小学生 しょうがくせい grade school student; お父さん おとうさん father; 下げる さげる to hang; 下 もと under; 下り くだり down-train; 七つ ななつ seven; 止まる とまる to stop; 白い しろい white.

**W2b (2026-11-17, `byUsage` is `WORD_PICKER`):** 2,112 words from 14,792 candidates (+4 from the gloss fallback); 30 per level for 2–68 and 72, then 25, 20, 24, 3 at 73 (as before).
- Source: **TUBELEX** Japanese, UniDic 3.1.0 lemma list (`tubelex-ja-310-lemma-pos.tsv.xz`, 351,453 forms from 166M tokens of YouTube subtitles), BSD-3-Clause, pinned: https://raw.githubusercontent.com/naist-nlp/tubelex/7cb5fb36add76b83a266d1967536e1a1d3faa513/frequencies/tubelex-ja-310-lemma-pos.tsv.xz (repo https://github.com/naist-nlp/tubelex). Unpacked with `xz`. Ranked by row order (token count).
- Rejected: hermitdave FrequencyWords (OpenSubtitles, CC BY-SA): Japanese is badly segmented (言, 行, 知, 分か as words). wordfreq (CC BY-SA 4.0): MeCab surface tokens, so verbs come as stems (見, 食べ), and it's a msgpack blend weighted to web/Twitter. Leeds Internet Corpus (CC BY): web text, not speech. BCCWJ frequency list (NINJAL): mostly written text, licence/terms not clearly open. jpdb / Yomitan anime-drama lists: no stated licence. CSJ: paid.
- How candidates get a rank: 12,043 by their own spelling, 244 by another spelling of their entry (出かける → 出掛ける), 6 by katakana reading (香港 ホンコン), 14 by お/ご stem (お金 → 金); 12,307 ranked by the list. 1,762 unlisted get their nf band's median rank (UniDic splits them: 日本人, 三月, 小学校); 723 with no nf rank last.
- Basic words now: 見る L2, 出る L2, 入る はいる L2, 今日 L5, 行く L5, 来る L6, 食べる L7, 電車 L7 (all 8; W2 had none of them). 今日 and 入る real-data tests are plain tests now.
- Removals per filter: characters 526, startsWithKanji 143, notUsuallyKana 419, usualSense 76, fitsGate 362, usableGloss 478 → 474 (gloss fallback rescues 4; 帰国, 高校生, 直後, 部長 have one long gloss in their first sense, 年明け's other is 21 chars), notRepeatOfKanji 826, frequentSingle 21, duplicateSpelling 44.
- Kind mix: verbs rank high in speech, so okurigana fill the missing singles' share: L2 0/14/16, L3 1/13/16, L4 2/12/16, L5 1/13/16, L6 1/13/16.
- Rough edges: the list has no readings, so a single kanji takes its spelling's whole count even when read another way: 下 もと (rank 203, from した), 空 から, 石 こく, 行 ぎょう, 申 さる, 古 いにしえ, 直 じき. Same for homographs generally (一日 いちにち also counts ついたち). Tech/YouTube words rise a little (入力, 出力 almost). No filters added.
- Level 2: 見る みる to see; 一つ ひとつ one; 出る でる to leave; 入る はいる to enter; 日本 にほん Japan; 入れる いれる to put in; 出す だす to get out; 上げる あげる to raise; 見える みえる to be seen; 大きい おおきい big; お金 おかね money; 上がる あがる to rise; 一人 ひとり one person; 二人 ふたり two persons; 大きな おおきな big; 生きる いきる to live; 立つ たつ to stand; 本日 ほんじつ today; 人生 じんせい life; 一日 いちにち one day; 人々 ひとびと people; 入力 にゅうりょく input; 大人 おとな adult; 一生 いっしょう whole life; 一月 いちがつ January; 三人 さんにん three people; 三月 さんがつ March; 九月 くがつ September; 日本人 にほんじん Japanese person; 日々 ひび daily.
- Level 3: 下 もと under; 止める とめる to stop; 先生 せんせい teacher; 小さい ちいさい small; 学校 がっこう school; 先ほど さきほど just now; 大学 だいがく university; 気づく きづく to notice; 人気 にんき popularity; 止まる とまる to stop; 下がる さがる to fall; 学ぶ まなぶ to learn; 白い しろい white; 正しい ただしい right; 小さな ちいさな small; 下げる さげる to hang; 一気 いっき one breath; 下る くだる to descend; 学生 がくせい student; 女の子 おんなのこ girl; 七月 しちがつ July; 八月 はちがつ August; 六月 ろくがつ June; 女子 じょし woman; 下ろす おろす to lower; 先日 せんじつ the other day; 中学 ちゅうがく middle school; 下手 へた unskillful; 上下 じょうげ high and low; 本気 ほんき seriousness.

**W3 slice 0 (homograph singles):** 2,112 words, same set; 8 single-kanji words lost their usage rank (下 もと, 石 こく, 空 から, 何 なに, 面 つら, 眼 め, 罰 ばち, 畳 たたみ) and moved within their level, plus 著作 swapped places. Singles still 38 in total (the shortfall fill keeps them). Level 2 singles: none; level 3 singles: 下 もと (still chosen, now by nf-median rank). Kind mix unchanged.

**W3 (2026-11-17):** core only; `check` and `test:slow` pass. Bot figures (200 seeds, perfect steering, all kana and kanji of levels 2-8 learned at box 2, unlocked level 8; accuracy 100% / 80% / 50%): kanji only (no words) win 100% / 56% / 7%, died early 0 / 68 / 165 of 200; words in the pool (new words, box 2) win 100% / 57% / 7.5%, died early 0 / 71 / 165, 14.3% of rows are words; words known at box 3 (their readings join) win 100% / 56% / 7%, died early 0 / 72 / 168, 38.6% word rows and 14.3% wordreading rows. Within the existing bands (80% boss win 40-70%, 50% under 10%); no retune. The boss tests' kana bot is unaffected. Existing tests changed only by: `kind: "loanword"` on hand-built WordItems, loanword-only filters where a test meant the 5-per-level list, new-word cap 1 → 2, a longer timeout for the wordRow sweep (word list is 2,112 longer; `wordRow` now caches normalized glosses). Golden runs unchanged (no words in them).
