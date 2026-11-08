# Tasks: Ask again (v1.2, WaniKani mode)

Spec: `SPEC-reask.md` (approved 2026-11-08, open questions at their defaults). Idea and interview: `docs/ideas/guessing-and-rust.md`. Starts after v1.1 Checkpoint E.
Every task: `npm test && npm run lint && npm run build` pass before it is checked off. Test fixtures are synthetic: never commit real WaniKani content.

## Plan
- **Pure first, wiring last.** The rules (`reask.ts`), the record update (`srs.ts`) and the sim substitution (`sim.ts`) are pure and tested before anything touches `scenes.ts`, so Checkpoint F1 proves the behaviour without a browser.
- **Off means identical.** Re-asks are an option on the run (a `ReaskConfig` or `null`). With `null` (Built-in mode, and every existing test) the sim, records and golden run are unchanged. This is the main guard for Built-in mode.
- **The track never changes.** A re-ask replaces a row's content and its openings only. Hazards, crates, packs, hit points and the boss stay as built at the start.
- **Start-of-run boxes are captured once,** when the run is built (`pool.box` per row), and used both for triggers and for the pair-aware record update. Seeded WaniKani boxes therefore work with no extra lookups.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| A replaced row pops in on screen | High | Substitute only rows beyond `VIEW_DISTANCE`; a property test over seeded tracks (R1) and a browser check (R4). |
| Built-in runs drift | High | Re-asks off by `null` config; golden run snapshot and every existing test unchanged (R3). |
| Record pairing bugs (double promotion, displaced item updated) | Med | Table tests for every row of the spec's pair table (R2). |
| Weak items climb too slowly with the "unchanged" rule | Med | Owner playtest at Checkpoint F; `REASK_MAX` is the first lever. |

## Phase 7: Ask again, pure core

### Task R1: Re-ask rules (pure)
**Description:**
- `src/core/reask.ts`: `isTrigger` (wrong, or right with start box ≤ `REASK_MAX_BOX`, never for a re-ask row), `pickTarget` (seeded random among eligible rows `REASK_GAP_MIN`–`REASK_GAP_MAX` ahead: unresolved, not a squad charge, not a re-ask, not the same key; `null` if none), and `reaskRow` (same item, type and shown reading; 3 options; fresh distractors by the pool's rules; random answer position).
- Constants in `tuning.ts`: `REASK_MAX = 3`, `REASK_MAX_BOX = 2`, `REASK_GAP_MIN = 3`, `REASK_GAP_MAX = 5`.
- Share row building with `run.ts` rather than duplicating it.

**Acceptance criteria:**
- [x] Trigger and target rules per the spec, including no target near the end of a run, the squad-charge exclusion and the same-key exclusion (tested).
- [x] Re-ask row: same item, type and shown reading, 3 options, distractor validity holds, and the answer's position is spread evenly and independent of the first ask's choice over many seeds (tested).
- [x] Over many seeded tracks, every row in a trigger's window starts beyond `VIEW_DISTANCE` when the trigger's wall resolves (tested).

**Verification:** `npm test -- reask`
**Dependencies:** v1.1 done
**Files:** `src/core/reask.ts`, `src/core/run.ts`, `src/core/tuning.ts`, `tests/core/reask.test.ts`
**Scope:** M

### Task R2: Pair-aware record update
**Description:** `recordRun` takes optional re-ask info: which rows are re-asks of which row, and each row's start-of-run box. A pair updates its item once, per the spec's table; a weak right answer with no re-ask leaves the box unchanged; counters (`seen`, `correct`, `wrong`) still count every answer. With no re-ask info, `recordRun` behaves exactly as now.

**Acceptance criteria:**
- [x] Every row of the spec's pair table, including a seeded start box and the army dying between the two asks (tested).
- [x] Counters count both answers; the displaced row's item gets no update (tested).
- [x] Without re-ask info, all existing `srs` and `srs-run` tests pass unchanged, including the v1 repeat rule (tested).

**Verification:** `npm test -- srs`
**Dependencies:** R1 (types)
**Files:** `src/core/srs.ts`, `src/core/reask.ts`, `tests/core/srs-reask.test.ts`
**Scope:** S

### Task R3: Re-asks in the sim
**Description:**
- `createRunState` takes an optional `ReaskConfig` (pool for row building, seed, start boxes, item keys per row). When a row resolves and it is a trigger, the cap allows and `pickTarget` finds a row, that row and its openings are replaced by `reaskRow`. The run state records re-ask links (for R2 and the summary) and how many have been used.
- With no config, `RunState` behaviour is unchanged.
- A WaniKani balance check: the bot over 200 seeded runs on a synthetic WaniKani list, with re-asks on.

**Acceptance criteria:**
- [ ] A miss at question q is asked again 3–5 rows later; the cap of 3 holds; the track (hazards, hit points, boss) is identical with and without re-asks; same seed and answers give the same run (tested).
- [ ] Without a config, the golden run snapshot and every existing sim, squad, fire and balance test pass unchanged (tested).
- [ ] With re-asks on a synthetic WaniKani list: 100% accuracy never dies early, and 50% dies early in at least half of 200 runs (tested).

**Verification:** `npm test`
**Dependencies:** R1, R2
**Files:** `src/core/sim.ts`, `src/core/reask.ts`, `tests/core/sim-reask.test.ts`, `tests/core/balance.test.ts`
**Scope:** M

### Checkpoint F1: the pure core works
- [ ] R1–R3 pass, Built-in mode is unchanged (golden run, all v1 and v1.1 tests, bot balance), and the WaniKani bot balance holds with re-asks on.

## Phase 8: Ask again in the game

### Task R4: Wire re-asks into WaniKani runs
**Description:**
- `scenes.ts`: WaniKani runs build a `ReaskConfig` from the pool; Built-in runs pass none. The end of a run passes the re-ask links and start boxes to `recordRun`.
- The summary lists a re-ask as its own question; study cards are unchanged.

**Acceptance criteria:**
- [ ] A WaniKani run in the browser: a missed kanji comes back 3–5 rows later as a 3-answer wall, with no pop-in of the replaced row (browser check with a synthetic WaniKani list, screenshots in the scratchpad).
- [ ] A Built-in run is unchanged: same seed, same rows (tested).
- [ ] After a WaniKani run, records follow the pair table (tested at the scene level with a synthetic list).

**Verification:** `npm test`. Browser check at 390×844. Deploy green.
**Dependencies:** R3
**Files:** `src/game/scenes.ts`, `src/game/render.ts`, `src/main.ts`, `tests/game/scenes.test.ts`
**Scope:** M

### Checkpoint F: v1.2 (owner, on the phone)
- [ ] Weak kanji keep coming back until they're known, and lucky guesses no longer feel like they count.
- [ ] Runs don't feel repetitive, and nothing pops in.
- [ ] Tune `REASK_MAX` (and revisit "a weak right with no re-ask stays put") from the owner's feedback.
