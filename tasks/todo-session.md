# Tasks: Session progress (v1.3)

Spec: `docs/specs/SPEC-session.md` (2026-11-09). Idea and interview: `docs/ideas/session-progress.md`. Starts after v1.2 (runs alongside the owner's Checkpoint F playtest).
Every task: `npm test && npm run lint && npm run build` pass before it is checked off. Test fixtures are synthetic: never commit real WaniKani content.

## Plan
- **Pure first, wiring last.** The session rules (`src/core/session.ts`) are pure and tested before storage, scenes and rendering touch them.
- **Observe only.** The log reads a run's rows and results after it is recorded. Runs, records, selection, sync and the golden run are unchanged.
- **Naming:** the page-load object in `scenes.ts` is already called `Session`. The new type is `SessionLog`, carried as `Session.log`.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| End screen overflows on a phone with long lists | Med | `+k` truncation; browser check at 390×844 with long lists (S3). |
| Corrupt stored log breaks loading | Med | Separate key; loader never throws; tested (S2). |
| Idle rule surprises the owner | Low | `SESSION_IDLE_MINUTES` in `tuning.ts`; owner checkpoint. |

## Phase 9: Session progress

### Task S1: Session log rules (pure)
**Description:**
- `src/core/session.ts`: `SessionLog` type (start time, last run time, run count, per-key state in first-miss order, which keys became fixed in the latest run).
- `logRun(log | null, rows, results, now)`: applies the idle rule (new log if null or the gap exceeds `SESSION_IDLE_MINUTES`), then each answered row in order.
- `sessionLists(log)`: the panel's data: fixed and still-missing items (prompt, type, fixed-this-run flag), in first-miss order.
- `SESSION_IDLE_MINUTES = 30` in `tuning.ts`.

**Acceptance criteria:**
- [ ] Idle rule: within the limit continues, past it starts fresh, exactly at it continues (tested).
- [ ] States per the spec: missing, fixed, back to missing, right-only not listed, unanswered rows ignored, meaning and reading apart, first-miss order (tested).
- [ ] Fixed-this-run marks only items that changed from missing to fixed in the latest run, including a miss and its re-ask in the same run (tested).

**Verification:** `npm test -- session`
**Dependencies:** v1.2 done
**Files:** `src/core/session.ts`, `src/core/tuning.ts`, `tests/core/session.test.ts`
**Scope:** S

### Task S2: Store the log and update it after every run
**Description:**
- `src/storage/session.ts`: `loadSessionLog(store)` / `saveSessionLog(store, log)` under their own key; validate the shape; never throw.
- `scenes.ts`: `Session` gets `log: SessionLog | null`; `createSession` takes the stored log (a dev sandbox starts with null); `afterStep` calls `logRun` once when a run ends (win or loss), alongside `recordRun`.
- `main.ts`: load the log at start; save it after every run when `session.persist`. A dev sandbox never reads or writes it.

**Acceptance criteria:**
- [ ] Storage round trip; missing, corrupt or wrong-shaped data → null, never throws; `Progress` storage untouched (tested).
- [ ] `afterStep` updates the log exactly once per run, for wins and losses, in both modes; a dev sandbox ignores stored data (tested).
- [ ] Golden run and every existing test pass unchanged (tested).

**Verification:** `npm test`
**Dependencies:** S1
**Files:** `src/storage/session.ts`, `src/game/scenes.ts`, `src/main.ts`, `tests/storage/session.test.ts`, `tests/game/scenes.test.ts`
**Scope:** S

### Task S3: "This session" panel on the end screen
**Description:** `render.ts` `renderEnd`: a compact panel between the missed list and the Study button, per the spec (heading with run count, Fixed and Still missing lines, fixed-this-run in the good color, reading items after a dim `reading` label, `+k` overflow, empty state). The missed list's area shrinks to make room.

**Acceptance criteria:**
- [ ] Browser check at 390×844 with crafted end scenes: long fixed and missing lists (overflow shows `+k`), reading items, fixed-this-run highlighted, the empty state; the missed list, Study button and "Tap or Enter" line don't overlap (screenshots in the scratchpad).
- [ ] Also check a short screen (390×667) still fits.
- [ ] Deploy green.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** S2
**Files:** `src/game/render.ts`
**Scope:** S

### Checkpoint G: v1.3 (owner, on the phone)
- [ ] After a few lost runs, the panel makes it clear whether anything is sticking.
- [ ] A break of 30+ minutes starts a fresh session; a reload doesn't.
- [ ] Tune `SESSION_IDLE_MINUTES`, and decide whether the start screen should show the panel too.
