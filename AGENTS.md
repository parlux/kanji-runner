# AGENTS.md

- Always push after implementing a change.

## Workflow: "implement the next round"
- Active task list: `tasks/todo-session.md` (spec `docs/specs/SPEC-session.md`). v1 (`tasks/done/todo.md`, `docs/specs/SPEC.md`), v1.1 (`tasks/done/todo-wanikani.md`, `docs/specs/SPEC-wanikani.md`) and v1.2 (`tasks/todo-reask.md`, `docs/specs/SPEC-reask.md`, owner Checkpoint F pending) are built.
- You are the orchestrator. Start at the first unchecked task and run tasks one at a time, each in a fresh background subagent, until the next checkpoint. Follow `tasks/subagent-prompt.md` (model choice, prompt template, verify between tasks).
- Stop at the checkpoint: report to the owner (what changed, what to check, rough edges). Contact them earlier only for a blocking decision.
- The owner ticks checkpoints. Owner ideas go to `docs/ideas/`.

## Layout: open vs done
- Open work sits at the top level: `tasks/`, `docs/ideas/`. Finished work moves to `tasks/done/` and `docs/ideas/done/`.
- Specs live in `docs/specs/` and stay there: each later spec extends the earlier ones.
- When the owner ticks a round's final checkpoint, `git mv` its task list and its idea file(s) into `done/` and fix links to them.
