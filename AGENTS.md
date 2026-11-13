# AGENTS.md

- Always push after implementing a change.

## Workflow: "implement the next round"
- Active task list: `tasks/todo-reveal.md` (v1.6, in progress). Done: v1.3 session, v1.4 3D + camera, v1.5 stories (all in `tasks/done/`). Spec `docs/specs/SPEC-reveal.md`.
- You are the orchestrator. Start at the first unchecked task and run tasks one at a time, each in a fresh background subagent, until the next checkpoint. Follow `tasks/subagent-prompt.md` (model choice, prompt template, verify between tasks).
- Stop at the checkpoint: report to the owner (what changed, what to check, rough edges). Contact them earlier only for a blocking decision.
- The owner ticks checkpoints. Owner ideas go to `docs/ideas/`.

## Open vs done
- Top level of `tasks/` and `docs/ideas/` = open. Finished = `done/` subfolder.
- Specs: same split, `docs/specs/` = open, `docs/specs/done/` = finished (later specs extend earlier ones, so links into `done/` are normal).
- When the owner ticks a round's final checkpoint: `git mv` its task list, idea(s) and spec(s) into `done/`, fix links.
