# Spec: WaniKani stories in Built-in mode (v1.5)

Extends `docs/specs/done/SPEC.md` (v1) through `docs/specs/done/SPEC-3d.md` (v1.4). Everything there still holds unless this spec says otherwise. Intent: `docs/intent/wk-stories-builtin.md`. Idea: `docs/ideas/wk-stories-builtin.md`.

## Objective
With a WaniKani token saved, the study screen shows WaniKani's meaning and reading mnemonics ("stories") and WaniKani's radicals for every kanji WaniKani has, in **both** modes, whatever the owner's WaniKani progress. Built-in mode's kanji order, pace and runs do not change.

### User stories
- As the player in Built-in mode, when I study a kanji I missed, I read WaniKani's story for its meaning and its reading, without having been taught it on WaniKani.
- As the player, the card shows the radicals the story names (e.g. `口 mouth`), so the blue radical words in the story point at shapes I can see.
- As the player, saving my token doesn't change which kanji my runs ask.

## Changes to earlier rules

### Story library (new, device-only)
- A second WaniKani dataset beside the taught-kanji cache (SPEC-wanikani): the **story library**. It covers every kanji and radical subject at levels 1 to `user.data.subscription.max_level_granted` (falling back to `user.data.level` when that is missing), with no assignment filter.
- Per kanji, keyed by character: `meaning` and `reading` mnemonics (raw WaniKani text, rendered with the existing safe `mnemonic.ts`), and `radicals`: the kanji's `component_subject_ids` resolved to radicals, in WaniKani's order.
- Per radical: `char` (the radical's `characters`, or null), `name` (its primary meaning), and `image` (the URL of its `image/svg+xml` entry in `character_images`, only when `char` is null; else null).
- Hidden subjects (`hidden_at` set) are left out. A kanji with no mnemonics and no radicals is left out.
- Trimmed to the fields above; raw responses are never stored. Stored in **IndexedDB** (one database, one record), since about 2,000 kanji of story text is too large to sit safely in `localStorage` beside the existing cache on a phone. If IndexedDB is unavailable or refuses, the library is kept in memory for the session only.
- Read back with validation, like `parseCache`: wrong version or shape → treated as missing and refetched.

### Fetching the library
- Calls: `/user`, then `/subjects?types=kanji,radical&levels=1..N`, following `pages.next_url`. Same headers, base URL check, never-throw and status rules as the existing client. Still only `/user` and `/subjects` (no new endpoints).
- Fetched when a token is saved and no library exists, when the saved token changes, or when the library is older than 7 days. Checked on app load and on return to the start screen (the 5-minute throttle still applies). Never blocks play; until it arrives, cards look as they do today.
- "Remove token" deletes the library along with the token and cache.
- Images: a radical image is shown with `<img src>` pointing at WaniKani's own file host (the URL from the API), loaded at view time and not stored. Offline, the image is missing and the name still shows. SVG through `<img>` cannot run script.

### Study screen (both modes)
- A kanji card looks up its character in the library. When found:
  - The meaning mnemonic and reading mnemonic show as in WaniKani mode today (same headings, same tag colours).
  - The "parts" row is replaced by a **radicals** row: one chip per radical, showing the character (or the image, sized to the text) and the WaniKani name under or beside it, e.g. `口 mouth`. Radical chips use the same blue as `<radical>` in the stories.
- When not found (no token, library not loaded yet, or a kanji WaniKani doesn't have), the card is exactly today's card: Built-in "parts" row, no stories, no note.
- In WaniKani mode the library is used the same way; if it is missing, the mnemonics from the taught-kanji cache are used as today.
- Meaning, readings and every other field still come from the mode's own kanji data. A reading story about a reading Built-in doesn't show is shown unchanged (known rough edge, out of scope).
- Studying still never changes SRS records.

### Token save and mode
- **Changes SPEC-wanikani's token flow:** saving a token no longer switches to WaniKani mode. The mode stays as it was (Built-in for a first token). The Built-in / WaniKani switch is the only way to change mode.
- Status text, the token form and everything else on the start screen are unchanged.

## Project Structure (changes)
```
src/wanikani/
  stories.ts       → pure: /subjects pages → story library; validation of a stored library
  storystore.ts    → IndexedDB load/save/delete behind a small async interface (in-memory fallback)
  client.ts        → + fetchStories(): /user + /subjects?types=kanji,radical, never throws
src/game/
  wkstate.ts       → owns the library: refresh rules, remove, lookup by character; save no longer switches mode
  study.ts         → radicals row
src/core/
  study.ts         → StudyCard gets optional `radicals`; studyCards takes a story lookup (both modes)
```

## Testing Strategy (additions)
- **Fixtures are synthetic**, as before: made-up characters, radical names and story text. No real WaniKani content in the repo.
- `stories`: radicals resolved in order; a radical without characters gets the SVG URL; hidden subjects dropped; missing `max_level_granted` falls back to level; bad pages → error result, not a throw; stored-library validation rejects wrong version or shape.
- Client: mocked `fetch` for the story fetch: success across pages, 401 → invalid, network error / 429 / malformed → offline, URL only under `https://api.wanikani.com/v2/`.
- Refresh rules with an injected clock and in-memory store: fetch when missing, token changed, older than 7 days; not otherwise. Remove token deletes it.
- `studyCards` in Built-in mode with a library: stories and radicals attached by character; a kanji not in the library is unchanged; with no library every card equals today's (existing tests pass untouched).
- `wkstate`: saving a token keeps Built-in mode (replaces the "switches to WaniKani" test).
- Browser checks at 390×844 with a mocked fetch and synthetic data: a Built-in study card with stories and a radicals row (character and image chips); a card for a kanji not in the library; no token. Screenshots in the scratchpad only.

## Boundaries
- All SPEC-wanikani boundaries hold: never commit, bundle, publish or upload WaniKani content (stories, radical names, images, URLs from real responses), including fixtures and committed screenshots; never write to WaniKani; never sync the token or the library.
- **New, allowed by this spec:** loading radical images from the URLs WaniKani's API returns. Any other new host or endpoint: ask first.
- Built-in mode's kanji list, order, pool and runs: unchanged. No task edits `src/core/{pool,run,sim,srs,progression}.ts`.

## Success Criteria
1. With no token, the study screen is exactly as before; all existing tests pass.
2. With a token, in Built-in mode, a studied kanji that WaniKani has shows both stories and its WaniKani radicals with names, whether or not the owner has been taught it on WaniKani.
3. A kanji WaniKani doesn't have shows today's card.
4. Saving a token leaves the game in Built-in mode; runs ask the same kanji as before (same seed, same run).
5. The library is fetched at most once per 7 days per token, never blocks play, survives a reload (IndexedDB), and is deleted by "Remove token".
6. The repo and `dist/` contain no WaniKani content or token (grep for a phrase from one real story and the token prefix, by the orchestrator, using data in the scratchpad).
7. **Owner checkpoint:** on the phone, after a Built-in loss, the study cards read like WaniKani lessons for those kanji, and the radical names in each story match the chips on the card.

## Out of Scope (v1.5)
Vocabulary subjects and stories; meaning and reading hints; WaniKani's user study-material notes and synonyms; changing Built-in order or pace; rewriting stories for readings Built-in shows differently; showing stories during a run; caching radical images offline.

## Open Questions
1. Card height: two stories plus radicals make cards long on a phone. Start with everything shown; collapse stories behind a tap only if the owner finds the list too long.
2. Whether the taught-kanji cache should drop its own mnemonics once the library exists (saves space). Not needed for this round.
