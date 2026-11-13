# Tasks: kanji meaning mode (v1.7)

Spec: `docs/specs/SPEC-meaning-mode.md` (2026-11-13). Intent: `docs/intent/kanji-meaning-mode.md`. Idea: `docs/ideas/kanji-meaning-mode.md`. Started 2026-11-13.
Every task: `npm test && npm run lint && npm run build` pass before it is checked off.

## Phase 13: Meaning mode

### Task K1: Meaning-mode pool and save (pure)
**Description:**
- A pool builder for meaning mode (beside `builtInPool` in `src/core/pool.ts`): meaning entries of unlocked kanji levels only; same selection rules as Built-in.
- Fresh meaning-mode progress at level 2; placement offering Kanji 1 and up.
- Storage helpers for the mode flag, its progress and its session log under new keys (`src/storage/`).

**Acceptance criteria:**
- [x] Tested: only meaning entries (no kana, reading or word entries, even when their boxes/eligibility would allow them); fresh progress at level 2; place/unlock from Kanji 1.
- [x] Tested: new keys round-trip; `kanji-runner:v1` and the owner's session log are never read or written by the helpers.
- [x] Golden run and existing tests unchanged.

**Verification:** `npm test && npm run lint && npm run build`.
**Dependencies:** none
**Files:** `src/core/pool.ts`, `src/core/progression.ts` (if needed), `src/storage/`, tests
**Scope:** S

### Task K2: Start-screen switch and wiring
**Description:**
- "Meanings only" switch on the start screen; turning it on swaps in the mode's progress and log, uses the meaning-mode pool and the Built-in kanji list, turns sync and WaniKani off; turning it off reloads the owner's save.
- In the mode: no Study button or study cards; level picker without kana levels.

**Acceptance criteria:**
- [x] Browser check at 390×844 and 390×667, 3D (and one `?2d` run screenshot): switch on, place high, run shows only kanji with English answers, loss end screen without Study; switch off, owner's progress and session panel unchanged. Screenshots in the scratchpad. (The reveal is being removed outright, by the orchestrator.)
- [x] Tested or checked: no sync push/pull and no write to `kanji-runner:v1` while the mode is on.
- [x] Golden run and existing tests unchanged; deploy green.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** K1
**Files:** `src/main.ts`, `src/game/start.ts`, `src/game/render.ts`, `src/game/scenes.ts`, tests
**Scope:** M

### Checkpoint K: v1.7 (the owner and their wife, on her phone)
- [ ] She can turn the mode on, pick a level and play without seeing any Japanese besides kanji.
- [ ] The level feels right for her after a few runs (or note what to change).
- [ ] The owner's progress on their phone is unaffected.
