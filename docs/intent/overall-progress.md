# Intent: show overall progress, finish every level

Status: confirmed by the owner, 2026-11-27, after an interview. Idea: `docs/ideas/overall-progress.md`. Spec: `docs/specs/SPEC-overall-progress.md`. Tasks: `tasks/todo-overall-progress.md`.

## Statement of intent
- **Outcome:** levels you finish completely, and a view of where you are overall.
  - Levels of **15 kanji**, same order as today.
  - A kanji is **learned** when its meaning **and** its reading are both at box ≥ 2.
  - The next level unlocks only when **every** kanji of the level is learned.
  - The end-of-run card adds up at a glance ("11 / 15 learned · 4 more to unlock Kanji 10"), with no unexplained mark.
  - An overall view, opened from the start screen: "Kanji 9 of 143", a bar across all levels, every level's count, and travel-text coverage from the kanji you have **learned**. JLPT share is secondary.
- **User:** the owner, daily, Built-in mode.
- **Why now:** epic round 4 (`docs/ideas/useful-japanese.md`). The February WaniKani assessment needs a yardstick besides feel, and today's card reads as wrong (19 of 30 learned, 5 more to unlock: unlock was at 80%, never said).
- **Success:** a level takes about 3–4 days of play; the end card's numbers add up; in February the owner reads off N% coverage and compares it with WaniKani.
- **Constraint:** level numbers move (fine). No automatic save conversion: the owner sets their level by hand and plays through. Progression rule changes are in `core/`, tested.
- **Out of scope:** the kanji order, word gates counting toward a level, WaniKani mode, sound and feel, SRS weights and timing.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Unlock at 100%, not 80% | Owner: a level should be finished before moving on; the 80% rule was never visible and read as a bug. |
| Learned = meaning and reading at box ≥ 2 | Owner: box 2 on the meaning alone says nothing about the Japanese. Word gates stay out of the count. |
| 15 kanji per level, same order | Owner: a full clear of 30 with readings is too long; 15 is about 3–4 days of play. Only the slicing changes. |
| No save conversion | Owner: "I'm happy to manually drop it somewhere and play through." The existing "I already know some…" picker does it. |
| Coverage over JLPT | Owner: coverage ("can I read real stuff yet?") is the yardstick; JLPT is WaniKani's. |
