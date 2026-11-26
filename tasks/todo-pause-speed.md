# Tasks: change speed from the pause screen

Spec: `docs/specs/SPEC-pause-speed.md` (2026-11-26). Intent: `docs/intent/pause-speed.md`. Started 2026-11-26. The owner waived spec approval: straight to the checkpoint. Version: next patch after `main`'s (own-stories round keeps 1.7.0).
Checkpoint P: https://claude.ai/artifact/EhHkQ634HdBMcJDjHGAnB8
Every task: `npm run check` passes before it is checked off.

### Task P1: Speed row on every pause screen (sonnet)
Pause panel always shown while paused (no-answer variant: title, row, hint); speed row as in the spec; canvas plain "Paused" text retired; patch bump and changelog line.
- [x] Paused with a card: row under the card, current speed marked; speed tap saves and stays paused; tap elsewhere resumes.
- [x] Paused before the first answer, and in Meaning mode: panel with title, row, hint.
- [x] Screenshots at 390×844 of both, paths logged below.
- [x] Patch version bumped; `CHANGELOG.md` line.
- [x] `npm run check` passes.

Screenshots (390x844): paused before first answer (real run, speed Fast tapped, panel stays up) `/tmp/claude-0/-home-user-kanji-runner/6fa7822b-9809-5451-8fc7-d96fe02c33c3/scratchpad/p1-b-noanswer.png`, `/tmp/claude-0/-home-user-kanji-runner/6fa7822b-9809-5451-8fc7-d96fe02c33c3/scratchpad/p1-b-fast.png`; paused with a card (panel driven directly with a crafted last answer: gates die in about a second headless, so no real answered gate) `/tmp/claude-0/-home-user-kanji-runner/6fa7822b-9809-5451-8fc7-d96fe02c33c3/scratchpad/p1-a-card.png`, `/tmp/claude-0/-home-user-kanji-runner/6fa7822b-9809-5451-8fc7-d96fe02c33c3/scratchpad/p1-a-fast.png`. Meaning mode shares the no-answer variant (not browser-checked).

### Checkpoint P: owner switches speed mid-run on the phone
- [ ] Pause, tap a speed, resume: the run moves at that speed; the next run starts at it. Owner ticks to close.
