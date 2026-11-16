# Intent: word gates

Status: confirmed by the owner, 2026-11-17, after an interview. Epic: `docs/ideas/useful-japanese.md` (round 1). Spec: `docs/specs/SPEC-word-gates.md`.

## Statement of intent
- **Outcome:** in Built-in mode each kanji level brings about 30 real words from JMdict, of three kinds: a kanji on its own (人 as ひと), kanji plus kana (入る) and compounds (今日). Each word has a meaning gate and a reading gate. The reading gate tests the word's own reading, irregular ones included (一人 ひとり, 今日 きょう).
- **Unlock:** a word joins the level of its last kanji and is asked only once all its kanji are learned. Words never count toward the 80% level unlock. At most 2 of a run's 4 new items are words.
- **Picking:** automatic and swappable. A single picker module ranks the words; today's rule is JMdict frequency with a mix of the three kinds. Bad entries are removed by automatic filters, never by hand. The owner wants to be able to change the ordering later (e.g. after comparing with WaniKani) without touching the game, and doesn't mind progress shifting when that happens.
- **Overlap:** kanji gates stay as they are. A word that would only repeat its kanji's meaning and reading is skipped.
- **Look:** word gates (loanwords too) get a subtle colour tint, the same in 2D and 3D.
- **Success:** at the checkpoint, levels 2–6 feel like WaniKani-style words arriving with the kanji, and runs aren't swamped.
- **Out of scope:** the usefulness ordering (round 2), stories for words, WaniKani mode, retiring kanji reading gates, kana-only conversation words (すみません), manual review or curation.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Meaning and reading gate per word | Same as kanji; the reading gate is where irregular readings and okurigana are taught. |
| ~30 words per level, max 2 new words per run | Close to WaniKani's feel without slowing the owner's pace. |
| Picker behind one interface | The owner wants to swap the ordering later without touching the game. |
| No manual curation | The owner doesn't want to review lists; filters must do the cleaning. |
| Tint, not a badge | Shows "this is a word" at a glance without extra reading. |
