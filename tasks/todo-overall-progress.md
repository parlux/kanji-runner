# Tasks: overall progress, finish every level (v1.8.0)

Spec: `docs/specs/SPEC-overall-progress.md` (revised 2026-11-28). Intent: `docs/intent/overall-progress.md`. Idea: `docs/ideas/overall-progress.md`.
Review: https://claude.ai/artifact/EC1jrjNRmNUtALM3M2rDVA
Every task: `npm run check` passes before it is checked off. Each task is one commit series on the session branch, pushed.

### Task P1: Stages, learned at 3, words count, unlock at 100% (sonnet, core)
Spec §1 except groups. `stageName`; `LEARNED_BOX` 3; learned = every gate ≥ 3; a level's items include its words; `levelProgress`, `levelCard` (`kanji`, `words`, `readingToGo`), `applyUnlock`, `place` (readings and words), `isWordEligible` (kanji learned). Remove `UNLOCK_SHARE` (its screen uses draw no mark for now; Task P4 redoes the copy).
- [ ] Tests from the spec's "Testing" (`srs`, `progression`, `words`) pass; existing progression, placement and word tests updated.
- [ ] `npm run test:slow` passes (update expectations that assumed box 2 or 80%, and say which in the report).
- [ ] `npm run check` passes.

### Task P2: Levels of 8 (sonnet; highest risk: data)
Spec §2. Re-level `kanji.json` and `words.json` in place (one-off transform, not committed as a script); `LEVEL_SIZE` 8 in `build-data.ts` and `coverage.ts`; `KANJI_WORDS_PER_LEVEL` 8; `MAX_NUMBER_WORDS_PER_LEVEL` 1; `WORDS_PER_LEVEL` 1; re-split `dictionary/stories/` into 267 three-digit files and update the story scripts; fix "30 per level" docs and comments.
- [ ] Data test from the spec passes (8 per level, order unchanged against the previous `kanji.json`, word level = max kanji level, loanwords one per level 2–232, story files match levels).
- [ ] `npm run stories:check` and `npm run test:slow` pass.
- [ ] `npm run check` passes.

### Task P3: Groups and travel coverage (sonnet, core + script)
Spec §1 "Groups" and §4 "Data". `GROUP_SIZE`, `groupOf`, `groupName` with the draft names; `scripts/travel.ts` + `npm run data:travel` → `src/data/travel.json`; `src/core/coverage.ts` with `travelCoverage`.
- [ ] Group tests and `coverage.test.ts` from the spec pass; `travelCoverage` matches `measure`'s mean.
- [ ] `npm run check` passes (knip: `travelCoverage` and the group helpers may be used only by tests until P4/P5; mark or wire accordingly).

### Task P4: End card, start screen, study card (sonnet)
Spec §3. Level card and start-screen block: new copy, group name, kanji/words line, no unlock mark, dim reading-to-go segment, "Progress ›" affordance (tap target only, the view comes in P5). Study card stage line.
- [ ] Offscreen 390×844 renders: end card (gain, unlock, last level, with/without reading-to-go), start block, study card stages; paths in the report.
- [ ] `npm run check` passes.

### Task P5: Overall view; ship 1.8.0 (opus: new screen layout)
Spec §4. `src/game/screens/progress.ts`, open from the start block, Back/Esc, past groups collapsed, current group's levels open, scrolling list, coverage line. Bump `package.json` to 1.8.0 and add `## 1.8.0 (<date>)` to `CHANGELOG.md`.
- [ ] Offscreen 390×844 renders: fresh save, mid-way save (a slipped item in a passed level), meaning mode; paths in the report.
- [ ] `package.json` 1.8.0; `CHANGELOG.md` has the 1.8.0 section.
- [ ] `npm run check` passes; deploy green.

### Checkpoint P: owner sets their level and plays
- [ ] With the picker, drop to where you want to start; play a few runs.
- [ ] The end card's numbers add up; the kanji/words line and "need their reading" make sense or go.
- [ ] The overall view shows Kanji N of 267, the groups, the current group's levels and a coverage %.
- [ ] Over the next days: does a level take a few days, and does the word tail at a level's end feel OK? (Size is a one-line change.)
