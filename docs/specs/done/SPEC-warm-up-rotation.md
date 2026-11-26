# Spec: rotate the warm-ups

Intent: `docs/intent/warm-up-rotation.md` (2026-11-25). Tasks: `tasks/done/todo-warm-up-rotation.md`. Extends the warm-up rule in `SPEC.md` ("Warm-ups") and `SPEC-wanikani.md` (warm-ups "as in v1"); where they disagree, this spec wins.

## Problem
Warm-ups (the first `WARM_UPS` = 3 questions) are the highest-box known items of the current level, ties at random. Answering a warm-up right keeps it at box 5, so once exactly 3 items sit at box 5 they are the warm-ups of every run.

## Rule
- **Candidates:** the known items that today's rule would draw from (current-level known items once there are ≥ 3 of them, else all known items), filtered to box ≥ `WARM_UP_MIN_BOX` = 3 (same value as `READING_UNLOCK_BOX`; a seeded box counts in WaniKani mode).
- **≥ 3 candidates:** the 3 with the oldest `lastSeen`. Ties (items answered in the same run share a timestamp) at random, by the run's rng. An item without a record (WaniKani-seeded) or with `lastSeen` 0 (placement) counts as oldest.
- **< 3 candidates:** today's rule unchanged: highest box first, ties at random.
- Everything else unchanged: warm-ups first and always wall gates, then new items shuffled among weighted known items, no repeats; same seed and progress give the same run.

## Code
- `Selection` (`src/core/pool.ts`) gains `lastSeen: (e: Entry) => number`: the record's `lastSeen`, else 0. Built-in, Meaning and WaniKani pools fill it.
- `select` (`src/core/run.ts`) applies the rule; `WARM_UP_MIN_BOX` in `src/core/tuning.ts`.
- No save-format, box or weight change.

## Tests
- Built-in: 6 current-level items at box ≥ 3 with distinct `lastSeen`: warm-ups are the 3 oldest, for every seed.
- Rotation: replaying runs where every answer is right (recording with `recordRun`), every strong current-level item is a warm-up within a few runs, and no item is a warm-up twice before all have had a turn.
- Fallback: with < 3 items at box ≥ 3, warm-ups are the highest-box items, as before.
- WaniKani: seeded strong kanji without records rotate in (count as oldest).
- Existing warm-up tests updated to the new rule; squad charges still never land on a warm-up.

## Out of scope
Fewer warm-ups, warm-ups from lower levels, the other 11 questions.
