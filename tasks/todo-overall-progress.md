# Tasks: overall progress, finish every level (v1.8.0)

Spec: `docs/specs/SPEC-overall-progress.md` (revised 2026-11-28). Intent: `docs/intent/overall-progress.md`. Idea: `docs/ideas/overall-progress.md`.
Review: https://claude.ai/artifact/EC1jrjNRmNUtALM3M2rDVA
Every task: `npm run check` passes before it is checked off. Each task is one commit series on the session branch, pushed.

### Task P1: Stages, learned at 3, words count, unlock at 100% (sonnet, core)
Spec §1 except groups. `stageName`; `LEARNED_BOX` 3; learned = every gate ≥ 3; a level's items include its words; `levelProgress`, `levelCard` (`kanji`, `words`, `readingToGo`), `applyUnlock`, `place` (readings and words), `isWordEligible` (kanji learned). Remove `UNLOCK_SHARE` (its screen uses draw no mark for now; Task P4 redoes the copy).
- [x] Tests from the spec's "Testing" (`srs`, `progression`, `words`) pass; existing progression, placement and word tests updated.
- [x] `npm run test:slow` passes (update expectations that assumed box 2 or 80%, and say which in the report).
- [x] `npm run check` passes.

### Task P2: Levels of 15 new things (sonnet; highest risk: data)
Spec §2. `scripts/levels.ts` slicer, used by `build-data.ts` after the picker; re-level `kanji.json` and `words.json` in place with it (one-off run); `coverage.ts` reads levels from `kanji.json`; `WORDS_PER_LEVEL` 1; re-split `dictionary/stories/` into 296 three-digit files and update the story scripts; fix "30 per level" docs and comments.
- [x] `levels.test.ts` and the data test from the spec pass (15 items per level, loanwords one per level 2–232, kanji order unchanged, no word before its kanji, word set unchanged, story files match levels).
- [x] `npm run stories:check` and `npm run test:slow` pass.
- [x] `npm run check` passes.

### Task P3: Groups and travel coverage (sonnet, core + script)
Spec §1 "Groups" and §4 "Data". `GROUP_SIZE`, `groupOf`, `groupName` with the draft names; `scripts/travel.ts` + `npm run data:travel` → `src/data/travel.json`; `src/core/coverage.ts` with `travelCoverage`.
- [x] Group tests and `coverage.test.ts` from the spec pass; `travelCoverage` matches `measure`'s mean.
- [x] `npm run check` passes (knip: `travelCoverage` and the group helpers may be used only by tests until P4/P5; mark or wire accordingly).

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
- [ ] The overall view shows Kanji N of 296, the groups, the current group's levels and a coverage %.
- [ ] Over the next days: does a level take a few days, and does the word tail at a level's end feel OK? (Size is a one-line change.)
