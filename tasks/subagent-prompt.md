# Subagent task prompt

How the orchestrator hands a task in the active task list to a subagent. One task at a time, each to a fresh background subagent, until the next owner checkpoint.

## Orchestrator rules

- **Model:** run subagents on `sonnet`. Use `opus` for a task with high data or design risk (the todo marks it "highest risk", or it needs judgment calls such as data cleaning or balance tuning), or when a Sonnet attempt comes back weak.
- Between tasks, verify the work yourself: clean tree and pushed, `npm test && npm run lint && npm run build` pass, look at a key screenshot. Put any issues into the next task's prompt.
- Contact the owner only for a blocking decision, or at the checkpoint (deployed and ready for the phone test). Then give a short report: what changed, what to check, rough edges.
- Owner ideas that come up mid-task go to `docs/ideas/`, not into a running task.

## Template

Fill in `<…>`. Put "State after Task <prev>" together from the previous subagent's report: the types, functions and flags this task builds on, and any issues found in review.

```
You are implementing **Task <N>: <title>** in /Users/parlux/Projects/number-runner (Vite + strict TS canvas game "Kanji Runner"). Work on `main`, push to `origin`.

**First, load the `incremental-implementation` skill (Skill tool) and follow it.** For browser checks, also load the `browser-test` skill.

## Read first
- `AGENTS.md`, `docs/specs/` (the active spec, <relevant sections>), the active task list (the **Task <N>** section is your scope).
- Code: <relevant files>.

## State after Task <prev>
<what exists now, what to build on, issues found in review>

## Task (from the active task list)
<description and acceptance criteria, copied>

## Notes
<owner constraints and checkpoint checks this task must make true; what is out of scope>

## Browser checks
Dev server: `npx vite --port 8765` (`vite preview` 404s). Live runs die between slow CLI calls, so render crafted states offscreen at 390×844 via `playwright-cli eval` with dynamic `/src/...` imports. Check: <list>. Save screenshots to the session scratchpad and list their absolute paths.

## Rules
- Thin slices; test each one; `npm test && npm run lint && npm run build` pass before every commit; commit and `git push` each slice. Messages like `... (Task <N>, slice M)`, ending with the Co-Authored-By line.
- Stay in scope. Tick only Task <N>'s acceptance criteria in the active task list, in the final slice.
- No committed probes or scratch scripts. Never commit raw KANJIDIC2/KRADFILE downloads or `.data-cache`.
- Finish with a clean tree, everything pushed<, and the deploy green if a checkpoint follows>.

## Report back (concisely)
Decisions, numbers (tests, balance/bot figures), screenshot paths, rough edges, final commit hash.
```

## Standing constraints

- Meaning labels must stay readable in narrowed openings (`GATE_MIN_W` 0.18, about 70 px on a 390-wide phone).
- Never commit the raw KANJIDIC2/KRADFILE downloads.
