# Tasks: word gates (v1.5.0)

Spec: `docs/specs/SPEC-word-gates.md` (2026-11-17). Intent: `docs/intent/word-gates.md`. Epic: `docs/ideas/useful-japanese.md` (round 1).
Review: https://claude.ai/artifact/GJA3yUyi9Eu4Di6xcP1sKr
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
- [ ] Spec Testing Strategy "Real data" checks pass; two builds give identical JSON.
- [ ] Report written; numbers logged below.
- [ ] README credit covers words.
- [ ] `npm run check` passes.
**Verification:** `npm run data:build` twice + `git diff --exit-code src/data`; `npm test -- words`
**Dependencies:** W1
**Files:** `scripts/build-data.ts`, `src/data/words.json`, `tests/data/words.test.ts`, `README.md`, this file
**Scope:** M

### Task W3: Words in runs (core)
**Description:** `WordItem` reading/kind; load both lists; pool order (current level's words first, then lower levels from the lowest up); `kanjiNeeded`, eligibility by learned kanji meaning; `wordreading` gate type and entries (after meaning box 3); `MAX_NEW_WORDS_PER_RUN` 2 counting both types; placement marks both keys; `wordReadingRow` distractors; summary entries. No game visuals beyond what's needed to keep it running (a `wordreading` gate must render with the default look).
**Acceptance:**
- [ ] Spec Testing Strategy "Core" tests pass.
- [ ] `npm run test:slow` passes; bot figures logged below.
- [ ] Loanwords behave as before (existing tests unchanged or only extended).
- [ ] `npm run check` passes.
**Verification:** `npm run check && npm run test:slow`
**Dependencies:** W2
**Files:** `src/core/{types,words,pool,run,distractors,progression,study,tuning}.ts`, tests in `tests/core/`, this file
**Scope:** M

### Task W4: Word gates on screen, ship 1.5.0
**Description:** Tint for `word`/`wordreading` gates (prompt and frame) in 2D and 3D; label fit for 6-char prompts and 7-kana options; answer reveal; summary; kanji-word study card. Bump to 1.5.0, `## 1.5.0 (date)` in `CHANGELOG.md`. Screenshots at 390×844, 2D and `?3d`: a word gate, a wordreading gate, a kanji gate next to them, the study card.
**Acceptance:**
- [ ] Tint visible on word gates only, in 2D and 3D; labels readable at `GATE_MIN_W` (screenshots in the scratchpad).
- [ ] Study card and summary show reading and meaning for kanji words.
- [ ] Version 1.5.0 in `package.json` and `CHANGELOG.md`; deploy green.
- [ ] `npm run check` passes.
**Verification:** `npm run check`; browser checks; deploy green.
**Dependencies:** W3
**Files:** `src/game/…`, `src/core/study.ts`, `package.json`, `CHANGELOG.md`, this file
**Scope:** M

### Checkpoint W: v1.5.0 (owner, on the phone)
- [ ] Place at a level you know (e.g. Kanji 3) and play a few runs: words arrive (single, kanji plus kana, compounds), at most 2 new per run.
- [ ] Reading gates ask the word's own reading (一人 ひとり, 今日 きょう).
- [ ] Word gates stand out by tint without distracting, in 2D and 3D.
- [ ] The words feel useful, not odd. If not, say what's off: the fix is a filter or a new picker, not a list.

## Numbers
W1 dry run on real JMdict (before the amendments): removals characters 526, startsWithKanji 143, notUsuallyKana 419, usualSense 76, fitsGate 362, usableGloss 7, notRepeatOfKanji 1472, duplicateSpelling 42; 14,636 candidates, 2,103 chosen; levels 2–68 at 30 each. Problems found: numbers/months tied at nf01 crowd out 一人/大人; 入る came out as いる; singles scarce and odd (子 ね). Owner approved fixes (2026-11-17), now in the spec.

(W2 and W3 fill in below.)
