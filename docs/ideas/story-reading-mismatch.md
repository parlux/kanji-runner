# Reading story doesn't match the reading shown

Status: raw owner idea, 2026-11-15. Not yet interviewed or specced.

## Idea
WaniKani's reading mnemonic covers only one reading (usually the one WaniKani teaches first, on'yomi or kun'yomi). The round may show the other reading, e.g. the story explains "genji" but the round asked for a different reading. The player then can't tie the story to what they saw.

## Open questions (for the interview)
- Show which reading the story is about (label it), so the mismatch is at least visible?
- Or prefer, in study/round, the reading WaniKani's story covers when one exists?
- Or both: tag the story's reading, and mark the round's reading as "no story".
- How do we detect which reading a story covers (WaniKani's `readings[].primary`, or matching the kana in the story text)?

Related: `docs/specs/done/SPEC-stories.md` (listed as a known rough edge, out of scope there).
