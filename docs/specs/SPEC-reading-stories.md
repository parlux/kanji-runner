# Spec: reading stories match the reading (v1.2.0)

Extends `docs/specs/done/SPEC-stories.md` and the specs it extends. Everything there still holds unless this spec says otherwise. Intent: `docs/intent/story-reading-mismatch.md`. Idea: `docs/ideas/story-reading-mismatch.md`.

## Objective
A kanji card (study screen and pause screen, both modes) shows the reading story for **the reading that was presented**: the reading the run's reading gate showed for that kanji. The story is about that reading: the kanji's WaniKani story if it covers it, else a WaniKani vocabulary story for a word read that way, else a "no story" line. This fixes SPEC-stories' known rough edge ("a reading story about a reading Built-in doesn't show is shown unchanged").

### User stories
- As the player who just got 上 shown as うえ, I pause and read a story about うえ, labelled "from 上 (うえ)", not the "Joe" story about じょう.
- As the player shown 上 as じょう, I still read the "Joe" story.
- As the player shown a reading with no WaniKani story, I see "No story for this reading. This one just needs remembering." and don't go looking for a link that isn't there.

## Rules

### Which readings a kanji story covers
- A kanji reading mnemonic marks its readings as `<reading>Word</reading> (かな)`. The **covered readings** are the hiragana inside the brackets right after a `</reading>` tag (spaces allowed; katakana converted to hiragana; several readings in one bracket split on `、`, `,` or `/`).
- If the story has no such bracket, it covers WaniKani's `primary: true` readings for that kanji (stored with the library).
- A main reading is covered when its plain form (okurigana kept, brackets dropped: あ(げる) → あげる) **or its base** (あ) is a covered reading.

### Vocabulary stories
- The story library also fetches `vocabulary` subjects (same levels). It keeps only vocabulary that can tell a single kanji's reading: `characters` is exactly one kanji followed by zero or more hiragana (e.g. `上`, `上げる`), with a `reading_mnemonic`, not hidden.
- Stored per kanji: `vocab: [{ word, readings: string[] (all accepted readings, hiragana), story }]`, in WaniKani id order.
- For a main reading that the kanji story doesn't cover, the first vocabulary entry for that kanji with a reading equal to the main reading's plain form gives the story. Prefer an entry whose `word` equals kanji + okurigana of that reading (上げる for あ(げる)); else any match.
- On'yomi only match vocabulary that is the bare kanji (`word` = the kanji); compounds are never searched.

### What the card shows
- **Which reading:** the card shows a reading block only for the presented reading(s):
  - Pause screen: the last gate. A reading gate → its correct answer (the shown reading). A meaning gate presents no reading → see the next rule.
  - Study screen: every reading the run's reading gates showed for that kanji, in order of first sight (usually one; two if the run asked it with both).
  - Kanji with no reading presented (only meaning gates, or a pause on a meaning gate): one block **per main reading** (on'yomi, then kun'yomi), each chosen like a presented reading (kanji story, vocabulary story or "no story"). The card introduces the kanji, so you can read every reading's story and try to recall it when a reading is presented later (owner, 2026-11-15).
- Heading: `Reading mnemonic: じょう`; for a vocabulary story `Reading mnemonic: うえ (from 上)`, with the word in the kanji tag colour.
- No story for that reading → the block shows `No story for this reading. This one just needs remembering.` in the muted text colour.
- A kanji with **no story at all** in the library or taught cache (no token, not loaded, not a WaniKani kanji) → today's card, no "no story" lines (SPEC-stories' rule holds).
- The meaning mnemonic, radicals row and everything else are unchanged.
- The pause screen uses the same card renderer; `lastAnswer` passes the presented reading.
- Taught-cache fallback (WaniKani mode, no library): the cached reading mnemonic is used with the same coverage rule; no vocabulary stories (the cache has none), so uncovered readings show the "no story" line.

### Library format and fetch
- `StoryLibrary.version` becomes `2`, adding per kanji `primaryReadings: string[]` and `vocab` (above). A stored version-1 library fails validation and is refetched, as SPEC-stories already says for a wrong version.
- Fetch: `/subjects?types=kanji,radical,vocabulary&levels=1..N`, same paging, headers and status rules. Still only `/user` and `/subjects`.
- Vocabulary that doesn't match the single-kanji shape is never stored.

## Project Structure (changes)
```
src/wanikani/stories.ts  → v2 library: primaryReadings, vocab; validation; storyLookup carries both
src/wanikani/client.ts   → fetch adds vocabulary to types
src/core/mnemonic.ts     → coveredReadings(text): string[] (pure)
src/core/study.ts        → Story gains primaryReadings/vocab; kanji card gets readingStories: one per presented reading; studyCards/lastAnswer take the presented readings from the run's rows
src/game/ui/study.ts     → render one block per reading, vocabulary label, "no story" line
```
Layers unchanged: `core/` gets plain types only; `wanikani/` still never imports `game/`.

## Commands
`npm test`, `npm run check` (tests, typecheck, lint, knip, deps, build), `npm run dev`.

## Code Style
As the repo: small pure functions in `core/`, JSDoc one-liners, `Result` types in `wanikani/`, never throw on bad input.

```ts
/** The readings a kanji reading story is about, from its `</reading> (かな)` brackets. */
export function coveredReadings(text: string): string[] { … }
```

## Testing Strategy
- **Synthetic fixtures only** (made-up story text and words), as SPEC-stories. The 上/日/人 examples are for the owner's manual check, not committed.
- `coveredReadings`: one bracket, two readings in one story, `、`-split brackets, katakana in brackets, spaces, no bracket → empty, bracket not after `</reading>` ignored.
- Library: vocabulary kept only in the single-kanji shape; hidden and mnemonic-less dropped; v1 record rejected; v2 round-trips.
- Presented readings: from reading rows' answers, per kanji, in order; a meaning-only kanji gets one block per main reading; pause on a reading gate shows only that reading.
- Card: covered on'yomi → kanji story; uncovered kun → vocabulary story (okurigana preference, base match); no match → "no story"; no-bracket story falls back to primary readings; kanji with no stories → today's card unchanged; taught-cache fallback.
- Client: request URL includes `vocabulary`.

## Boundaries
- Always: `npm run check` before commit; synthetic fixtures; push after each task.
- Ask first: storing compound vocabulary, any new endpoint, changing reading rotation.
- Never: commit real WaniKani text, touch SRS or the save format.

## Success Criteria
1. With the owner's token, 上 presented as じょう shows only the "Joe" story; presented as うえ, only the うえ story labelled from 上.
2. 日: にち → kanji story; ひ → vocabulary story from 日.
3. 人: じん → kanji story; ひと → vocabulary story from 人.
4. A kun reading with no single-kanji vocabulary (or above level) shows the "no story" line.
5. Without a token, every card is exactly as today.
6. `npm run check` passes; version 1.2.0 in `package.json` and `CHANGELOG.md`.

## Open Questions
1. (Resolved by the owner, 2026-11-15) Meaning-only kanji show every main reading's story.
2. Extra fetch: about 6 to 7 more pages on first load or a 7-day refresh. I'll measure the real count and library size at the checkpoint.
