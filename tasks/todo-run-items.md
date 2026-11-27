# Tasks: items met after a run, what's in a level (v1.9.0)

Spec: `docs/specs/SPEC-run-items.md` (2026-11-28). Intent: `docs/intent/run-items.md`. Idea: `docs/ideas/run-items.md`.
Review: https://claude.ai/artifact/D5iiauMNbxjQCLhMtxswQU
Checkpoint R: https://claude.ai/artifact/Pn8ysGJ3MqvKN57tywJkEX
Started while Checkpoint P (`tasks/todo-overall-progress.md`) waits on the owner's days of play; this is the active list for "implement the next round".
Every task: `npm run check` passes before it is checked off. Each task is one commit series on the session branch, pushed.

### Task R1: Run items (sonnet, core)
Spec §1. `runItems` in a new core module: entries per item met, change kind, order, right answer on misses, mode rules.
- [x] `runitems.test.ts` from the spec passes.
- [x] `npm run check` passes (knip: used by tests only until R2; mark or wire accordingly).

### Task R2: End screen item list; session log removed (sonnet)
Spec §2. New list between the level card and the buttons; stat tiles, missed list and session line removed; session log code, storage and tests removed (stored keys left alone).
- [x] Layout tests (16 rows fit at 390×844, scroll clamp) pass.
- [x] Offscreen 390×844 renders: good run, slips, new items, long list scrolled, compact 390×700; paths in the report.
- [x] `npm run check` passes.

### Task R3: Progress view: groups expand, level page (opus: layout and taps)
Spec §3–4 except the study card. Past groups toggle; level rows open the level page; drag vs tap; level page header, rows, order, locked dim, scroll, Back keeps scroll.
- [x] Progress tests from the spec pass.
- [x] Offscreen 390×844 renders: a past group expanded, level page (current, learned, locked); paths in the report.
- [x] `npm run check` passes.

### Task R4: Study card from the level page; ship 1.9.0 (sonnet)
Spec §4 "Tap an item". One-item study card from the level page, closes back to it. Bump `package.json` to 1.9.0 and add `## 1.9.0 (<date>)` to `CHANGELOG.md`.
- [x] Offscreen 390×844 render of a study card opened from the level page; path in the report.
- [x] `package.json` 1.9.0; `CHANGELOG.md` has the 1.9.0 section.
- [x] `npm run check` passes; deploy green.

### Checkpoint R: owner plays
- [ ] After a few runs: the list says what you met and what moved; the row wording reads well.
- [ ] Start screen → level block → Kanji 1 shows its 15 items; an item opens its study card.
- [ ] Nothing missed from the old end screen (stat tiles, session line).
