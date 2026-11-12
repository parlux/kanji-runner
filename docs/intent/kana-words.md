# Intent: Katakana loanwords

Status: confirmed by the owner, 2026-11-13, after an interview. Extends `docs/intent/kanji-runner.md`. Idea: `docs/ideas/kana-words.md`. Spec: `docs/specs/SPEC-kana-words.md`, tasks: `tasks/todo-kana-words.md`.

## Statement of intent
- **Outcome:** katakana loanwords (コーヒー, レストラン, テレビ…) become their own SRS items. A gate shows the word; you pick its English meaning.
- **Placement:** no separate level or mode. Each kanji level adds a small batch (about 5) of new words from a curated list of common, everyday loanwords (food, places, tech): about 150–250 in total.
- **Unlock rule:** a word only appears once every katakana in it is learned.
- **Why:** katakana pays off as real words right away, and kana practice keeps going through the kanji levels.
- **Success:** kanji runs sometimes ask a loanword; never one with unlearned katakana; on the normal SRS rhythm.
- **Constraint:** kanji levels stay mostly about kanji. Words are flavour, not a takeover.
- **Out of scope:** hiragana words; romaji reading answers for words; mixed kanji+kana words; WaniKani vocabulary.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Mixed into kanji levels, not a new level | Owner: "later kanji levels keep adding kana words, assuming kana chars are learned". |
| Answer = English meaning | Reading each katakana is already drilled at the kana levels; recognising the word is the new skill. |
| Katakana loanwords only | Sound it out, guess the English: the fun part. Hiragana words are vocabulary study. |
| Each word is a tracked SRS item | So words resurface by strength, not at random forever. |
| Small curated batch per level | Owner accepted the recommendation: keeps levels about kanji. |
