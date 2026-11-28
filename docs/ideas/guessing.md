# Guessing on 2- and 3-option gates

Status: idea, 2026-11-28 (from the scheduler interview).

## Idea
Gates are multiple choice: rows 1–7 have 2 options, later rows 3. A blind guess is right 50% / 33% of the time, so "right 3 times running" (Learned) is luck 1 time in 8 on 2-option gates. That makes stages noisier than their names say.

## Options to weigh
- More options for in-progress items, or put them on 3-option rows (the scheduler places them early, i.e. on 2-option rows: a coupling to fix here).
- A right answer on a 2-option gate counts as less than a full step (changes the answer → box rule in `srs.ts`; the scheduler is untouched).
- A typed or recall-first answer for readings.

## Why it's separate
The scheduler (`docs/specs/SPEC-scheduler.md`) decides what and when; this changes how a gate is asked and what a right answer is worth.
