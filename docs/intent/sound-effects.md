# Intent: arcade sound, and every gate says its reading

Status: confirmed by the owner, 2026-11-28, after an interview. Idea: `docs/ideas/sound-effects.md` (with `docs/ideas/soundtrack.md` folded in). Spec: `docs/specs/SPEC-sound-effects.md`. Tasks: `tasks/todo-sound-effects.md`.

## Statement of intent
- **Outcome:** runs sound like an arcade game, and every gate says its item's reading aloud in a VOICEVOX character voice, right or wrong (on a wrong gate, the correct reading after the buzz), in meaning mode too.
- **Covers:** kana, kanji, words and loanwords, always the reading the gate tests (毎年 → まいとし). Clips are pre-generated and loaded as runs need them; the phone's own Japanese voice fills in for any missing clip.
- **Sound effects:** right gate, wrong gate, the army shooting (quiet), crate or wall breaking, a pack wiped out, boss clash with a win fanfare or lose sting, level unlocked, menu taps. Synthesized chip-style in code. The voice ducks everything else.
- **Music:** two sourced chiptune loops (CC0 or CC-BY): a run loop that lifts at the boss, and a menu/end loop.
- **Controls:** voice, sound effects and music toggles on the start screen, plus a mute button during a run. All on by default; the setting is saved.
- **Priority (slices):** voice, then sound effects, then music. Music is cut first if the round runs long.
- **User:** the owner, on their phone, daily.
- **Why:** it would feel cool to play with; hearing every reading helps it stick, and replaces what WaniKani's audio gave.
- **Constraint:** VOICEVOX needs a credit line and a character whose terms allow this use; generating clips needs the VOICEVOX engine (a network host approved, or the owner's Mac).
- **Out of scope:** choosing the voice in settings (`docs/ideas/voice-choice.md`), human recordings, volume sliders, speaking English meanings, offline play or install-as-app.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Pre-generated character voice, phone voice fallback | Owner heard the phone voice (test page) and chose files: same voice everywhere, a character fits the arcade feel. Fallback lets the round ship before every clip exists. |
| Every gate, right or wrong | Owner: "every gate". A wrong gate is where hearing the right reading helps most. |
| Synthesized sound effects | Zero download, one consistent chip style. |
| Sourced music | Owner: "sourced chiptune loops sound good"; code-written music tends to sound thin. |
| Voice choice later | Owner: add it as a backlog idea, decide later. |
