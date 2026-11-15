# Intent: reading story matches the reading shown

Status: confirmed by the owner, 2026-11-15, after an interview. Idea: `docs/ideas/story-reading-mismatch.md`. Spec: `docs/specs/SPEC-reading-stories.md`.

## Statement of intent
- **Outcome:** on the pause screen and the study card, the reading story is always about the reading shown. It is the kanji's WaniKani story when that covers the reading, else the story of a WaniKani vocabulary item with that reading (labelled with the word, e.g. "from 上 (うえ)"). If neither covers it, a short line says there is no story for this reading and it just needs remembering.
- **User:** the owner, linking a reading to its story.
- **Why now:** about half of runs show a reading the story doesn't cover (上 shown as うえ, story about "Joe"), so the story misleads.
- **Success:** 上/うえ, 日/ひ and 人/ひと show a story about that reading; じょう, にち and じん keep the kanji story; a reading with no story shows the "no story" line.
- **Constraint:** which reading a kanji story covers is read from the kana in brackets in the story text. The vocabulary fetch only goes up to the owner's level, like stories today.
- **Out of scope:** reading rotation in runs, vocabulary in gameplay, meaning stories, cards with no WaniKani stories at all.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Use WaniKani vocabulary stories for readings the kanji story skips | WaniKani teaches kun'yomi through vocabulary; うえ has a real story there. |
| "No story" line, worded by us | Owner: "just say there's no story for that, just needs to be remembered". |
| Rotation stays | Learning both readings is the point; only the story was wrong. |
