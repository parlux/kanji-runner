# Spec: WaniKani mode and study screen (v1.1)

Extends `docs/specs/SPEC.md` (v1). Everything there still holds unless this spec says otherwise. Idea and spike: `docs/ideas/done/wanikani.md`.

## Objective
Let the owner drill the kanji they have been taught on WaniKani, weighted towards their overdue reviews, and learn from misses on a study screen. WaniKani mode is optional; without a token the game is v1 plus the study screen.

### User stories
- As the player, I paste my WaniKani read-only token once per device, and my runs use the kanji I've learned on WaniKani.
- As a returning WaniKani user with a backlog, my runs favour the kanji that are due, so I'm warmed up before I do my reviews.
- As the player, after a loss I can study each kanji I missed: its meaning, readings and components, and in WaniKani mode its mnemonics.
- As the player, I can switch back to built-in mode at any time, and my progress carries over.

## Changes to v1 rules

### Mode
- Two modes: **Built-in** (default, v1 behaviour) and **WaniKani**. WaniKani mode is available only once a token is saved and the first fetch has succeeded (or a cache exists).
- The mode is a per-device setting, stored locally next to the token. It is not part of `Progress` and is not synced.
- Kana levels are the same in both modes. A WaniKani run still uses the kana rules for any kana items in the pool.

### WaniKani kanji list
- Built from WaniKani kanji subjects at levels 1 to the user's current level, plus their kanji assignments.
- **Taught** = an assignment with `srs_stage ≥ 1`. Untaught (stage 0, lesson not done), hidden (`hidden_at` set) and locked kanji are excluded.
- Each becomes a `KanjiItem`:
  - `glosses`: WaniKani's primary meaning first, then other meanings with `accepted_answer`, then `whitelist` auxiliary meanings. `blacklist` auxiliary meanings are never shown or accepted.
  - Meaning gates show the primary meaning.
  - `readings`: every reading with `accepted_answer`. The reading gate shows the primary reading (WaniKani has no okurigana split, so `kun` okurigana is taken from the built-in data when the character exists there, else none).
  - `components`: from the built-in data when the character exists there, else empty.
  - `level`: kept as WaniKani's level for display; it does not drive unlocking.
- Extra per-kanji data, kept beside the list, not in `KanjiItem`: WaniKani `srsStage`, `due` (`available_at ≤ now`), `similar` (characters of `visually_similar_subject_ids` that are also in the list), and the mnemonics and hints.

### Item selection in WaniKani mode
- The pool is every taught kanji. Our level unlock (80% rule) and placement are off; WaniKani's level gates the pool.
- **Seeded box:** a kanji with no game record yet is treated as if it had a box derived from its WaniKani stage: stages 1–2 → 1, 3–4 → 2, 5–6 → 3, 7 → 4, 8–9 → 5. It counts as known, not new, so the 4-new-items cap does not apply. The seeded box is never written; the first answer writes a real record via the normal Leitner update.
- **Weight** = `2^(5 − box) × (due ? WK_DUE_BOOST : 1)`, with `WK_DUE_BOOST` in `tuning.ts` (start at 4).
- Reading gates follow the v1 rule (meaning box ≥ `READING_UNLOCK_BOX`), using the seeded box when there is no record.
- Warm-ups are the highest-box known items, as in v1.
- Progress records keep the v1 key (`水:meaning`), so a kanji's record is shared between modes and the merge and sync are unchanged.

### Distractors in WaniKani mode
- Drawn from the taught pool.
- Confusable order: WaniKani `similar` kanji first, then shared-component kanji (v1 rule), then the rest. All v1 validity rules hold (no correct answer, no duplicates, no overlapping glosses or readings).

### Study screen (both modes)
- Reached from the end screen after a **loss**, via a "Study" button. After a win, the missed list stays as in v1, and a "Study" button appears only if anything was missed.
- One card per missed kanji (or kana), in the order missed: the character large, the correct meaning and readings, and its components (built-in data).
- In WaniKani mode, the card also shows WaniKani's meaning mnemonic and reading mnemonic. Their inline tags (`<radical>`, `<kanji>`, `<reading>`, `<vocabulary>`, `<ja>`, `<em>`) are shown as coloured or emphasised text; any other markup is stripped to text. Never rendered as raw HTML.
- A DOM overlay (like the login form), scrollable, with a "Play again" button. Readable at 390×844.
- Studying does not change SRS records.

