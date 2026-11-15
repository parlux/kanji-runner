# Reading story doesn't match the reading shown

Status: done in v1.2.0 (2026-11-15). Spec: `docs/specs/done/SPEC-reading-stories.md`. WaniKani story quotes removed at archive.

## Idea
WaniKani's reading mnemonic covers only one reading (usually the one WaniKani teaches first, on'yomi or kun'yomi). The round may show the other reading, e.g. the story explains "genji" but the round asked for a different reading. The player then can't tie the story to what they saw.

## Concrete examples (WaniKani API, 2026-11-15)
The round rotates the shown reading per run between the first on'yomi and first kun'yomi (`shownReading`, `src/core/distractors.ts`), so for any kanji with both, about half the runs show a reading the story doesn't cover.

| Kanji | Round shows (alternating) | WaniKani story covers |
|---|---|---|
| 上 above | じょう / うえ | じょう only |
| 日 sun | にち / ひ | にち only |
| 人 person | じん / ひと | にん, じん |

So a run showing 上 as うえ gets a story only about じょう. WaniKani teaches kun'yomi through vocabulary, which we don't fetch.

Detection looks easy: every story marks its reading as `<reading>Word</reading> (kana)`, so the kana in brackets says which readings the story covers.

## Open questions (for the interview)
- Show which reading the story is about (label it), so the mismatch is at least visible?
- Or prefer, in study/round, the reading WaniKani's story covers when one exists?
- Or both: tag the story's reading, and mark the round's reading as "no story".
- How do we detect which reading a story covers (WaniKani's `readings[].primary`, or matching the kana in the story text)?

Related: `docs/specs/done/SPEC-stories.md` (listed as a known rough edge, out of scope there).
