# Grammar notes for words

Status: raw owner idea, 2026-11-28. Not yet interviewed or specced.

## Idea
Explain the grammar patterns behind the words, so they stop looking arbitrary. Owner's examples:
- Counters and number words ending in つ / り (一つ ひとつ, 一人 ひとり, 二人 ふたり): why "ri" shows up.
- Words starting with お / ご (honorific prefix): お金, お茶, ご飯.
- Verb endings: dictionary form, う-verbs vs る-verbs (godan / ichidan), what the okurigana is doing.
- Adjective type: い-adjectives vs な-adjectives, and how they change.

## Today
`src/data/words.json` has `word`, `reading`, `glosses`, `kind` (`okurigana` / `compound`) and `level`. No part of speech, verb class or adjective type, and no grammar text anywhere.

## Open questions (for the interview)
- Where it shows: a line on the study card, a "pattern" card met once before the first word of that pattern, a separate grammar page, or all of these.
- Which patterns, in what order: tie each to the level where its first word appears.
- Data source for part of speech / verb class (e.g. JMdict tags) vs hand-written per pattern. A new data source is a judgment call.
- Is it only explained, or also tested (a gate asking "い or な?")?
- Overlap with [Part notes on the study card](part-notes-on-card.md), which also adds "why" text to the card.
