# Intent: what you met, and what's in a level

Status: confirmed by the owner, 2026-11-28, after an interview at Checkpoint P (v1.8.0). Idea: `docs/ideas/done/run-items.md`. Spec: `docs/specs/done/SPEC-run-items.md`. Tasks: `tasks/done/todo-run-items.md`.

## Statement of intent
- **Outcome:** after a run you see every kanji and word you met and how the run moved it; in the progress view you can open any level and see exactly what's in it.
- **End screen:** title → level card → item list → buttons.
  - One compact row per item met: item, meaning, stage change ("大人 adult · Recalled → Learned").
  - Changed items first (new, steps up, slips), then unchanged items dim.
  - A miss shows as a slip to New, with the right answer on its row.
  - Stat tiles, the separate missed list and the session line go. The Study button stays for misses.
- **Progress view:** tap a level row → its 15 items (item, reading, meaning, both stages), unlearned first. Tap an item → its study card. Locked levels can be opened too (dim) to peek ahead. Tapping a past group expands it to its levels.
- **User:** the owner, daily, on the phone.
- **Why now:** with 15-item levels and stages (1.8.0), "what did I just learn and what's left in this level" is the question after a run; the session stats no longer answer it.
- **Success:** after a run you can say what you met and what moved without opening anything; "what's in Kanji 1" takes two taps.
- **Constraint:** a normal run's list fits at 390×844 without scrolling (scrolls if longer). No change to the rules, SRS or the progress save.
- **Out of scope:** per-run history across sessions, stats or charts, search, editing stages by hand.

## Decisions (and why)
| Decision | Reason |
|---|---|
| List every item met, changed first | Owner: "all, put the changed ones at the top". A run is ~14 rows plus re-asks, so ~12–16 items fit. |
| Show stage change, not game level | Owner confirmed: the stage move is what says a run got you closer to unlocking. |
| Drop stat tiles, session line, separate missed list | Owner: "the session stuff seems less important now"; misses live on as slips with the answer. |
| Level drill-down with study card | Owner: "what exactly is in Kanji 1"; the study card makes it a browsable reference. |
