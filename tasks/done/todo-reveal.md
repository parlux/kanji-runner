# Tasks: the other half after a right answer (v1.6)

**Dropped by the owner, 2026-11-13:** after trying it, the reveal was too hard to read quickly mid-run, and the other half is already on the pause screen. The code was reverted (R1 commits 269153c, 1c03a2e, 72b8f68); this doc is kept as a record.

Spec: `docs/specs/done/SPEC-reveal.md` (2026-11-13). Intent: `docs/intent/answer-reveal.md`. Idea: `docs/ideas/done/answer-reveal.md`. Started 2026-11-13.
Every task: `npm test && npm run lint && npm run build` pass before it is checked off.

## Phase 12: Answer reveal

### Task R1: Reveal text (pure) and pop-up in 3D and 2D
**Description:**
- A pure function (in `src/core/` beside `missedItems`, or `src/game/`) from the answered row, the run's kanji data and whether it was right to the reveal: the kanji plus either its main readings (in order, each with its kind for colouring) or its meaning; nothing for wrong answers, kana, loanwords or unknown kanji.
- Draw it near the army in the shared answer-feedback code (`renderArmyPopups` in `render.ts`, used by the 3D overlay too), for `ANSWER_FEEDBACK_DIST`, fading out; placed per the spec so it never covers the next prompt or labels.

**Acceptance criteria:**
- [ ] Tested: meaning gate → readings (order and kinds), reading gate → meaning, wrong / kana / loanword / unknown → nothing.
- [ ] Browser check at 390×844 in 3D and with `?2d` (and 1280×800 in 3D): right meaning answers (on'yomi + kun'yomi, okurigana), a right reading answer, a wrong answer, a long meaning; the next prompt and labels uncovered. Screenshots in the scratchpad.
- [ ] Golden run and existing tests unchanged.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** none
**Files:** `src/core/run.ts` (or a new pure module), `src/game/render.ts`, tests
**Scope:** S

### Checkpoint R: v1.6 (owner, on the phone)
- [ ] After a right kanji answer the other half shows near the army, readable at a glance.
- [ ] It never gets in the way of the next question.
