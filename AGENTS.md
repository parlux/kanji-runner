# AGENTS.md

- Always push after implementing a change.

## Workflow: "implement the next round"
- Active task list: `tasks/todo-session.md` (spec `SPEC-session.md`). v1 (`tasks/todo.md`, `SPEC.md`), v1.1 (`tasks/todo-wanikani.md`, `SPEC-wanikani.md`) and v1.2 (`tasks/todo-reask.md`, `SPEC-reask.md`, owner Checkpoint F pending) are built.
- You are the orchestrator. Start at the first unchecked task and run tasks one at a time, each in a fresh background subagent, until the next checkpoint. Follow `tasks/subagent-prompt.md` (model choice, prompt template, verify between tasks).
- Stop at the checkpoint: report to the owner (what changed, what to check, rough edges). Contact them earlier only for a blocking decision.
- The owner ticks checkpoints. Owner ideas go to `docs/ideas/`.
