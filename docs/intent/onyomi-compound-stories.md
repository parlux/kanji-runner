# Intent: on'yomi stories from compound vocabulary

Status: confirmed by the owner, 2026-11-17, after an interview. Idea: `docs/ideas/done/onyomi-compound-stories.md`. Spec: `docs/specs/done/SPEC-compound-stories.md`.

## Statement of intent
- **Outcome:** when a presented on'yomi has neither a kanji story nor a single-kanji vocabulary story, the card borrows the reading story of a WaniKani compound word with that reading.
- **Pick:** the lowest-level compound WaniKani teaches with that reading (ties: WaniKani order); one story per reading. Compounds whose story is boilerplate (doesn't mark or contain the reading) are skipped; if none pass, the "No story for this reading" line stays.
- **Card:** `Reading mnemonic: か (from 家具 かぐ)`, the word in the kanji tag colour, then the compound's whole reading story unchanged.
- **User:** the owner, mid-run or on the study screen, shown 家 as か.
- **Success:** on the owner's token, 家 か (and similar on'yomi) shows a real compound story; fewer on'yomi show "no story". Without a token, cards are exactly as today.
- **Constraint:** same WaniKani fetch range and endpoints; the library stores only the chosen compound per kanji reading, not every compound. No change to spaced repetition or the save format.
- **Out of scope:** kun'yomi from compounds, meaning glosses, trimming stories, compound words as gates (backlog #5).

## Decisions (and why)
| Decision | Reason |
|---|---|
| Lowest level first | The first word WaniKani teaches with the reading; likely already seen. |
| Skip boilerplate stories | "You know the kanji readings" doesn't help with the reading; an honest "no story" is better. |
| On'yomi only | Kun'yomi almost always have a single-kanji word; in compounds they often change sound (手紙 がみ). |
| Whole story, word reading in the label | The story explains the whole word; trimming risks cutting the hook. |
