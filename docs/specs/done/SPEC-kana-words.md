# Spec: Katakana loanwords (v1.6)

Extends `docs/specs/done/SPEC.md` (v1) through `docs/specs/done/SPEC-stories.md` (v1.5). Everything there still holds unless this spec says otherwise. Intent: `docs/intent/kana-words.md`. Idea: `docs/ideas/done/kana-words.md`.

**Changes SPEC.md Out of Scope:** "vocabulary" is now partly in scope: katakana loanwords only. Multi-kanji words stay out.

## Objective
In Built-in mode, kanji runs sometimes ask a katakana loanword (e.g. コーヒー). The gate shows the word; the answers are English meanings. Each word is its own SRS item. About 5 words join each kanji level, and a word is only asked once all its katakana are learned.

### User stories
- As the player past katakana, I meet words like テレビ in my kanji runs, sound them out, and pick "television".
- As the player, I never get a word containing katakana I haven't learned.
- As the player, kanji levels still feel like kanji levels: words are a few gates per run, not most of them.

## Rules

### Data: `src/data/loanwords.json` (hand-curated, committed)
- An ordered list of `{ "word": "コーヒー", "glosses": ["coffee"] }`, common and easy first. Target 150–250 entries.
- Glosses are written by hand for this list (short, everyday English; the first is shown on gates). No JMdict or other dataset is copied.
- Allowed characters: the katakana in `kana.json`, small ァィゥェォッャュョ, and the long-vowel mark ー. No ヴ, no hiragana, no kanji.
- Length 2–6 characters (fits a gate label on a phone).
- Words are unique. No two words share a gloss (so distractors are never correct).
- Choose everyday nouns: food and drink, places, things at home, tech, sports, clothes. Avoid words whose English is misleading (e.g. マンション) unless the gloss states the Japanese meaning.

### Model
- `WordItem = { word: string; glosses: string[]; level: number }`. Level is assigned at load, not stored: entry `i` gets kanji level `2 + floor(i / WORDS_PER_LEVEL)`, with `WORDS_PER_LEVEL = 5` in `tuning.ts`. Entries past the last kanji level get the last level.
- New gate type `"word"`. Item key `コーヒー:word`. Progress schema unchanged (`version: 1`); sync and merge work per key, untouched.
- **Kana needed by a word:** its characters with ー dropped and small kana mapped to full size (ッ→ツ, ャ→ヤ, ィ→イ, …). Pure function, tested.
- **Eligible** when the word's level ≤ `unlockedLevel` **and** every kana it needs has `box ≥ LEARNED_BOX` (2) on its `kana` record. ("Learned" is the game's existing threshold; the intent said "past the first SRS stage".)

### Pool and runs (Built-in mode)
- `unlockedPool` adds eligible words after the kanji, in list order. `Entry` gets a `{ type: "word"; item: WordItem }` variant.
- Words use the normal SRS: Leitner box, weight, `seen/correct/wrong`.
- **New words:** at most `MAX_NEW_WORDS_PER_RUN = 1` per run, counted inside the existing `MAX_NEW_PER_RUN` of 4. So new kanji keep priority.
- Warm-ups: words may be warm-ups like any known item.
- **Level unlock is unchanged:** `levelKeys` stays kana or kanji meaning only, so words never count toward or block the 80% rule.
- **Placement:** placing up to level N also marks the words of levels ≤ N at box 4 (same rule as other items, never lowered; unanswered marks above N are removed on re-placement).
- Distractors: glosses (first gloss) of other words from unlocked levels plus the next level, excluding any overlapping gloss. If fewer than needed exist, pad from the whole list. Answer positions shuffled.
- Squad charges and wall gates both may ask words.

### Screens
- **Gate label:** the word as the prompt, in the same font as kanji, scaled down when needed so a 6-character word fits the gate at 390×844 in 2D and `?3d`.
- **Summary:** missed words listed with their meaning, like other items.
- **Study card (`kind: "word"`):** the word, its glosses, and a kana breakdown with romaji per character (コ ko · ー (long) · ヒ hi · ー). Studying never changes SRS.
- Start-screen level progress text: unchanged (words aren't counted).

### WaniKani mode
Unchanged: no words in its pool (see Open Questions).

## Project Structure (changes)
```
src/data/loanwords.json      → curated list (hand-written glosses)
src/core/words.ts            → load + level assignment, kana needed by a word, eligibility
src/core/types.ts            → WordItem; GateType + "word"
src/core/pool.ts             → word entries in unlockedPool / builtInPool
src/core/run.ts              → word rows, new-word cap
src/core/distractors.ts      → wordRow
src/core/progression.ts      → place() covers words
src/core/study.ts            → word study card
src/game/{render,study}.ts   → long prompt label, word card
src/game/three/*             → label fits in 3D
```

## Testing Strategy (additions)
- Data validation test over the real list: allowed characters only, length 2–6, unique words, no shared glosses, ≥ 150 entries.
- `words`: small-kana mapping and ー drop; level assignment; eligibility (level and kana box both required).
- Pool: no word before its level; no word with an unlearned kana; at most 1 new word per run (property test over seeds); level unlock ignores words.
- Distractors: never a correct gloss (property test over all words, like SPEC.md criterion 11).
- Placement: words of placed levels at box 4; re-placement removes unanswered marks.
- **Golden run:** a run with no eligible words (kana levels, or kanji levels with katakana unlearned) must be byte-identical to today. The golden fixture keeps passing unchanged; if a word-free progress somehow changes, stop and ask.
- Balance simulation still meets its thresholds with words in the pool.
- Browser checks at 390×844 and 1280×800, 2D and `?3d`: a 6-character word gate is readable; summary and study card for a missed word. Screenshots in the scratchpad.

## Boundaries
- Never copy entries or glosses from JMdict, WaniKani or another word list; the list and its glosses are written for this repo.
- WaniKani mode, sync, storage schema, sim, boss: unchanged.
- No task edits `src/core/{sim,srs,boss,crowd}.ts`.

## Success Criteria
1. With katakana unlearned, runs are exactly as before (golden run unchanged).
2. Once katakana is learned and a kanji level is unlocked, that level's words appear over time; never one with an unlearned kana.
3. No run introduces more than 1 new word; known words resurface by SRS weight.
4. Level unlocks behave exactly as before.
5. Word gates, the summary and the study card read well on a phone, in 2D and 3D.
6. **Owner checkpoint:** on the phone, kanji runs feel mostly about kanji, words show up now and then, and they're fun to sound out.

## Out of Scope (v1.6)
Hiragana words; romaji or reading answers for words; English→katakana gates; mixed kanji+kana words; WaniKani vocabulary; audio; a separate words mode or level; counting words toward level unlocks.

## Open Questions
1. WaniKani mode: should words appear there too (e.g. at `unlockedLevel` or by WaniKani level)? Not in v1.6.
2. Pacing: `WORDS_PER_LEVEL` and `MAX_NEW_WORDS_PER_RUN` are the levers if words feel too rare or too common at the checkpoint.
