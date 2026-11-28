# Intent: a scheduler that makes things stick

Status: confirmed by the owner, 2026-11-28, after an interview (with a research check: spacing and testing effects, Cepeda 2006/2008, Karpicke & Roediger 2007, Kang et al. 2014, FSRS, Settles & Meeder 2016). Idea: `docs/ideas/scheduler.md`. Spec: `docs/specs/SPEC-scheduler.md`. Tasks: `tasks/todo-scheduler.md`.

## Statement of intent
- **Outcome:** items come back when they're due by real time since last answered; the mix between the current level and older levels falls out of what's due.
- **Gaps by box** (tuned at the checkpoint): Met → next run, Recalled ~1 h, Learned ~1 day, Strong ~4 days, Solid ~2 weeks. A miss still sends the item to New.
- **A run's 14 gates:** 3 warm-ups (due or near-due items at Learned+, own level preferred); current level's in-progress items (met, below Learned) up to ~8 slots, least recently seen first; due older items at least 3 slots when any are due, most overdue first; new items up to 4 only while fewer than ~8 current gates are in progress (≤ 2 words); the rest most overdue, then nearest to due.
- **Shape:** the scheduler is its own core module, swappable for FSRS later; the answer → box rule stays in `srs.ts`.
- **User:** the owner, daily, Built-in mode.
- **Why now:** measured 2026-11-28: of a run's ~7 weighted draws, only ~0.3–0.6 hit the current level, because hundreds of old gates outweigh it; in-progress current items starve, strong old items repeat within the hour.
- **Success:** within a session runs focus on the current level and a slipped item returns within a run or two; after days away older items return; simulation shows each box's items returning near their gap.
- **Constraint:** no save format change (box + lastSeen are enough).
- **Out of scope:** guessing on 2–3 option gates (own idea), FSRS itself, the learned rule, level size, UI.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Time-based due, not a fixed split | Owner asked for "the right approach, not the easy one". Forgetting is a function of time (Cepeda 2006/2008; HLR and FSRS model elapsed time); the best gap grows with strength; a fixed split re-asks strong items seen minutes ago. |
| Leitner-with-time now, FSRS later | FSRS assumes self-graded recall; our gates are multiple choice with guessing. Keep the scheduler swappable. |
| Guessing handled separately | Owner: fine if orthogonal. The scheduler decides what/when; the guessing fix changes how a gate is asked and what a right answer is worth (answer → box in `srs.ts`). Coupling noted in that idea. |
| Cap new items while much is in progress | Anki's practice (learning before new); keeps every in-progress item coming round within 2–3 runs. |
