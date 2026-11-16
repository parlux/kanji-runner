# Spec: on'yomi stories from compound vocabulary (v1.3.0)

Extends `docs/specs/done/SPEC-reading-stories.md` and the specs it extends. Everything there still holds unless this spec says otherwise. Intent: `docs/intent/onyomi-compound-stories.md`. Idea: `docs/ideas/done/onyomi-compound-stories.md`.

## Objective
A presented on'yomi that today shows "No story for this reading" (e.g. 家 か: WaniKani teaches 家 as いえ/うち) gets a reading story borrowed from a WaniKani compound word that uses it (家具 かぐ). This replaces SPEC-reading-stories' rule "On'yomi only match vocabulary that is the bare kanji; compounds are never searched" with a last-resort compound step.

### User stories
- As the player shown 家 as か, I pause and read `Reading mnemonic: か (from 家具 かぐ)` with 家具's reading story.
- As the player shown an on'yomi whose only compounds have boilerplate stories ("you know these kanji readings…"), I still see the "no story" line, not filler.
- As the player shown 上 as じょう or 日 as にち, nothing changes: the kanji story still wins.

## Rules

### Order for one presented reading (amends SPEC-reading-stories)
1. Kanji story covers it → kanji story (unchanged).
2. Single-kanji vocabulary (unchanged; on'yomi: bare kanji only).
3. **New, on'yomi only:** the kanji's stored compound for that reading → compound story.
4. Else the "no story" line (unchanged).

Kun'yomi never use compounds.

### Which compound (chosen when the library is built)
For each kanji and each of its WaniKani `onyomi` readings (all of them, primary or not, hiragana) that is **not** covered by step 1 or 2 (same coverage rule as today, computed from the stored kanji story, primary readings and single-kanji vocabulary), look at WaniKani vocabulary that:
- is not hidden, has a `reading_mnemonic`, and is **not** single-kanji shape (SPEC-reading-stories' shape rule);
- contains the kanji in `characters`;
- has a reading (any accepted one, hiragana) that **uses the on'yomi at the kanji's position**: kanji first in the word → the word reading starts with the on'yomi; kanji last → ends with it; otherwise → contains it. (Sound changes like がく → がっ in 学校 don't match; that reading keeps "no story".)
- has a story that **mentions the reading**: the story text contains the on'yomi or that word reading, in hiragana or katakana (with or without `<reading>` tags). Boilerplate with no kana for the reading fails.

Among those, take the lowest WaniKani `level`, then the lowest subject id. Store one entry per kanji reading; nothing is stored when no compound passes.

### Library format
- `StoryLibrary.version` becomes `3`, adding per kanji `compounds: [{ reading, word, wordReading, story }]` (`reading` = the kanji's on'yomi, `wordReading` = the matching word reading). A stored version-2 library fails validation and is refetched (as SPEC-stories says for a wrong version).
- Fetch unchanged: `/subjects?types=kanji,radical,vocabulary&levels=1..N` already returns compounds. No new endpoint, no new pages.
- Only chosen compounds are stored, never the full vocabulary list.

### What the card shows
- Heading `Reading mnemonic: か (from 家具 かぐ)`: the word in the kanji tag colour (as single-kanji vocabulary today), then a space and the word reading in plain text.
- Body: the compound's whole reading story, rendered like any mnemonic (tags coloured, unchanged).
- Single-kanji vocabulary labels stay as today (`(from 上)`), no word reading.
- Taught-cache fallback has no compounds: unchanged.
- No token: every card exactly as today.

## Project Structure (changes)
```
src/wanikani/stories.ts  → v3 library: pick and store compounds; validation
src/core/study.ts        → Story gains compounds; readingStory step 3; source { word, wordReading? }
src/game/ui/study.ts     → label "(from <word> <wordReading>)"
```
`wanikani/` may use `coveredReadings` from `core/mnemonic.ts` (already allowed). Layers unchanged.

## Commands
`npm test`, `npm run check` (tests, typecheck, lint, knip, deps, build), `npm run dev`.

## Code Style
As the repo: small pure functions, JSDoc one-liners, `Result` types in `wanikani/`, never throw on bad input.

```ts
/** The compound whose story can stand in for this on'yomi, or undefined. */
function pickCompound(char: string, on: string, words: readonly Vocab[]): Compound | undefined { … }
```

## Testing Strategy
- **Synthetic fixtures only** (made-up words and story text). 家/家具 are for the owner's check, not committed.
- Pick: position rule (first/last/middle); sound change doesn't match; boilerplate story (no kana for the reading) skipped; katakana mention and `<reading>` tags accepted; lowest level wins, then lowest id; hidden and mnemonic-less skipped; single-kanji words never picked as compounds; covered on'yomi (kanji story or bare-kanji word) gets no compound; kun'yomi never.
- Library: v3 round-trips; v2 record rejected; `compounds` validated.
- Card: on'yomi with a compound → compound story with `wordReading`; kanji story and single-kanji word still win; kun'yomi with only a compound → "no story"; no compounds → "no story" as today; no-token card unchanged.

## Boundaries
- Always: `npm run check` before commit; synthetic fixtures; push after each task.
- Ask first: storing more than one compound per reading, any new endpoint, kun'yomi compounds.
- Never: commit real WaniKani text, touch SRS or the save format.

## Success Criteria
1. With the owner's token, 家 presented as か shows a compound story labelled `(from <word> <reading>)` whose story mentions か.
2. じょう on 上, にち on 日: kanji story, as before. うえ on 上: `(from 上)`, as before.
3. An on'yomi whose only compounds have boilerplate stories shows the "no story" line.
4. Without a token, every card is exactly as today.
5. `npm run check` passes; version 1.3.0 in `package.json` and `CHANGELOG.md`.

## Open Questions
1. How many on'yomi go from "no story" to a compound story on the owner's levels? The token lives on the owner's phone, so the count can't be measured here; the owner checks 家 か and a few others at Checkpoint C instead.
2. Is the "mentions the reading" test strict enough? A one-kana reading like か could match a stray か in an unrelated story. WaniKani stories are English with kana only in reading mentions, so the risk is low; the owner judges at the checkpoint.
