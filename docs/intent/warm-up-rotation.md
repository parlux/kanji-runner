# Intent: rotate the warm-ups

Status: confirmed by the owner, 2026-11-25, after an interview. Spec: `docs/specs/SPEC-warm-up-rotation.md`. Tasks: `tasks/todo-warm-up-rotation.md`. The owner waived spec approval: straight to the checkpoint.

## Statement of intent
- **Outcome:** a run still opens with 3 questions you can answer, but they rotate through all the strong current-level items instead of being the same 3 every run.
- **User:** the owner, Built-in mode at Kanji 5. Meaning and WaniKani modes share the warm-up rule, so they rotate too.
- **Why now:** 3 kanji reached box 5 and own the warm-up slots: they are over-drilled while the rest of the level lags.
- **Success:** over several runs the first 3 questions change, each strong item taking its turn, the longest-unseen first. Warm-ups are still wall gates.
- **Rule:** warm-ups are current-level items at box ≥ 3, the 3 least recently seen. Fewer than 3 such items: today's rule (highest box first).
- **Constraint:** no change to boxes, weights, the new-items cap or the save format.
- **Out of scope:** fewer warm-ups, warm-ups from lower levels, the other 11 questions.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Keep 3 warm-ups | Owner: the easy start while settling into the controls is worth keeping. |
| Box ≥ 3 counts as strong | Owner agreed: the game's existing "known" line (reading unlock); big enough pool to rotate, still easy. |
| Least recently seen first | Rotation becomes spaced review of strong items, not a random repeat. |
