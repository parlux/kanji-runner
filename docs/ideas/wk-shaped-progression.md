# WaniKani-shaped progression from open data

Status: owner idea, 2026-11-17. Refined; needs an interview before a spec.

Owner: "Is it worth or possible to align the standard progression with WaniKani? e.g. the reading and order of teaching, including compound kanji. Ideally it would follow that progression even if someone is playing without WaniKani. If that's proprietary don't worry about it."

## Can we copy WaniKani's order?
No. WaniKani's level lists (which kanji are on which level, which reading it teaches first, which vocabulary goes with it) are its own curated content. The API terms let a user read their own data. They don't let an app ship that data to other players. Our boundary already says so (`docs/intent/kanji-runner.md`, SPEC-wanikani: no WaniKani content in the repo or the build). A table of WaniKani levels, even one built from the owner's account, would break it.

## What we can do: copy the principles, not the list
The order WaniKani uses rests on a few public principles. Each one can be built from open data (KANJIDIC2, KRADFILE, JMdict, all already used or freely licensed):

| WaniKani principle | Today | Open-data version |
|---|---|---|
| Parts before the kanji built from them | Done: component pass in `orderKanji` | Keep |
| Simple, useful kanji first, not school grade | Strict school grade, then newspaper frequency | Loosen grade into a blend of frequency, stroke count and grade (e.g. allow a grade-2 kanji in level 3 when it is common and simple) |
| Teach the reading used in the most vocabulary | First KANJIDIC on'yomi (`build-data.ts`) | Pick the reading (on or kun) that appears in the most common JMdict words using that kanji |
| Vocabulary comes right after its kanji | Gates test single kanji only | Unlock a compound (家具) once all its kanji are learned; see [Compound words as gates](compound-word-gates.md) |

With these changes, a player with no WaniKani account learns roughly the way WaniKani teaches, though the exact order still differs.

## Players who do use WaniKani
WaniKani mode already drills from the owner's own account at runtime, which is allowed. Nothing changes there.

## Is it worth it?
Partly. Ranked by value for effort:
1. **Reading choice** (high): teaching an obscure on'yomi first is a real cost today. One data-pipeline pass plus overrides, no game changes.
2. **Compound unlocks** (high): already planned as idea 5; this gives it a place in the progression.
3. **Grade blend** (medium/low): reorders every level. The owner said they like the current pace, and reordering moves already-learned kanji between levels (save/placement impact).

## Open questions for the interview
- Does reordering levels for existing progress matter, or are levels free to change?
- Should the taught reading switch to kun'yomi when kun is the more common one (e.g. 山 やま vs サン)? Gates and stories would follow.
- Measure first? We could compare our order with the owner's WaniKani levels locally (scratchpad only, nothing committed) to see how far apart they are.
