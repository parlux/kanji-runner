# Spec: Session progress (v1.3)

Extends `docs/specs/SPEC.md` (v1), `docs/specs/SPEC-wanikani.md` (v1.1) and `docs/specs/SPEC-reask.md` (v1.2). Everything there still holds unless this spec says otherwise. Idea and interview: `docs/ideas/session-progress.md`.

## Objective
Show the owner, after every run, what they have fixed so far in the current sitting, even when the run was lost.

### Why
The owner is relearning and loses most runs. A loss shows only what was missed, so there is no sign that anything is sticking. The unit that matters is a sitting (a "session") of any length, from 1 run to 10+, not a single run.

### User stories
- As the player, after any run I see which items I've fixed this session (missed earlier, right since) and which are still missing.
- As the player, I see what this run fixed, so a lost run can still feel like progress.
- As the player, I do nothing to start or end a session: coming back after a break starts a fresh one.

## Rules

### What a session is
- A session starts with the first run after an idle gap, and runs until there have been no runs for `SESSION_IDLE_MINUTES` (30).
- The gap is measured from the end of the last run to the end of the current run (the moment its answers are recorded). If the gap exceeds the limit, the current run starts a new session.
- No button, and no reset on reload: a reload inside the gap continues the session.
- Both modes (Built-in and WaniKani) share one session; switching modes does not reset it. Item keys are already shared between modes.

### What is tracked
- Per item key (`水:meaning`, `水:reading`, `あ:meaning`), the same keys as `Progress`. Kana and kanji count the same.
- Every answered row counts, in row order, across all runs of the session: wall gates, squad charges and re-asks. Unanswered rows (the army died first) don't count.
- **Missing:** the item's last answer this session was wrong.
- **Fixed:** the item was wrong at least once this session, and its last answer this session was right.
- Items that were never wrong this session are not listed.
- A fixed item answered wrong again goes back to missing. Answered right again, it stays fixed.
- **Fixed this run:** fixed items that became fixed during the latest run (their state changed from missing to fixed in it, including a miss and a re-ask in the same run).

### Where it is shown
- On the end screen, after every run (won or lost), as a compact "This session" panel between the missed list and the Study button. The missed list shrinks to make room.
- The panel shows:
  - A heading: `This session · run N` (N = runs in this session so far).
  - `Fixed (n)`: the characters, in the order they were first missed. Fixed-this-run characters are drawn in the "good" color; the others in normal text.
  - `Still missing (n)`: the characters, in the order they were first missed.
  - Reading-gate items are listed after the meaning and kana items in their group, after a small dim `reading` label, e.g. `Fixed (3): 水 火 · reading 山`.
  - Each group wraps onto up to 3 lines (`SESSION_PANEL_MAX_LINES`); continuation lines start at the left gutter. The `reading` label may start a line but never ends one. When items still don't fit, only the last line ends with `+k`. The panel grows with the lines used and the missed list shrinks to match.
  - When both groups are empty (no misses yet this session), one dim line: `No misses this session`.
- Nothing else changes: the start screen, run, boss and study screens stay as they are.

### Storage
- The session is stored on this device under its own `localStorage` key, separate from `Progress`. It is not synced, and not part of `Progress`, the merge or the schema version.
- Corrupt or unreadable session data starts a fresh session; it never throws and never touches `Progress`.
- A dev `?level=N` sandbox keeps its session in memory only and never reads or writes the stored one.

### Tuning (`tuning.ts`)
`SESSION_IDLE_MINUTES = 30`.

## Project Structure (additions)
```
src/core/
  session.ts      → pure: session log type, update from a run (idle rule, fixed/missing), the panel's lists
src/storage/
  session.ts      → load/save the session log (never throws)
```
Touches `scenes.ts` (the page `Session` carries the log; `afterStep` updates it), `main.ts` (load and save), `render.ts` (the end screen panel), `tuning.ts`.

## Commands
Unchanged: `npm test`, `npm run lint`, `npm run build`, `npx vite --port 8765`.

## Code Style
As `docs/specs/SPEC.md`: strict TS, pure functions in `src/core`, constants in `tuning.ts`, short doc comments that state the rule.

## Testing Strategy
- **Idle rule:** a run within 30 minutes of the last continues the session; one after starts a new one (run count resets, lists empty); exactly at the limit continues.
- **States:** wrong → missing; wrong then right (same run or a later run) → fixed; fixed then wrong → missing; right only → not listed; fixed-this-run marks only items that changed in the latest run; order is first-miss order; unanswered rows ignored; meaning and reading keys tracked apart.
- **Storage:** round trip; missing, corrupt or wrong-shaped data gives a fresh session and never throws; `Progress` storage untouched.
- **Wiring:** `afterStep` updates the log once per run, for wins and losses; a dev sandbox never saves it; Built-in and WaniKani runs share it.
- **Browser check** at 390×844: the end screen with a panel holding a long fixed list, a long missing list, reading items, and the empty state; the missed list and Study button still fit.

## Boundaries
- **Always:** keep the session log out of `Progress` and sync; keep runs, records and selection unchanged (the log only observes).
- **Ask first:** showing the panel anywhere other than the end screen; changing the idle limit's meaning; letting the session affect item selection.
- **Never:** let corrupt session data break loading or touch `Progress`.

## Success Criteria
1. After any run, the end screen shows this session's fixed and still-missing items per the rules (tested).
2. A 30+ minute gap starts a fresh session; a reload doesn't (tested).
3. Runs, records, selection, sync and the golden run are unchanged (tested).
4. **Owner checkpoint:** on the phone, after a few lost runs, the panel makes it clear whether anything is sticking.

## Out of Scope (v1.3)
Trends across days or sessions; accuracy percentages; Leitner box stats; a manual "new session" button; syncing the session across devices; a session panel on the start screen; using the session to steer item selection.

## Open Questions
1. **Idle limit:** 30 minutes is a starting guess. Tune it from use.
2. **Where else to show it:** the start screen could show the panel between runs. Left out until the owner asks.
