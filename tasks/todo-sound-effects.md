# Tasks: arcade sound, and every gate says its reading (v1.12.0–1.15.0)

Spec: `docs/specs/SPEC-sound-effects.md` (2026-11-28). Intent: `docs/intent/sound-effects.md`. Ideas: `docs/ideas/sound-effects.md`, `docs/ideas/soundtrack.md`.
Review: https://claude.ai/artifact/3JXQ6DPMb442Perp7cFZu7
Voice samples (Checkpoint V): https://claude.ai/artifact/CR5Q6CpsxNeeWepGt8mU6G
Runs while Checkpoints P, R and S wait on the owner's play; this is the active list for "implement the next round".
Every task: `npm run check` passes before it is checked off. Each task is one commit series on the session branch, pushed.

### Task A1: What a gate says; the voice with the phone's voice (opus: new layer)
Spec §1, §2, §5 (voice bus, fallback, no ducking yet). `src/core/speech.ts`; `src/audio/` with engine and voice; gates speak through `speechSynthesis` while no clips exist; depcruise rule for `audio/`.
- [x] `speech.test.ts` from the spec passes.
- [x] A crafted run in the dev server speaks each gate once, right or wrong (checked with a stubbed `speechSynthesis` log in the report).
- [x] `npm run check` passes (including the new layer rule).

### Task A2: Toggles, mute, settings; ship 1.12.0 (sonnet)
Spec §6. Start-screen toggles (Voice now; Sound and Music shown, wired as their slices land, or hidden until then), run mute button, saved settings.
- [x] `settings.test.ts` passes.
- [x] Offscreen 390×844 renders: start screen with toggles, a run with the mute button; paths in the report.
- [x] `package.json` 1.12.0; `CHANGELOG.md` has the 1.12.0 section.
- [x] `npm run check` passes; deploy green (deploy pending a merge to main).

### Task A3: Clip build and voice samples (opus: tooling and terms)
Spec §3, §4. `scripts/voice/build.ts` and `coverage.ts`; get a VOICEVOX engine running (cloud: ask for GitHub access to `VOICEVOX/voicevox_engine` releases; else write the owner's Mac steps); render the 8 test words in 4–5 candidates; check each candidate's terms; publish a sample page (Artifact) with players and the terms per candidate.
- [x] `npm run voice:build` works against a running engine for a handful of keys; report how the engine was run. (Engine 0.26.2 Linux CPU release in the session scratchpad; steps in `scripts/voice/README.md`.)
- [x] Sample page link in the report; each candidate's terms summarised with a link. (Page written; published by orchestrator.)
- [x] `npm run check` passes.

### Checkpoint V: owner picks the voice
- [ ] Listen on the sample page; pick one character (and style, if it has several).

### Task A4: All clips; the game plays them; ship 1.13.0 (opus: data, ~4,000 items)
Spec §2, §3, §4. Full build for the picked character; prefetch per run; clip first, phone voice fallback; credit on the start screen and in the README.
- [ ] Coverage report: ≥ 99% of keys have a clip; total size and word-query fallback count in the report.
- [ ] Spot check of 20 random clips (list in the report) for wrong readings; fixes noted.
- [ ] `package.json` 1.13.0; `CHANGELOG.md` has the 1.13.0 section.
- [ ] `npm run check` passes; deploy green.

### Task A5: Sound cues from the run (sonnet, core)
Spec §7. `src/core/cues.ts`; the loop gathers cues per step and hands gate cues to the voice (replacing A1's direct hook).
- [ ] `cues.test.ts` from the spec passes.
- [ ] `npm run check` passes (knip: cue kinds without sounds yet marked or wired).

### Task A6: Sound effects and ducking; ship 1.14.0 (opus: feel)
Spec §2 timing, §5 ducking, §8. Synthesized sounds; Sound toggle wired; unlock jingle and menu taps.
- [ ] `duck.test.ts` passes.
- [ ] A short recording or per-sound description in the report (each sound's parameters); voice clearly over effects in a dev run.
- [ ] `package.json` 1.14.0; `CHANGELOG.md` has the 1.14.0 section.
- [ ] `npm run check` passes; deploy green.

### Task A7: Music; ship 1.15.0 (sonnet) — cut first if the round runs long
Spec §9. Pick two loops (candidates with links and licences in the report), boss lift, crossfades, Music toggle wired, credits.
- [ ] `public/music/CREDITS.md` and README Attribution list each track's licence and author.
- [ ] `package.json` 1.15.0; `CHANGELOG.md` has the 1.15.0 section.
- [ ] `npm run check` passes; deploy green.

### Checkpoint A: owner plays with sound
- [ ] Every gate says its reading, right or wrong, in the picked voice; it's clear over music and effects.
- [ ] The effects feel arcade and none gets annoying after a few runs (the shots especially).
- [ ] Music fits and lifts at the boss; menu music is calm.
- [ ] Toggles and the mute button work and are remembered after a reload.
- [ ] Timing and loudness: voice too early, late, loud or quiet → tune.
