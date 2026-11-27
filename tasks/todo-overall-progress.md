# Tasks: overall progress, finish every level (v1.8.0)

Spec: `docs/specs/SPEC-overall-progress.md` (2026-11-27). Intent: `docs/intent/overall-progress.md`. Idea: `docs/ideas/overall-progress.md`.
Review: https://claude.ai/artifact/EC1jrjNRmNUtALM3M2rDVA
Every task: `npm run check` passes before it is checked off. Each task is one commit series on the session branch, pushed.

### Task P1: Learned = meaning and reading; unlock at 100% (sonnet, core)
Spec §1. `levelProgress`, `levelCard`, `applyUnlock`, `place` in `src/core/progression.ts`; meaning mode keeps meaning-only. Remove `UNLOCK_SHARE` (its two screen uses draw no mark for now; Task P4 redoes the copy). Add `meaningOnly`.
- [ ] Tests from the spec's "Testing" (progression) pass; existing progression and placement tests updated.
- [ ] `npm run test:slow` passes.
- [ ] `npm run check` passes.

### Task P2: Levels of 15 (sonnet; highest risk: data)
Spec §2. Re-level `kanji.json` and `words.json` in place (one-off transform, not committed as a script); `LEVEL_SIZE` 15 in `build-data.ts` and `coverage.ts`; `KANJI_WORDS_PER_LEVEL` 15; `WORDS_PER_LEVEL` 3; re-split `dictionary/stories/` into 143 files; fix "30 per level" docs and comments.
- [ ] Data test from the spec passes (15 per level, order unchanged against the previous `kanji.json`, word level = max kanji level, story files match levels).
- [ ] `npm run stories:check` passes.
- [ ] `npm run check` passes.

### Task P3: Travel coverage data (sonnet)
Spec §4 "Data". `scripts/travel.ts` + `npm run data:travel` → `src/data/travel.json`; `src/core/coverage.ts` with `travelCoverage`.
- [ ] `coverage.test.ts` from the spec passes; `travelCoverage` matches `measure`'s mean.
- [ ] `npm run check` passes (knip happy: `travelCoverage` may be used only by tests until P5; mark or wire accordingly).

### Task P4: End card and start screen copy (sonnet)
Spec §3. Level card and start-screen level block: new copy, no unlock mark, dim meaning-only segment and line, "Progress ›" affordance (tap target only, the view comes in P5).
- [ ] Offscreen 390×844 renders: end card (gain, unlock, last level, with/without meaning-only), start block; paths in the report.
- [ ] `npm run check` passes.

### Task P5: Overall view; ship 1.8.0 (opus: new screen layout)
Spec §4. `src/game/screens/progress.ts`, open from the start block, Back/Esc, collapsed finished levels, scrolling list, coverage line. Bump `package.json` to 1.8.0 and add `## 1.8.0 (<date>)` to `CHANGELOG.md`.
- [ ] Offscreen 390×844 renders: fresh save, mid-way save (unfinished lower levels), meaning mode; paths in the report.
- [ ] `package.json` 1.8.0; `CHANGELOG.md` has the 1.8.0 section.
- [ ] `npm run check` passes; deploy green.

### Checkpoint P: owner sets their level and plays
- [ ] With the picker, drop to where you want to start; play a few runs.
- [ ] The end card's numbers add up; "need their reading" makes sense or goes.
- [ ] The overall view shows level N of 143, each level's count and a coverage %.
- [ ] Over the next days: does a level take about 3–4 days? (Size is a one-line change if not.)
