---
name: triage
description: Routes every owner request for a feature, fix, change, audit or doc edit to the right flow before any work starts — direct fix, full SDD (interview-me → spec → tasks → implement), or filing an idea. Use FIRST whenever the owner asks for something to be built, changed, fixed, audited or documented, with or without a prefix like "fix:" or "feat:", even if it sounds small. Not for questions, explanations, or "implement the next round" (that flow is already decided).
---

# Triage

Pick the flow for an owner request. The owner does not want to decide this themselves.

**Core rule: skipping SDD on something complex is much worse than doing SDD on something easy.** When in doubt, route to SDD.

## Routes

| Route | When | Flow |
|---|---|---|
| `doc` | Only docs, comments, copy in `docs/`, `AGENTS.md`, `CHANGELOG.md`, `tasks/` | Edit, commit, push. |
| `fix` | **All** of the fix checks below hold | Fix directly (see Fix flow). |
| `sdd` | Any fix check fails, or you are unsure | `interview-me` → intent in `docs/intent/` → `spec-driven-development` → `planning-and-task-breakdown` → `tasks/todo-*.md` → spec page (`docs/review-pages.md`), owner approves → orchestrate to the first checkpoint (AGENTS.md). |
| `idea` | "Maybe", "someday", "what if", not a request to act now | Write `docs/ideas/<slug>.md`; append `N. [Title](<slug>.md): <area>; <one-line why>.` to `docs/ideas/BACKLOG.md` (bottom unless the owner places it); commit, push. Name the position in the reply so the owner can reorder. |

A prefix from the owner (`doc:`, `fix:`, `feat:`/`sdd:`, `idea:`) overrides classification. `feat:` means `sdd`.

## Fix checks (all must hold, else `sdd`)

1. **Clear outcome.** You can state the expected behaviour in one sentence and the owner would agree without discussion.
2. **Known or quickly findable cause.** If the cause is unknown, investigate first (read code, reproduce). Re-triage once you know it.
3. **Narrow.** About 5 files or fewer, one concern, no new concepts or settings.
4. **No judgment calls.** No balance or difficulty tuning, no choices across many data items, no look-and-feel calls that need the phone to judge, no new dependencies or data sources.
5. **No change to `core/` simulation, spaced repetition or save format.** A single data correction (one kanji entry, one override) is fine.

Several requests in one message: triage each separately.

## Announce, then act

Start your reply with one line, then start the flow without waiting (except `sdd`):

```
Triage: <route> — <reason in ≤15 words>. Say "sdd" / "just fix it" to override.
```

- `doc`, `fix`, `idea`: proceed immediately.
- `sdd`: wait for the owner's go before starting the interview.
- Override from the owner: switch, and log it.

## Fix flow

- If one detail is ambiguous, ask 1–2 questions first (not a full interview).
- If a subagent is running a round, don't commit in the shared tree: queue the fix or use a worktree.
- Implement with `incremental-implementation`; `npm run check` passes; commit, push.
- Bump the patch version in the same commit: `npm version patch --no-git-tag-version`, and add a `## <version> (<date>)` section at the top of `CHANGELOG.md` with one line for the fix. No `Unreleased` section. During an open round, bump anyway. The deploy fails without a bump (`scripts/check-version.sh`).
- **Escalate, don't expand:** if the fix grows past the checks (more files, a systemic cause, e.g. the data pipeline picks wrong readings for many kanji), stop and report the pattern. Propose `sdd` for the wider job; finish only the original narrow fix if it still stands alone. If the owner defers the wider job, file it via the `idea` route.

## Log

Append one row to `docs/triage-log.md` for every triage: date, request (short), route, reason, override (if any). Overrides are the signal to tune these rules; turn them into eval cases in `evals/evals.json`.

## Examples

- "Village keeps coming up as 'ri'" → `fix`: one data entry, clear outcome. Escalate if many kanji share the cause.
- "Audit readings against WaniKani to align core readings" → `sdd`: many items, judgment on each mismatch.
- "Make the run feel faster" → `sdd`: outcome unclear, feel judgment.
- "The gate label overlaps on narrow screens" → `fix` if the cause is found and the fix is local; `sdd` if it needs a layout rethink.
