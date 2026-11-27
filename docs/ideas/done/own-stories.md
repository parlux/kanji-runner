# Our own stories, no WaniKani needed

Status: done, 2026-11-27 (shipped in 1.7.0; started 2026-11-20). Intent `docs/intent/own-stories.md`, spec `docs/specs/done/SPEC-own-stories.md`, tasks `tasks/done/todo-own-stories.md`. Round 3 of the [useful Japanese epic](../useful-japanese.md).

## Idea
Create our own stories so the game no longer needs WaniKani at all.

## Open questions
- WaniKani is used for more than stories today; what replaces each use? Found in the code:
  - Stories: meaning and reading mnemonics, radicals, single-kanji vocab stories (`src/wanikani/stories.ts`).
  - WaniKani mode: the taught kanji list from the player's account, SRS stages seeding boxes, due reviews, visually similar kanji (`src/core/pool.ts`, `src/game/wkstate.ts`).
