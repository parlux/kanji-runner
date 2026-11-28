# Spec: arcade sound, and every gate says its reading

Intent: `docs/intent/sound-effects.md` (2026-11-28). Tasks: `tasks/todo-sound-effects.md`. Ideas: `docs/ideas/sound-effects.md`, `docs/ideas/soundtrack.md` (folded in). Later idea: `docs/ideas/voice-choice.md`. Versions: **1.12.0** (voice, phone fallback), **1.13.0** (sound effects), **1.14.0** (character clips; swapped 2026-11-28 so effects don't wait on the voice pick), **1.15.0** (music). Music is cut first if the round runs long.

## Objective
The game has no sound today. Add, in priority order:
1. **Voice:** every gate says its item's reading as the army passes it, right or wrong, in every mode; a VOICEVOX character from pre-generated clips, the phone's Japanese voice for any clip that's missing.
2. **Sound effects:** 8 chip-style sounds, synthesized in code.
3. **Music:** two sourced chiptune loops.
Each can be turned off; a mute button in runs. Success: on the owner's phone a run sounds like an arcade game, and every gate's reading is heard clearly over the rest.

## 1. What a gate says (core, pure; `src/core/speech.ts`, new)
`spoken(row, ctx): Spoken | null` gives `{ text, reading }`: `reading` is the kana to say, `text` the written form that helps the voice get pitch accent right (the word for words; the reading itself otherwise).

| Gate | Says | Example |
|---|---|---|
| `kana` | the kana's sound | あ → あ, ア → あ |
| `meaning` (kanji) | the run's shown reading (`shownReading(k, turn)`), so it matches reading gates that run (amended in A1: `turn` is the kanji's reading `seen` count in the progress the run was built from, the same turn the run's first reading gate for it uses; `ctx` is `{ kanji, words, progress }`) | 日 → にち |
| `reading` | the answer, okurigana included, brackets dropped (`plainReading`) | 上 → あげる (amended in A1: 上's main kun'yomi in the data is うえ, so the test crafts an あ(げる) row and also checks 休 → やすむ) |
| `word`, `wordreading` | the word's `reading` | 毎年 → まいとし |
| loanword `word` | the word itself | テレビ |

- Re-asks say the same as their gate. Placement and warm-up gates are gates like any other.
- **Clip key:** `clipKey(s)` = `text|reading` with katakana in `reading` folded to hiragana for kana and kanji readings (loanwords keep katakana). Keys are stable across builds; the clip build and the game both use this one function.
- `allSpoken(data)`: every key the game can ask for (all kana, every kanji's main readings, every word and loanword). Used by the clip build and the coverage report.

## 2. When it's said (game)
- When a gate row resolves (its result is recorded): right → chime, then the voice ~120 ms later; wrong → buzz, then the voice ~300 ms later (before 1.13.0, with no sound effects, the voice starts at once).
- One voice line at a time; a new gate's line cuts the previous one.
- The run's clips are fetched and decoded when the run is built (its 14 gates plus re-asks), so a gate never waits on the network. A clip not ready in time → phone voice.

## 3. Clips (script; `scripts/voice/`, `npm run voice:build`)
- Talks to a running VOICEVOX engine over its HTTP API (default `http://127.0.0.1:50021`; `VOICEVOX_URL` overrides). Character and style in `scripts/voice/voice.config.json` (speaker id, name for the credit, speed).
- Per key: `audio_query` on `text`; if the query's moras read (in hiragana) exactly `reading`, use it (dictionary pitch accent); otherwise query the kana `reading`. Report how many fell back.
- Encode with `ffmpeg`: trim leading and trailing silence, mono AAC in `.m4a` at ~40 kbps (plays in iPhone Safari). Target ≤ 6 KB a clip.
- Output: `public/voice/<voice-id>/<hash8>.m4a` and `public/voice/<voice-id>/index.json` (`{ key: [file, ms] }`). Incremental: existing clips are kept unless `--force`; keys no longer used are deleted.
- `npm run voice:coverage`: keys in `allSpoken` without a clip (reported, never fails the build: the phone voice covers them). New data later → rerun the build.
- Expected size: ~3,500–4,500 clips, ~15–25 MB in `public/`; a phone only downloads the clips its runs use (index ~150 KB, once).
- **Where it runs:** a cloud session with the VOICEVOX engine's Linux CPU release (needs GitHub access to `VOICEVOX/voicevox_engine` releases, asked for in Task A3), or the owner's Mac with the VOICEVOX app open. Clips are committed, so the deploy never runs VOICEVOX.

## 4. The character
- Task A3 renders the same 8 test words (毎年, 一人, 今日, 大人, 日本, 一つ, にち, テレビ) in 4–5 candidates, each with its terms checked for a free web game with bundled clips, on a sample page. The owner picks at **Checkpoint V**.
- Starting candidates: ずんだもん, 四国めたん, 春日部つむぎ, 冥鳴ひまり, 青山龍星 (male). Drop any whose terms don't allow this use.
- Credit as the character's terms ask (e.g. `VOICEVOX:ずんだもん`): on the start screen and in the README's Attribution.

## 5. Audio (game side; `src/audio/`, new layer)
- `src/audio/` imports only `core/`, `data/` and itself; `game/` uses it. New depcruise rule: `audio/` never imports `game/`, `storage/`, `sync/` or `wanikani/`.
- One `AudioContext`, created and resumed on the first tap (iOS needs a gesture). Where Safari has `navigator.audioSession`, set its type to `"playback"` so sound plays with the ringer switch off.
- Three buses (voice, sfx, music) into one master. **Ducking:** while a voice line plays, sfx and music drop to `DUCK_LEVEL` 0.35 (attack 60 ms, release 250 ms). Pure envelope maths in `src/audio/duck.ts`, unit-tested.
- **Fallback voice:** `speechSynthesis` with `lang` `ja-JP`, the first Japanese voice, saying `reading`; used when a clip is missing or failed to load. No ducking for it (it bypasses Web Audio); fine.
- No sound and no errors when audio is unavailable (tests, old browsers).

## 6. Controls
- Settings `{ voice, sfx, music, muted }`, all on and not muted by default, in `localStorage` key `kanji-runner:audio` (own key: no `Progress` save change, not synced). Bad or missing value → defaults.
- **Start screen:** three toggles (Voice, Sound, Music), plus the credit line in small type.
- **Run:** a mute button in a top corner, clear of the HUD; mutes everything until tapped again (saved). Tap target ≥ 44 px.
- Turning a toggle off stops that bus at once; music resumes from the loop start when turned on.

## 7. Sound cues (core, pure; `src/core/cues.ts`, new)
`cues(prev, next): Cue[]` from two run states one step apart, so the sim stays free of sound:
`gate-right` / `gate-wrong` (with the row, for the voice), `shot` (at most one per `SHOT_CUE_MS` 90 ms of fire), `hazard-broken` (crate or wall), `pack-wiped`, `boss-clash`, `boss-won`, `boss-lost`. End-screen `unlock` and menu `tap` come from the scenes, not the sim.
(Amended in A5: `cues(prev, next)` reports a `shot` on every step with fire (a target or a wall being shot); `limitShots(cues, dtMs, wait)` rate-limits them with a carried wait in ms. `hazard-broken` is a block shattered (crates are blocks; saws can't break); `pack-wiped` is a pack's enemies all dead. The boss clash lives in the scene, so `bossCues(prevFrame, nextFrame)` gives `boss-clash` when the approach ends and `boss-won`/`boss-lost` when the clash is done; `src/game/cues.ts` joins both, and the loop is in `src/main.ts`.)

## 8. Sound effects (1.13.0; `src/audio/sfx.ts`)
- Each sound is a small parameter set (wave, start/end frequency, envelope, optional noise and arpeggio), sfxr style, played through the sfx bus. No files.
- Sounds: right gate (bright rising two-note chime), wrong gate (short low square buzz), shot (very short, quiet tick, random pitch ±5%), hazard broken (noise crunch), pack wiped (falling sweep), boss clash (low rumble while clashing), boss won (4-note fanfare), boss lost (descending sting), unlock (5-note jingle), tap (tiny blip).
- Shots sit well under the voice: peak ≤ 0.15 of the right-gate chime.

## 9. Music (1.15.0; `public/music/`)
- Two loops from CC0 or CC-BY chiptune packs (OpenGameArt or similar): **run** (upbeat, ~90–120 s) and **menu** (calm; menu, study card and end screen). Boss lift: the pack's boss/intense variant if it has one, else the run loop at playback rate 1.06. Crossfade 400 ms between them.
- `.m4a` at ~96 kbps, ≤ 1.5 MB each. Licence, author and link in `public/music/CREDITS.md` and the README's Attribution.
- Task A7 offers 2–3 candidates per slot in its report (links); it picks one, the owner judges at the checkpoint.

## Commands
`npm run check` before every tick; `npm run check:fast` per slice; `npm run voice:build`, `npm run voice:coverage` (A3–A4).

## Project structure
- New: `src/core/speech.ts`, `src/core/cues.ts`, `src/audio/` (`engine.ts`, `voice.ts`, `duck.ts`, `sfx.ts`, `music.ts`, `settings.ts`), `scripts/voice/` (`build.ts`, `coverage.ts`, `voice.config.json`), `public/voice/`, `public/music/`.
- Changed: `src/game/scenes.ts` (start toggles, unlock and tap cues), `src/game/loop.ts` (cues per step, run clip prefetch), `src/game/hud.ts` (mute button), `.dependency-cruiser.cjs`, `knip.json` if needed, `README.md` (Attribution).
- Tests: `tests/core/speech.test.ts`, `tests/core/cues.test.ts`, `tests/audio/duck.test.ts`, `tests/audio/settings.test.ts`.

## Testing
- `speech.test.ts`: every gate type says the table's reading; ア and あ share a key; 上's reading gate says あげる; meaning gates follow `shownReading`; re-asks match their gate; every spoken key from a built run is in `allSpoken`.
- `cues.test.ts`: crafted state pairs give right/wrong gate with the row, hazard broken, pack wiped, boss clash/won/lost; shots rate-limited; a step with nothing happening gives no cues; a whole simulated run gives exactly one gate cue per row.
- `duck.test.ts`: level over time through attack, hold, release; overlapping lines extend the hold.
- `settings.test.ts`: defaults, round trip, bad JSON → defaults.
- Offscreen 390×844 renders: start screen with toggles and credit, a run with the mute button.
- On the phone (checkpoint): readings are clear over music and effects; nothing plays twice; toggles and mute work and stick.

## Boundaries
- Always: no `Progress` save change; the sim stays pure (cues are derived outside it); audio failures are silent; `npm run check` green; commit and push each slice.
- Ask first: a new runtime dependency; anything over ~30 MB of clips; a character other than the one the owner picked; music under a licence other than CC0 or CC-BY.
- Never: ship WaniKani audio, Forvo or other clips that don't allow reuse; commit the VOICEVOX engine or its models.

## Success criteria
- Tests above pass; `npm run check` passes; deploy green after each shipping task.
- Coverage report: ≥ 99% of `allSpoken` keys have a clip after A4.

## Out of scope
Choosing the voice in settings (`docs/ideas/voice-choice.md`); human recordings; volume sliders; speaking English meanings; offline play or install-as-app; voice on the study card.

## Open questions
- ~~The character~~: 青山龍星, 熱血 style (id 81), picked at Checkpoint V.
- ~~Where clips get generated~~: settled in A3: the VOICEVOX engine's Linux CPU release runs in a cloud session (`scripts/voice/README.md`); the Mac steps stay as a fallback.
- Timing (voice delay after the chime), `DUCK_LEVEL` and loudness: tuned at the checkpoint.
