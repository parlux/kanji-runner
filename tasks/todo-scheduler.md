# Tasks: a scheduler that makes things stick (v1.11.0)

Spec: `docs/specs/SPEC-scheduler.md` (2026-11-28). Intent: `docs/intent/scheduler.md`. Idea: `docs/ideas/scheduler.md`.
Review: https://claude.ai/artifact/RcZHffPYzfHUvpyATnFz3E
Runs while Checkpoints P and R wait on the owner's play; this is the active list for "implement the next round".
Every task: `npm run check` passes before it is checked off. Each task is one commit series on the session branch, pushed.

### Task S1: Due and the schedule (opus: core design)
Spec §1–2. `src/core/schedule.ts`: due/overdue/nearness, `schedule(rng, sel, now)`; tuning constants. Not wired into runs yet.
- [x] `schedule.test.ts` from the spec passes.
- [x] `npm run check` passes (knip: used by tests only until S2; mark or wire accordingly).

### Task S2: Wire it into runs; simulated days (opus: simulation)
Spec §2–3, "Testing". Built-in and Meaning modes use `schedule` with `now` from the scene; WaniKani mode unchanged; `Selection` loses `weight` where unused; golden and selection tests updated; simulated-days slow test with its report.
- [x] Simulated-days test passes; report (per-box median gaps, current-level share per run, slip return, levels finished in 30 days) in the task report.
- [x] `npm run test:slow` passes (changed expectations listed with reasons).
- [x] `npm run check` passes.

### Task S3: Ship 1.11.0 (sonnet)
Bump `package.json` to 1.11.0 and add `## 1.11.0 (<date>)` to `CHANGELOG.md` (owner words: what changes in a run).
- [x] `package.json` 1.11.0; `CHANGELOG.md` has the 1.11.0 section.
- [x] `npm run check` passes; deploy green.

### Checkpoint S: owner plays a few days
- [ ] In one session: runs are mostly your level; a missed item comes back next run.
- [ ] After a day away: some older items come back.
- [ ] Gaps feel right (too repetitive or too sparse → tune `GAP_BY_BOX`).
