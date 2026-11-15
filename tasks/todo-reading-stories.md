# Tasks: reading stories match the reading (v1.2.0)

Spec: `docs/specs/SPEC-reading-stories.md` (2026-11-15). Intent: `docs/intent/story-reading-mismatch.md`. Idea: `docs/ideas/story-reading-mismatch.md`. Approved and started 2026-11-15.
Review: https://claude.ai/artifact/Q9WkSgJuHgNFZ3Nfrw2rD7
Every task: `npm run check` passes before it is checked off. Test fixtures are synthetic: never commit real WaniKani content.

## Plan
- **Pure first.** R1 decides coverage and picks a story per reading with no network, so the content rules are tested before anything is fetched.
- **One card change.** The pause screen reuses the study card, so R3's render covers both screens.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Some kanji stories have brackets in an odd form | Med | Fallback to WaniKani primary readings; R4 counts kanji with no bracket match in the owner's real library (scratchpad only). |
| Bigger library and fetch | Low | Single-kanji vocabulary only; R4 measures pages and size. |
| Card length for meaning-only kanji (two stories) | Low | Owner judges at Checkpoint R. |

### Task R1: Coverage and story choice (pure)
**Description:** `coveredReadings(text)` in `src/core/mnemonic.ts`. `Story` in `src/core/study.ts` gains `primaryReadings` and `vocab`; the kanji card gets `readingStories: { reading, source: "kanji" | { word }, text } | { reading, none: true }`, one per presented reading, replacing `mnemonics.reading`. `studyCards` and `lastAnswer` work out the presented readings from the run's rows (spec "Which reading"). A kanji with no story keeps today's card.
**Acceptance:**
- [x] spec Testing Strategy "coveredReadings", "Presented readings" and "Card" cases pass.
- [x] `npm run check` passes.
**Verification:** `npm test -- mnemonic study`
**Files:** `src/core/mnemonic.ts`, `src/core/study.ts`, `src/game/ui/panels.ts` (if the call needs the rows), `tests/core/mnemonic.test.ts`, `tests/core/study.test.ts`
**Scope:** M

### Task R2: Library v2 and fetch
**Description:** `buildLibrary` keeps `primaryReadings` per kanji and single-kanji vocabulary (shape rule in the spec), `version: 2`; `parseLibrary` validates v2 and rejects v1; `storyLookup` passes both on. `client.ts` fetches `types=kanji,radical,vocabulary`. Taught-cache fallback (`storiesWithFallback`) keeps working with no vocab.
**Acceptance:**
- [x] spec Testing Strategy "Library" and "Client" cases pass; existing stories and client tests updated, not deleted.
- [x] `npm run check` passes.
**Verification:** `npm test -- stories client storystore`
**Dependencies:** R1
**Files:** `src/wanikani/stories.ts`, `src/wanikani/client.ts`, `src/core/study.ts`, `tests/wanikani/stories.test.ts`, `tests/wanikani/client.test.ts`
**Scope:** M

### Task R3: Render the reading blocks
**Description:** Owner change (2026-11-15): a kanji with no presented reading gets one block per main reading (spec "Which reading"); update the R1 logic in `src/core/study.ts` and its tests. `src/game/ui/study.ts`: one block per entry in `readingStories`, heading `Reading mnemonic: <reading>` plus ` (from <word>)` for vocabulary, "no story" line in muted text. Pause screen gets it through `cardEl`.
**Acceptance:** browser check at 390×844 with a mocked fetch and synthetic data: a card with a kanji story, a vocabulary story and a "no story" block; pause card the same; no-token card unchanged. Screenshots in the scratchpad only.
**Verification:** `npm run check`; browser check.
**Dependencies:** R2
**Files:** `src/game/ui/study.ts`, `src/core/study.ts`, `tests/core/study.test.ts`
**Scope:** S

### Task R4: Measure, changelog, version
**Description:** With the owner's token (scratchpad only, nothing committed): count fetch pages and library size before/after, and kanji whose story has no bracket match; check 上, 日, 人 match spec success criteria 1–3. Bump to 1.2.0, add `## 1.2.0 (date)` to `CHANGELOG.md`. Grep repo and `dist/` for a real story phrase and the token prefix.
**Acceptance:** numbers logged in this file; version and changelog done; grep clean.
**Verification:** `npm run check`; deploy green.
**Dependencies:** R3
**Files:** `package.json`, `CHANGELOG.md`, this file
**Scope:** S

### Checkpoint R: v1.2.0 (owner, on the phone)
- [ ] Pause on a 上 / 日 / 人 reading gate: the story under the shown reading is about that reading.
- [ ] A reading with no story shows the "no story" line.
- [ ] Only the presented reading's story shows; meaning-only kanji show every reading's story; card length is fine.
