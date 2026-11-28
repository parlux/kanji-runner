# Spec: a scheduler that makes things stick

Intent: `docs/intent/scheduler.md` (2026-11-28). Tasks: `tasks/todo-scheduler.md`. Replaces the Built-in run selection in `src/core/run.ts` (`select`: warm-ups, new items, weighted draw 2^(5 − box)) described in `docs/specs/done/SPEC.md` and later specs; where they disagree, this spec wins. Version: **1.11.0** (a round).

## Objective
Pick a run's gates by when each item is **due** (real time since last answered, by its box), with the current level's learning first. Today, of a run's ~7 weighted draws only ~0.3–0.6 land on the current level (measured 2026-11-28, placed saves at Kanji 5 and 20), so in-progress items starve while strong old items repeat within the hour. Success:
- Within a session, runs focus on the current level; a slipped item comes back within a run or two.
- After days away, older items come back, most overdue first.
- A simulated player's items come back near their box's gap.

## Background (research, checked 2026-11-28)
- Retrieval practice and distributed practice are the two "high utility" techniques (Dunlosky et al. 2013; testing effect: Roediger & Karpicke 2006).
- The best gap between reviews grows with how long you need to remember: ~10–20% of the retention interval for weeks, ~5% for a year (Cepeda et al. 2006, 2008).
- Expanding vs equal gaps: mixed; expanding helps short-term, long-term about equal (Karpicke & Roediger 2007; Kang et al. 2014). What matters is effortful recall at a gap that grows with strength.
- Data-fitted schedulers (Duolingo HLR, Settles & Meeder 2016; FSRS, Ye et al. 2022) model elapsed time. Box → gap here is Leitner-with-time, a product choice, tuned at the checkpoint and swappable for FSRS later.

## 1. Due (core, new module `src/core/schedule.ts`)
- `GAP_BY_BOX` (in `tuning.ts`, ms): box 0 → 0 (always due), 1 (Met) → 0 (due next run), 2 (Recalled) → 1 h, 3 (Learned) → 1 day, 4 (Strong) → 4 days, 5 (Solid) → 14 days.
- An item gate with a record is **due** at `lastSeen + GAP_BY_BOX[box]`; **overdue by** `now − due` (≥ 0 when due). **Nearness** for not-yet-due items: `(now − lastSeen) / gap` (1 = due).
- A gate without a record is **new**. Placement records (`seen` 0, `lastSeen` 0) count as long overdue: they are known and due, oldest first. To stop placement flooding runs, they rank after every gate that has been answered (`seen > 0`) and is due.
- `now` comes into run building from the caller (`Date.now()` in `scenes.ts`); everything stays pure and seedable (`now` + seed → same run).

## 2. Picking a run (Built-in and Meaning modes)
`schedule(rng, sel, now)` replaces `select` for Built-in and Meaning modes (WaniKani mode keeps today's selection with `WK_DUE_BOOST`). The `Selection` interface gains what it needs (box, lastSeen, seen, current, known) — no more `weight`. Rows, in order, 14 in all (`ROWS_PER_RUN`):
1. **Warm-ups** (`WARM_UPS` 3, wall gates as today): gates at box ≥ `WARM_UP_MIN_BOX` (3) that are due or nearest to due, current level first; with fewer, the highest boxes (as today).
2. Then, shuffled together:
   - **In progress** (`LEARNING_SLOTS` 8): current-level gates that have been answered (`seen > 0`) and are below box 3, least recently seen first.
   - **Due older** (`DUE_MIN_SLOTS` 3): when any gate outside the current level is due, at least this many (or all of them, if fewer), most overdue first; placement records after answered ones.
   - **New** (up to `MAX_NEW_PER_RUN` 4, at most `MAX_NEW_WORDS_PER_RUN` 2 words, progression order as today): only while the current level has fewer than `NEW_WHEN_LEARNING_UNDER` 8 gates in progress (counting those picked above).
   - **The rest:** remaining due gates, most overdue first (current level and older alike), then gates nearest to due (highest nearness), then anything known by lowest box.
- No gate twice in a run, except the early-game fallback when the pool is smaller than a run (as today, weighted by box).
- Reading gates still open at meaning box ≥ 3, words at their kanji learned (unchanged pool rules).
- Re-asks (in-run re-ask after a right answer at box ≤ 2) are unchanged; they come on top of the 14 as today.
- The order within the shuffled block is random by seed, as today.

## 3. Boundaries with other rules
- The answer → box rule (`review`, `recordRun` in `srs.ts`) is untouched; the guessing idea (`docs/ideas/guessing.md`) may change it later without touching the scheduler.
- What counts as learned, the 15-item levels, and the UI are unchanged.
- No save format change: box and lastSeen are enough.

## Commands
`npm run check` before every tick; `npm run check:fast` per slice; `npm run test:slow` after S2 (simulations).

## Project structure
- `src/core/schedule.ts` (new), `src/core/tuning.ts` (`GAP_BY_BOX`, `LEARNING_SLOTS`, `DUE_MIN_SLOTS`, `NEW_WHEN_LEARNING_UNDER`), `src/core/run.ts` (`select` → `schedule` for Built-in/Meaning; `now` through `buildRun`/`poolRun`), `src/core/pool.ts` (`Selection` without `weight` where unused), `src/game/scenes.ts` (pass `Date.now()`).
- Tests: `tests/core/schedule.test.ts` (new), selection/run tests and the golden run snapshot updated, a simulated-days test.

## Testing
- `schedule.test.ts`: due/overdue/nearness per box; placement records rank after answered due gates; warm-ups prefer current level and due; in-progress gets up to 8, least recent first; due older gets ≥ 3 when due exist; new only while in-progress < 8, ≤ 2 words; rest ordered by overdue then nearness; no duplicates; same seed + now → same run; tiny pool fallback.
- **Simulated days** (slow test): a bot answers right with probability by box (e.g. 0.6 at box 0 rising to 0.95 at box 5), plays 5 runs in a session, one session a day, for 30 days from a placed save. Report and assert: a slipped item returns within 2 runs; ≥ 6 of 14 gates on the current level in a session's later runs; median gap per box within ×0.5–×3 of `GAP_BY_BOX` for boxes 3–5; levels finished over the 30 days (reported, not asserted).
- Existing `test:slow` simulations still pass or are updated with a stated reason.

## Boundaries
- Always: keep the save format; keep WaniKani mode's selection; `npm run check` green; commit and push each slice.
- Ask first: changing the answer → box rule, `ROWS_PER_RUN`, option counts, or the learned rule.
- Never: rewrite the owner's progress.

## Success criteria
- Tests above pass; `npm run check` and `test:slow` pass; deploy green.
- On the phone (checkpoint): runs in a session are mostly the current level; a missed item comes back next run; after a day away some older items come back.

## Out of scope
Guessing on 2–3 option gates (`docs/ideas/guessing.md`); FSRS; the learned rule; level size; UI; WaniKani mode's selection.

## Open questions
- Gap values are a first guess from the research's shape (not its numbers); tuned at the checkpoint from play and the simulation report.
