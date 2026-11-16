# Tasks: on'yomi stories from compound vocabulary (v1.3.0)

Spec: `docs/specs/done/SPEC-compound-stories.md` (2026-11-17). Intent: `docs/intent/onyomi-compound-stories.md`. Idea: `docs/ideas/done/onyomi-compound-stories.md`. Started and closed 2026-11-17 (owner ticked Checkpoint C).
Review: https://claude.ai/artifact/DgzLWE284WZFqUPgQrZwqB · Checkpoint C: https://claude.ai/artifact/6ooEfv8qqwAZsD5VHkqqUg
Every task: `npm run check` passes before it is checked off. Test fixtures are synthetic: never commit real WaniKani content.

## Plan
- **Pick at build time.** C1 chooses one compound per uncovered on'yomi inside `buildLibrary`, so the library stays small and the card logic only looks it up.
- **One card change.** The pause screen reuses the study card, so C2 covers both screens.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| "Mentions the reading" lets a weak story through (stray kana) | Med | Position rule on the word reading as well; owner judges at Checkpoint C. |
| Library grows | Low | One compound per uncovered on'yomi only; no extra fetch. |
| Can't count improvements without the owner's token | Low | Owner checks 家 か and others on the phone. |

### Task C1: Pick and store compounds (library v3)
**Description:** `buildLibrary` in `src/wanikani/stories.ts` picks one compound per kanji on'yomi that the kanji story and single-kanji vocabulary don't cover (spec "Which compound"), stores `compounds: [{ reading, word, wordReading, story }]`, `version: 3`. `parseLibrary` validates v3 and rejects v2. `Story` in `src/core/study.ts` gains `compounds`; `storyLookup` passes them on.
**Acceptance:**
- [x] spec Testing Strategy "Pick" and "Library" cases pass; existing stories tests updated, not deleted.
- [x] `npm run check` passes.
**Verification:** `npm test -- stories storystore`
**Files:** `src/wanikani/stories.ts`, `src/core/study.ts`, `tests/wanikani/stories.test.ts`
**Scope:** M

### Task C2: Card uses the compound
**Description:** `readingStory` in `src/core/study.ts` adds step 3 (on'yomi only): the stored compound for the reading; source becomes `{ word, wordReading }`. `src/game/ui/study.ts` labels it `(from <word> <wordReading>)`, word in the kanji tag colour; single-kanji labels unchanged.
**Acceptance:**
- [x] spec Testing Strategy "Card" cases pass.
- [x] browser check at 390×844 with synthetic data: a compound block, a single-kanji block, a "no story" block; pause card the same; no-token card unchanged. Screenshots in the scratchpad only.
- [x] `npm run check` passes.
**Verification:** `npm test -- study`; browser check.
**Dependencies:** C1
**Files:** `src/core/study.ts`, `src/game/ui/study.ts`, `tests/core/study.test.ts`
**Scope:** S

### Task C3: Changelog, version
**Description:** Bump to 1.3.0, add `## 1.3.0 (date)` to `CHANGELOG.md`. Grep `src/`, `tests/`, `dist/` for real story phrases and the token prefix.
**Acceptance:**
- [x] Version 1.3.0 and `## 1.3.0 (2026-11-17)` in `CHANGELOG.md`.
- [x] Grep clean.
**Verification:** `npm run check`; deploy green.
**Dependencies:** C2
**Files:** `package.json`, `CHANGELOG.md`, this file
**Scope:** S

### Checkpoint C: v1.3.0 (owner, on the phone)
- [x] Pause on 家 shown as か: a compound story labelled `(from <word> <reading>)` that is about か.
- [x] じょう / にち / うえ stories unchanged.
- [x] Borrowed stories read as helpful, not filler; "no story" still appears where nothing fits.
