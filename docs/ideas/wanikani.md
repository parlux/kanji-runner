# WaniKani integration

Status: confirmed by owner, 2026-11-07 (during Task 13). Spiked the same day. Input for `SPEC-wanikani.md`.

## Problem Statement
How might the game drill the kanji the owner is learning on WaniKani, and teach them after a miss with WaniKani's own mnemonics, without bundling WaniKani content or touching their WaniKani schedule?

## Context
- The owner is WaniKani level 7, and has not used it in a long time: 482 reviews due, 90 of them kanji.
- At Checkpoint B the owner asked for a learning element like mnemonic SRS apps. WaniKani already teaches each kanji, so the game should practise and remind, not run lessons.

## Recommended Direction
An optional **WaniKani mode**, read-only, using the owner's personal API token.
- **Pool:** every kanji the owner has been taught on WaniKani (lesson done), at any level up to their current one. Not just the current level.
- **Weighting:** our SRS weight, boosted for kanji that are due on WaniKani now (the backlog warm-up) and for Apprentice-stage kanji.
- **Gates:** WaniKani's primary meaning on meaning gates. Reading gates accept any reading WaniKani marks as an accepted answer.
- **Distractors:** WaniKani's "visually similar" kanji first, then our existing confusables.
- **Study screen after a loss:** for each missed kanji, meaning, readings and components; in WaniKani mode, also WaniKani's meaning and reading mnemonics. Built for both modes.
- **Unlocking:** our level unlock is off in WaniKani mode; WaniKani's own level gates the pool.
- **Token:** read-only, stored per device, never synced or bundled.
- Built-in mode is unchanged. Progress records are keyed by character, so they carry over between modes.

## Spike findings (2026-11-07, owner's token)
- Subscription active (recurring, to 2027-03), `max_level_granted` 60.
- CORS: `access-control-allow-origin: *`, and preflight allows `authorization, wanikani-revision`. Direct browser calls from GitHub Pages work; no proxy.
- `GET /v2/subjects?types=kanji&levels=1..7` returns 242 kanji on one page (`per_page` 1000), about 440 KB raw. `GET /v2/assignments?subject_types=kanji&levels=…` returns 242 on one page (`per_page` 500). `GET /v2/summary` gives due review IDs.
- Kanji subject fields used: `characters`, `level`, `meanings[] {meaning, primary, accepted_answer}`, `auxiliary_meanings[] {meaning, type: whitelist|blacklist}`, `readings[] {reading, primary, accepted_answer, type: onyomi|kunyomi|nanori}`, `meaning_mnemonic`, `reading_mnemonic`, `meaning_hint`, `reading_hint`, `visually_similar_subject_ids`, `hidden_at`.
- Mnemonic markup is only `<radical>`, `<kanji>`, `<reading>`, `<vocabulary>` and `<em>` inline tags (seen in levels 1–7).
- Assignment fields used: `subject_id`, `srs_stage` (0 = lesson not done, 1–4 Apprentice, 5–6 Guru, 7 Master, 8 Enlightened, 9 Burned), `available_at` (due when ≤ now), `started_at`.
- Owner's kanji: 7 at stage 0 (excluded), 145 burned, 90 due now.
- Terms: no reproducing or redistributing WaniKani content without permission. Fetching with the user's own token for their own use is what the API is for. So WaniKani content must never be committed, bundled or published, including in test fixtures.

## Not Doing (and Why)
- **Writing reviews back to WaniKani:** answers given while dodging walls aren't real reviews, and they would skew the owner's schedule.
- **Radicals and vocabulary:** the game is kanji only. The warm-up covers 90 of the 482 due reviews.
- **Lessons before a run:** WaniKani teaches; the game practises.
- **Syncing the token through Supabase:** a third-party credential in our database isn't worth saving one paste per device.
- **Bundling or caching WaniKani data on a server:** licensing.
