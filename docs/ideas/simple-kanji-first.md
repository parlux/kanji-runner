# Simple, common kanji first

Status: owner idea, 2026-11-17. Needs an interview.

## Idea
Like WaniKani, teach simple, useful kanji early instead of strictly by school grade. Today `orderKanji` (`scripts/build-data.ts`) sorts by grade, then newspaper frequency, then puts components first. Instead, blend frequency, stroke count and grade, so a common, simple grade-2 kanji can land in an early level.

Use open data only (KANJIDIC2). WaniKani's own level lists are proprietary and can't be copied (`docs/intent/kanji-runner.md`).

## Open questions
- This reorders every level and moves kanji you've already learned. Does that matter for existing progress and placement?
- The owner likes today's pace: keep the level size and the unlock rule as they are?
- How do we judge the new order? E.g. compare it locally with the owner's WaniKani levels (scratchpad only, nothing committed).