### Token, fetching and caching
- The user creates a **read-only** personal access token on WaniKani and pastes it into a small form on the start screen. It is stored in `localStorage` on that device only. It is never put in `Progress`, never sent to Supabase, never logged, never bundled. A "Remove token" option clears it and the cache, and returns to Built-in mode.
- Requests go straight from the browser to `https://api.wanikani.com/v2` with `Authorization: Bearer <token>` and the `Wanikani-Revision` header. Calls: `/user`, `/subjects?types=kanji&levels=…`, `/assignments?subject_types=kanji&levels=…`, following `pages.next_url` if present.
- Fetch on app load and when returning to the start screen, at most once every 5 minutes. A fetch never blocks play.
- The trimmed result (only the fields above) is cached in `localStorage`; the raw responses are not kept. If a fetch fails, the cache is used.
- Status on the start screen, beside the sync status: `WaniKani · level N · K due`, or `WaniKani offline` (using cache), or `WaniKani token invalid` (401: the form reopens).
- The client never throws to callers, and it is the only module that talks to WaniKani.

### Start screen in WaniKani mode
- The "learned · unlocks next run" line becomes `WaniKani level N · K kanji due`.
- The placement control is hidden.
- A mode switch (Built-in / WaniKani) when a token is saved.

## Project Structure (additions)
```
src/wanikani/
  client.ts    → fetch /user, /subjects, /assignments; pagination; status; never throws
  parse.ts     → pure: API JSON → WaniKani kanji list + extras; validation
  cache.ts     → trimmed cache and token in localStorage
src/core/
  pool.ts      → pure: pool, seeded box and weights for a mode (Built-in wraps the v1 logic)
src/game/
  study.ts     → study screen overlay
  wanikani.ts  → token form and mode switch
```

## Testing Strategy (additions)
- **Fixtures are synthetic.** Test JSON mimics the WaniKani response shape with made-up characters, meanings and mnemonic text. No real WaniKani content is ever committed, in fixtures or anywhere else.
- `parse`: taught filter, hidden and stage-0 exclusion, gloss order and blacklist exclusion, accepted readings, `similar` limited to the list, bad or partial JSON → an error result, not a throw.
- `client`: mocked `fetch` covering success, pagination, 401, 429, network error and a malformed body. Each resolves with the right status and no exception. It never sends the token anywhere except `api.wanikani.com`.
- `pool`: seeded box mapping, real record overriding the seeded box, due boost, no new-items cap in WaniKani mode, reading gate rule with seeded boxes. Built-in mode is unchanged (existing tests pass untouched).
- Distractors: the v1 validity property test also runs over a synthetic WaniKani list, and `similar` kanji come first.
- Mnemonic markup: known tags map to styled spans; unknown tags and attributes are stripped; a `<script>` or `onerror` payload ends up as inert text.
- Manual / browser checks: token form, mode switch, WaniKani start screen, a WaniKani run, and the study screen in both modes, at 390×844.

## Boundaries (changes)
- **Replaces** v1's "Never use WaniKani content or its API" with:
  - **Always:** WaniKani content is fetched at runtime with the user's own token, for that user only.
  - **Never:** commit, bundle, publish or upload WaniKani content (mnemonics, meanings, subject data), including in test fixtures, screenshots committed to the repo, or Supabase. Never write to the WaniKani API (no reviews, no lessons, no study materials). Never sync the token.
  - **Ask first:** any WaniKani endpoint beyond `/user`, `/subjects`, `/assignments`, `/summary`.
- v1's ordering rule ("no WaniKani-derived data" for the built-in list) still holds for Built-in mode.

## Success Criteria
1. With no token, the game behaves as v1 plus the study screen. All v1 tests pass.
2. After pasting a token, the start screen shows the WaniKani level and due count, and a WaniKani run asks only taught kanji.
3. Over many seeded runs, due kanji appear measurably more often than non-due kanji with the same box (tested).
4. A WaniKani token that is invalid, revoked or offline never blocks play. The status says so, and the cache is used when present.
5. After a loss, the study screen lists every missed item with its answer, readings and components, and in WaniKani mode its mnemonics, readable on a phone.
6. A kanji answered in WaniKani mode keeps its record in Built-in mode, and syncs through Supabase as in v1.
7. The repo, the built bundle and the Supabase row contain no WaniKani content or token (checked by grepping `dist/` and the repo for a known mnemonic phrase and the token).
8. **Owner checkpoint:** on the phone, WaniKani mode feels like practising "my WaniKani kanji", and the study screen helps after a loss.

## Out of Scope (v1.1)
Radicals and vocabulary subjects; writing reviews to WaniKani; lessons before a run; syncing the token; WaniKani's reading-type labels on gates (on/kun); other SRS apps; showing WaniKani's own radical names in components.

## Open Questions
1. `WK_DUE_BOOST` starting at 4 is a guess; tune it after the owner plays a few backlog runs.
2. Whether burned kanji (stage 9) should drop out of the pool entirely if they crowd runs. Start with them in, at seeded box 5.
