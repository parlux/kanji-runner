# Intent: teach the most useful reading first

Status: confirmed by the owner, 2026-11-17, after an interview. Idea: `docs/ideas/reading-choice.md`. Spec: `docs/specs/SPEC-reading-choice.md`.

## Statement of intent
- **Outcome:** each kanji teaches its most-used on'yomi and its most-used kun'yomi, counted from common JMdict words, instead of whichever KANJIDIC2 lists first. Data build only, plus a small overrides file for odd cases.
- **User:** the owner, mid-run, on reading gates (明, 図…).
- **Why now:** some taught readings are rare ones (明 あ(かり), 図 え) that don't match what the owner knows from WaniKani.
- **Success:** a checkpoint page lists every kanji whose taught reading changed, old → new with word counts; it reads right against the owner's WaniKani sense, and misses become overrides. In a run, gates show readings like あか(るい) and はか(る).
- **Constraint:** open data only (KANJIDIC2, JMdict); nothing copied from WaniKani. Progress carries over (SRS is keyed per kanji, not per reading string); no save-format change. Stories keep working through today's matching; "no story" where a new reading has none.
- **Out of scope:** dropping a rarely used reading or teaching two on'yomi; level order (backlog #7); new stories; compound-word gates (backlog #2); telling the player a reading changed.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Keep one on'yomi + one kun'yomi per kanji | Smallest change; gates, distractors and stories already assume that shape. |
| Owner's WaniKani sense is the judge | WaniKani's choices are proprietary and can't be compared automatically; the owner knows them. |
| Progress untouched | The SRS box is per kanji ("生 reading"), so a changed reading keeps its box. |
