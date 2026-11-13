# Tasks: summary screen (v1.9)

Spec: `docs/specs/SPEC-summary.md` (2026-11-13). Idea and mockup: `docs/ideas/summary-screen.md`. Started 2026-11-13 (owner go), in parallel with v1.8 scenery on main.
Every task: `npm test && npm run lint && npm run build` pass before it is checked off.

## Phase 15: Summary screen

### Task E1: Best streak and level-card data (pure)
**Description:**
- `RunState` tracks the run's best streak (`src/core/sim.ts`).
- `afterStep` keeps the level state before the run beside `unlocked`; a pure helper returns the level card's numbers for the end screen: level, learned, total, needed, gained this run, unlocked level or null, last level or not.
- The wiped-out gate number and "gate N of M" from the run state.

**Acceptance criteria:**
- [x] Tested: best streak (none right, longest not last, with re-asks).
- [x] Tested: card numbers for +N, no gain, an unlock, the last level, meaning mode.
- [x] Golden run and existing tests unchanged.

**Verification:** `npm test && npm run lint && npm run build`.
**Dependencies:** none
**Files:** `src/core/sim.ts`, `src/core/progression.ts` (helper, if it fits there), `src/game/scenes.ts`, tests
**Scope:** S

### Task E2: New end screen and buttons
**Description:**
- Redraw `renderEnd` in `src/game/render.ts` to the spec's layout: result, level card, stat tiles, missed rows, session line, buttons. Seed and "Tap or Enter to continue" go.
- Buttons: Play again (Enter/Space), Study (S, only when offered), Home (Escape); hit rects beside `studyButton` in `src/game/start.ts`; tap handling in `src/main.ts`; a stray tap does nothing.

**Acceptance criteria:**
- [ ] Tested: button hit rects at 390×844 and 390×667, with and without Study.
- [ ] Browser check, 390×844 and 390×667, 3D plus one `?2d`: win with 2 misses, wiped out with 5+ misses, a tie, an unlock, meaning mode. No overlaps; each button goes to the right place by tap and key. Screenshots in the scratchpad.
- [ ] Golden run and existing tests unchanged apart from end-screen expectations; deploy green.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** E1
**Files:** `src/game/render.ts`, `src/game/start.ts`, `src/game/scenes.ts`, `src/game/input.ts`, `src/main.ts`, tests
**Scope:** M

### Checkpoint E: v1.9 (owner, on their phone)
- [ ] The level card makes it clear how close the next level is, after wins and losses.
- [ ] Play again / Study / Home feel right; no accidental exits.
- [ ] Nothing feels missing from the old screen (or note what to bring back).
