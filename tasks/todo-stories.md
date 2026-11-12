# Tasks: WaniKani stories in Built-in mode (v1.5)

Spec: `docs/specs/SPEC-stories.md` (2026-11-12). Intent: `docs/intent/wk-stories-builtin.md`. Idea: `docs/ideas/wk-stories-builtin.md`. Queued: starts when the owner says so (independent of the 3D round; touches no 3D code).
Every task: `npm test && npm run lint && npm run build` pass before it is checked off. Test fixtures are synthetic: never commit real WaniKani content.

## Plan
- **Pure first.** M1 builds the library shape and the card model with no network or storage, so the content rules are tested before anything is fetched.
- **Separate from the taught cache.** The library is a second dataset with its own store and refresh rules; the existing cache, pool and runs are not touched.
- **Today's card is the fallback.** Every step keeps "no library → identical card" true, so each deploy is safe.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Story text too big for `localStorage` on the phone | High | IndexedDB, with an in-memory fallback (M2). |
| Real WaniKani content leaks into the repo (fixtures, screenshots) | High | Synthetic fixtures; screenshots only in the scratchpad; grep of repo and `dist/` (M3). |
| Long cards on a phone | Med | Owner judges at Checkpoint I; collapse is the lever (spec open question 1). |
| Radical images offline or slow | Low | Name always shown; image is extra. |

## Phase 11: Stories

### Task M1: Story library and card model (pure)
**Description:**
- `src/wanikani/stories.ts`: turn `/subjects` pages (kanji and radicals mixed) into the story library per the spec: per kanji `meaning`, `reading`, `radicals` (`char | null`, `name`, `image | null`). Also validate a stored library (versioned), like `parseCache`.
- `src/core/study.ts`: `StudyCard` (kanji) gets optional `radicals`; `studyCards` takes a story lookup (character → mnemonics + radicals) used in both modes, replacing the WaniKani-only `mnemonics` map argument. In WaniKani mode, callers pass a lookup that falls back to the taught-cache mnemonics.

**Acceptance criteria:**
- [x] Radicals resolved in WaniKani's order; radical without characters → SVG URL; hidden subjects dropped; kanji with nothing to show left out (tested).
- [x] Bad pages or a bad stored library → error result, never a throw (tested).
- [x] Built-in cards with a lookup carry stories and radicals; a kanji missing from the lookup, or no lookup, gives today's card exactly (tested; existing study tests unchanged).

**Verification:** `npm test -- stories study`
**Dependencies:** none
**Files:** `src/wanikani/stories.ts`, `src/core/study.ts`, `tests/wanikani/stories.test.ts`, `tests/wanikani/fixtures/stories.json` (synthetic), `tests/core/study.test.ts`
**Scope:** M

### Task M2: Fetch and store the library
**Description:**
- `client.ts`: `fetchStories()`: `/user` (level from `subscription.max_level_granted`, else `level`), then `/subjects?types=kanji,radical&levels=1..N` with pagination; returns `ok` + library, or `offline` / `invalid`; never throws.
- `src/wanikani/storystore.ts`: async load / save / delete of the library in IndexedDB (one record, with the token's last 4 characters and the fetch time). Falls back to memory if IndexedDB is missing or refuses. Injectable for tests.
- `wkstate.ts`: owns the library: loads it at start, fetches when missing, token changed, or older than 7 days (checked inside `refresh()`); `stories()` lookup by character; `remove()` deletes it. **Saving a token no longer switches to WaniKani mode.**

**Acceptance criteria:**
- [ ] Mocked fetch: pages joined, 401 → invalid, 429 / network / malformed → offline, requests only to `https://api.wanikani.com/v2/` (tested).
- [ ] Refresh rules with a fake clock and in-memory store: fetch when missing, token changed, older than 7 days; no fetch otherwise (tested).
- [ ] Remove token deletes the library (tested).
- [ ] Saving a token keeps Built-in mode; the switch still changes mode (tested; replaces "saving a token fetches and switches to WaniKani").

**Verification:** `npm test -- wanikani wkstate`
**Dependencies:** M1
**Files:** `src/wanikani/{client,storystore}.ts`, `src/game/wkstate.ts`, `tests/wanikani/{client,storystore}.test.ts`, `tests/game/wkstate.test.ts`
**Scope:** M

### Task M3: Radicals row and wiring
**Description:**
- `main.ts`: build study cards with `wk.stories()` in both modes (with a token), instead of `session.wk ? wk.mnemonics() : undefined`.
- `study.ts`: when a card has `radicals`, a "radicals" row replaces "parts": chips with the character, or an `<img>` of the SVG sized to the text, plus the WaniKani name, in the radical blue. Stories render as today.

**Acceptance criteria:**
- [ ] Browser checks at 390×844, mocked fetch and synthetic data: Built-in study card with stories and radicals (character and image chips); a card for a kanji not in the library; no token (today's card). Screenshots in the scratchpad only.
- [ ] Reload: the library comes back from IndexedDB without a refetch (browser check).
- [ ] Same seed, same Built-in run before and after saving a token (tested or checked).
- [ ] `dist/` and the repo contain no WaniKani content or token: grep for a phrase from one real story and the token prefix (manual, by the orchestrator, using data in the scratchpad).

**Verification:** `npm test`. Browser checks. Deploy green.
**Dependencies:** M2
**Files:** `src/main.ts`, `src/game/study.ts`
**Scope:** S

### Checkpoint I: v1.5 (owner, on the phone)
- [ ] With the token saved, the game stays in Built-in mode and runs feel the same.
- [ ] After a Built-in loss, study cards show WaniKani's stories and radicals for kanji not yet taught on WaniKani; radical names in the stories match the chips.
- [ ] A kanji WaniKani doesn't have shows the usual card.
- [ ] Card length on the phone is fine, or note that stories should collapse (spec open question 1).
