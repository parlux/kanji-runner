# AGENTS.md

- Always push after implementing a change.
- Every fix and feat ships under a new version: fix = patch, round = minor (its final task bumps `package.json` and adds `## <version> (<date>)` to `CHANGELOG.md`). The deploy runs `scripts/check-version.sh`: once no `tasks/todo-*.md` is open, code changed since tag `v<version>` fails it. The deploy job pushes the tag.
- Every owner request to build, change, fix, audit or document something: load the `triage` skill first. It picks the flow (doc, fix, full SDD, idea).

## Workflow: "implement the next round"
- Active task list: the `todo-*.md` at the top level of `tasks/` (it names its spec and any baseline).
- You are the orchestrator. Start at the first unchecked task and run tasks one at a time, each in a fresh background subagent, until the next checkpoint. Follow `tasks/subagent-prompt.md` (model choice, prompt template, verify between tasks).
- Stop at the checkpoint: report to the owner as a checkpoint page (`docs/review-pages.md`): what to play, what changed, rough edges. Contact them earlier only for a blocking decision.
- The owner ticks checkpoints. Owner ideas go to `docs/ideas/`, listed in `docs/ideas/BACKLOG.md` (ordered; new ones at the bottom unless the owner places them). With no active task list, the next round starts from the top of the backlog. When an idea's round starts, move it to "In progress"; when it's archived to `done/`, drop it from the backlog.

## Layers (checked by `npm run deps`, part of `check`)
- `core/` imports only `core/` and `data/`.
- `storage/`, `sync/`, `wanikani/` never import `game/`.
- `audio/` never imports `game/`, `storage/`, `sync/` or `wanikani/`.
- Only `game/` imports `game/three/`; `main.ts` goes through `game/view3d.ts`.
- No import cycles. Type-only imports count.

## Open vs done
- Top level of `tasks/` and `docs/ideas/` = open. Finished = `done/` subfolder.
- Specs: same split, `docs/specs/` = open, `docs/specs/done/` = finished (later specs extend earlier ones, so links into `done/` are normal).
- When the owner ticks a round's final checkpoint: `git mv` its task list, idea(s) and spec(s) into `done/`, fix links.
