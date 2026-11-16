# Our own stories, no WaniKani needed

Status: owner idea, 2026-11-17. Needs an interview.

## Idea
Create our own stories so the game no longer needs WaniKani at all.

## Open questions
- WaniKani is used for more than stories today; what replaces each use? Found in the code:
  - Stories: meaning and reading mnemonics, radicals, single-kanji vocab stories (`src/wanikani/stories.ts`).
  - WaniKani mode: the taught kanji list from the player's account, SRS stages seeding boxes, due reviews, visually similar kanji (`src/core/pool.ts`, `src/game/wkstate.ts`).
