# Review pages

Owner-facing HTML pages for a round, published as private claude.ai links with the Artifact tool. The md files stay the source agents work from; if a page and its md disagree, the md wins.

Example: the straight-fire spec page, https://claude.ai/artifact/EFKCvzghsaCHogg8jPnY4L.

## When
- **Spec page:** once the spec and task list are written, before orchestrating. The owner approves the spec on the page. Republish to the same link whenever the spec changes.
- **Checkpoint page:** when the orchestrator stops at a checkpoint, in place of a terminal report.
- Rounds without a spec (`fix`, `doc`, `idea`) get no page.

## How
- Start from `docs/review-pages/template.html`: copy it to the scratchpad, fill it in, publish. Keep its tokens and components; don't redesign.
- Put the link in the task list header: `Review: <spec url>`, plus `Checkpoint <X>: <url>` for each checkpoint page.
- Updating from a later session: read the page with the Artifact tool (`action: "read"`, the url), edit the saved file, publish with `url`.
- Write for the owner: plain words first, code names in `<code>` only where they help. Summary before detail.
- Only show numbers that are logged in the task list or spec; say where each table comes from.

## Spec page sections
1. Header: name, version pill, date, tasks done, one-paragraph summary, "md wins" note.
2. Why (the problem, from the idea).
3. What you'll see (user stories, plain words).
4. Diagram, when a rule is spatial or before/after (inline SVG, colors from tokens).
5. Rules as cards (one per spec section).
6. Numbers: tuning values and pass bands as tables.
7. Progress: tasks and the owner checkpoint.
8. Out of scope. Footer: source files and commit.

## Checkpoint page sections
1. Header: checkpoint name, build label (`vX · hash`), deploy status.
2. **Play this:** numbered steps on the phone, each with what to look for.
3. What changed: one line per task, with commit hashes.
4. Numbers: before/after tables, and an inline SVG bar chart with the pass band marked where there are balance or tuning numbers.
5. Screenshots, only when the round changes something visible: before/after at 390×844 (`browser-test` skill), embedded as JPEG `data:` URIs, ~100 KB each.
6. Rough edges and decisions made on the owner's behalf.
7. Your call: what ticking the checkpoint means, and the decisions waiting on the owner.
