# AGENTS.md

- Always push after implementing a change.

## Workflow: "implement the next round"
- Active task list: `tasks/todo-3d.md` (spec `docs/specs/SPEC-3d.md`). `tasks/todo-session.md` awaits owner Checkpoint G. `tasks/todo-stories.md` (spec `docs/specs/SPEC-stories.md`) is queued: start it only when the owner says so. `tasks/todo-reveal.md` (spec `docs/specs/SPEC-reveal.md`) is queued too.
- You are the orchestrator. Start at the first unchecked task and run tasks one at a time, each in a fresh background subagent, until the next checkpoint. Follow `tasks/subagent-prompt.md` (model choice, prompt template, verify between tasks).
- Stop at the checkpoint: report to the owner (what changed, what to check, rough edges). Contact them earlier only for a blocking decision.
- The owner ticks checkpoints. Owner ideas go to `docs/ideas/`.

## Open vs done
- Top level of `tasks/` and `docs/ideas/` = open. Finished = `done/` subfolder.
- Specs stay in `docs/specs/` (later specs extend earlier ones).
- When the owner ticks a round's final checkpoint: `git mv` its task list and idea(s) into `done/`, fix links.
