# Tasks: WaniKani mode and study screen (v1.1)

Spec: `SPEC-wanikani.md`. Idea and spike: `docs/ideas/wanikani.md`. Starts after v1 Checkpoint D.
Every task: `npm test && npm run lint && npm run build` pass before it is checked off. Test fixtures are synthetic: never commit real WaniKani content.

## Phase 5: Study screen (both modes)

### Task W1: Study screen
**Description:**
- A "Study" button on the end screen: always after a loss, after a win only if anything was missed.
- `src/game/study.ts`: a scrollable DOM overlay with one card per missed item, in the order missed. Kanji: character, meaning, readings, components. Kana: character and romaji. "Play again" closes it and starts a run.
- A pure view-model function (missed items → cards) in `src/core`, so the content is tested. A `mnemonic` field on the card is left optional for W5.

**Acceptance criteria:**
- [x] The cards match `missedItems` for the run: same items, same order, correct answers (tested).
- [x] Studying never changes `Progress` (tested).
- [x] Readable at 390×844, with long readings and many components (screenshots).

**Verification:** `npm test -- study`. Browser check at 390×844.
**Dependencies:** v1 done
**Files:** `src/core/study.ts`, `src/game/study.ts`, `src/game/scenes.ts`, `tests/core/study.test.ts`
**Scope:** S

## Phase 6: WaniKani mode

### Task W2: WaniKani parse (pure)
**Description:** `src/wanikani/parse.ts` turns `/user`, `/subjects` and `/assignments` JSON into the WaniKani kanji list (`KanjiItem[]`) plus extras (`srsStage`, `due`, `similar`, mnemonics, hints), per the spec. It also holds the trimmed cache shape. It validates the input and returns an error result for bad JSON instead of throwing.

**Acceptance criteria:**
- [x] Taught filter: stage 0, hidden and unassigned kanji are excluded (tested).
- [x] Gloss order (primary, accepted, whitelist), blacklist excluded, accepted readings only, okurigana and components from the built-in data when the character exists (tested).
- [x] `similar` only names kanji in the list; `due` uses an injected `now` (tested).
- [x] Malformed or partial JSON → an error result, never a throw (tested).

**Verification:** `npm test -- wanikani`
**Dependencies:** none (parallel-safe with W1)
**Files:** `src/wanikani/parse.ts`, `tests/wanikani/parse.test.ts`, `tests/wanikani/fixtures/*.json` (synthetic)
**Scope:** M

### Task W3: WaniKani client, cache and token
**Description:**
- `src/wanikani/client.ts`: fetch `/user`, then `/subjects` and `/assignments` for levels 1..N, following `next_url`. Status `ok` / `offline` / `invalid`. Throttled to once per 5 minutes. Never throws.
- `src/wanikani/cache.ts`: the token and the trimmed cache in `localStorage` (try/catch on every access); "remove token" clears both.
- Inject `fetch`, the store and the clock for tests.

**Acceptance criteria:**
- [ ] Mocked tests: success, pagination, 401 → `invalid`, 429 and network error → `offline` with the cache used, malformed body → `offline`. No exceptions.
- [ ] Requests go only to `https://api.wanikani.com/v2/`, with the token only in the `Authorization` header (tested).
- [ ] The throttle skips a refetch within 5 minutes (tested).

**Verification:** `npm test -- wanikani`
**Dependencies:** W2
**Files:** `src/wanikani/{client,cache}.ts`, `tests/wanikani/{client,cache}.test.ts`
**Scope:** M

### Task W4: WaniKani pool, weights and distractors (pure)
**Description:**
- `src/core/pool.ts`: a mode-aware pool. Built-in mode wraps today's `unlockedPool` unchanged. WaniKani mode uses every taught kanji, with the seeded box from the WaniKani stage, the `WK_DUE_BOOST` weight (in `tuning.ts`), and no new-items cap.
- Run building takes the pool and weights from `pool.ts` instead of reading the level directly.
- Distractors: in WaniKani mode, drawn from the taught pool with `similar` ranked first.

**Acceptance criteria:**
- [ ] Seeded box mapping, a real record overriding it, and the reading-gate rule with seeded boxes (tested).
- [ ] Over 1,000 seeds, due kanji are picked measurably more often than non-due kanji with the same box (tested).
- [ ] The v1 distractor validity property passes over a synthetic WaniKani list, and `similar` kanji come first (tested).
- [ ] Built-in mode: every existing test passes unchanged, and the same seed gives the same run as before (tested).

**Verification:** `npm test`
**Dependencies:** W2
**Files:** `src/core/{pool,run,distractors,tuning}.ts`, `tests/core/pool.test.ts`
**Scope:** M

### Checkpoint E1: the pure core works
- [ ] W2–W4 pass, and the bot balance test still meets its v1 thresholds in Built-in mode.

### Task W5: Token form, mode switch and wiring
**Description:**
- `src/game/wanikani.ts`: a small DOM form (paste token, save, remove), linked from the start screen with a "How to get a read-only token" hint. It is a password-type field, and the token is never shown back in full.
- A mode switch (Built-in / WaniKani) when a token is saved. The mode is stored per device.
- Start screen in WaniKani mode: `WaniKani level N · K kanji due`, a WaniKani status, placement hidden.
- Fetch on load and on return to the start screen (throttled). Runs use the W4 pool.
- Study cards show the meaning and reading mnemonics in WaniKani mode, with the safe tag-to-span rendering (pure function, tested), never `innerHTML` of raw API text.

**Acceptance criteria:**
- [ ] Mnemonic rendering: known tags styled, unknown tags stripped, script and `onerror` payloads inert (tested).
- [ ] An invalid token shows `WaniKani token invalid` and reopens the form; offline uses the cache; play is never blocked (browser check with a mocked fetch).
- [ ] `dist/` and the repo contain no WaniKani content or token: grep for a phrase from one of the owner's mnemonics and for the token prefix (manual, by the orchestrator, using the local spike cache in the scratchpad).
- [ ] Screens at 390×844: token form, WaniKani start screen, a study card with mnemonics (screenshots kept in the scratchpad, not committed, since they show WaniKani content).

**Verification:** `npm test`. Browser checks. Deploy green.
**Dependencies:** W1, W3, W4
**Files:** `src/game/{wanikani,study,scenes}.ts`, `src/main.ts`, `src/core/mnemonic.ts`, `tests/core/mnemonic.test.ts`
**Scope:** M

### Checkpoint E: v1.1 (owner, on the phone)
- [ ] The owner pastes a token on the phone; runs use their WaniKani kanji and favour due ones.
- [ ] The study screen helps after a loss, in both modes.
- [ ] Removing the token returns to Built-in mode with progress intact.
- [ ] Tune `WK_DUE_BOOST` from the owner's feedback.
