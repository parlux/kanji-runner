# Intent: show the other half after a right answer

**Dropped by the owner, 2026-11-13:** after trying it, the reveal was too hard to read quickly mid-run, and the other half is already on the pause screen. The code was reverted (R1 commits 269153c, 1c03a2e, 72b8f68); this doc is kept as a record.

Status: confirmed by the owner, 2026-11-13, after an interview. Extends `docs/intent/kanji-runner.md`. Idea: `docs/ideas/done/answer-reveal.md`. Spec: `docs/specs/done/SPEC-reveal.md`, tasks: `tasks/done/todo-reveal.md`.

## Statement of intent
- **Outcome:** after every right kanji answer, a small pop-up near the army shows the kanji whole with the half that wasn't asked: a meaning gate (水 → water) shows its readings (みず · すい); a reading gate (水 → すい) shows its meaning (water).
- **User:** the owner, playing several runs back to back on the phone.
- **Why:** every right answer should reinforce the other half of the kanji for free, without stopping the run.
- **Success:** in a run, each right kanji answer flashes the other half for about a second, readable at a glance, and it never covers the next prompt or answers.
- **Constraint:** main readings only (as the study screen and summary use), kun'yomi and on'yomi told apart by colour or order, not labels. Both 3D and `?2d`. Gameplay and scoring unchanged.
- **Out of scope:** pop-ups after wrong answers (the study screen covers them); kana and loanword gates; components or mnemonics in the pop-up.
