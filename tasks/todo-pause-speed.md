# Tasks: change speed from the pause screen

Spec: `docs/specs/SPEC-pause-speed.md` (2026-11-26). Intent: `docs/intent/pause-speed.md`. Started 2026-11-26. The owner waived spec approval: straight to the checkpoint. Version: next patch after `main`'s (own-stories round keeps 1.7.0).
Every task: `npm run check` passes before it is checked off.

### Task P1: Speed row on every pause screen (sonnet)
Pause panel always shown while paused (no-answer variant: title, row, hint); speed row as in the spec; canvas plain "Paused" text retired; patch bump and changelog line.
- [ ] Paused with a card: row under the card, current speed marked; speed tap saves and stays paused; tap elsewhere resumes.
- [ ] Paused before the first answer, and in Meaning mode: panel with title, row, hint.
- [ ] Screenshots at 390×844 of both, paths logged below.
- [ ] Patch version bumped; `CHANGELOG.md` line.
- [ ] `npm run check` passes.

### Checkpoint P: owner switches speed mid-run on the phone
- [ ] Pause, tap a speed, resume: the run moves at that speed; the next run starts at it. Owner ticks to close.
