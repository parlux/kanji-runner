# Intent: kanji meaning mode

Status: confirmed by the owner, 2026-11-13, after an interview. Extends `docs/intent/kanji-runner.md`. Idea: `docs/ideas/kanji-meaning-mode.md`. Spec: `docs/specs/SPEC-meaning-mode.md`, tasks: `tasks/todo-meaning-mode.md`.

## Statement of intent
- **Outcome:** a "kanji meaning" mode: every gate is a kanji with English meanings as answers. No readings, kana or loanwords anywhere.
- **User:** the owner's wife, who reads Chinese but no Japanese, playing for fun on her own phone.
- **How:** a switch on the start screen; she picks her start level with the existing level picker; levels are kanji-only (no Hiragana/Katakana) and climb by the usual 80% rule.
- **What she sees:** after a loss, a plain "kanji = meaning" list instead of full study cards.
- **Data:** Japanese meanings and glyphs are the truth; no Chinese-specific handling.
- **Success:** she can play a run at a level that challenges her without ever hitting Japanese she can't read.
- **Constraint:** the mode never touches the owner's progress: its own save on the device, never synced, never counted in the owner's session panel or re-asks.
- **Out of scope:** profiles or logins; Chinese meanings or glyphs; a learning layer for her (readings, mnemonics, WaniKani); new gameplay (run, boss, 3D and speed stay as they are).
