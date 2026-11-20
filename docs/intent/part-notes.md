# Intent: a "why it fits" note per part, and names you can see

Status: confirmed by the owner, 2026-11-20, after an interview. Round: own stories (epic round 3), added during Checkpoint D. Spec: `docs/specs/SPEC-own-stories.md`, section "Part notes". Tasks: `tasks/todo-own-stories.md` (N1, N2).

## Statement of intent
- **Outcome:** each part on the review page shows a one-line note on why its name fits ("looks like stretched fingers reaching"), so the owner can judge before rejecting.
- **Renames first:** before re-seeding, an LLM pass over all 237 parts proposes a shape you can see for every part named after its history (⻏ "village" is the right-hand 阝, a squashed 邑 "town"). Changed parts show old name, new name and note.
- **Data:** the note is kept for good in `parts.json`. Renamed parts ripple into every story that uses them (the existing `apply` rename path).
- **Reviews so far:** verdicts on unchanged parts stand. The owner's ✗ notes on parts feed the rename pass; renamed parts come back once for a fresh look.
- **Success:** the owner can confirm or reject ⻏ and its kind without asking.
- **Out of scope:** notes on the in-game study card (separate idea); notes on stories (the story is the explanation); Kanji 1–4. Sounds already have a note (`sounds.json` `note`), shown on the page.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Rename to a visible shape, not keep the history name | Owner: "renamed to something you can see, definitely for shapes". |
| LLM pass before re-seeding, not the owner hunting | One click per part stays; the owner doesn't have to spot history names. |
| Note kept in `parts.json`, page-only for now | The study card is full at phone width; showing it there is a later idea. |
