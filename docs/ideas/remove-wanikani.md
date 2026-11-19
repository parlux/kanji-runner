# Remove WaniKani from the game

Status: owner decision, 2026-11-20, during the own-stories interview. Needs an interview. Part of the [useful Japanese epic](useful-japanese.md); after [Our own stories](own-stories.md).

## Idea
Once our own story dictionary ships, remove every WaniKani feature from the game so the shared game has no WaniKani anywhere: the token field, the story fetch and on-device library, WaniKani mode (taught list, SRS seeding, similar kanji). The only WaniKani code left is the dev-only script that feeds the story judge.

## Where it lives today
- `src/wanikani/` (API, parse, stories), `src/game/wkstate.ts`, `src/game/ui/wanikani.ts`, `src/core/pool.ts` (WaniKani mode pool).

## Open questions
- Saves with WaniKani mode progress or a saved token: migrate or drop?
