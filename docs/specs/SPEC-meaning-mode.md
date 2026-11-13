# Spec: kanji meaning mode (v1.7)

Extends `docs/specs/done/SPEC.md` (v1) through `docs/specs/SPEC-reveal.md` (v1.6). Everything there still holds unless this spec says otherwise. Intent: `docs/intent/kanji-meaning-mode.md`. Idea: `docs/ideas/kanji-meaning-mode.md`.

## Objective
A second way to play for someone who reads Chinese but no Japanese: kanji prompts, English meaning answers, nothing else. It has its own progress on the device and never touches the owner's.

### User stories
- As a Chinese reader, I turn on "Meanings only" on the start screen, pick "I know up to Kanji 30", and every gate shows a kanji with English answers.
- As that player, I never see kana, readings or loanwords: not in gates, pop-ups or the end screen.
- As the owner, switching the mode on and off on my phone leaves my progress, session panel, re-asks and sync exactly as they were.

## Rules

### The switch
- A start-screen control, always visible (no token needed): "Meanings only" on/off. Remembered on the device (its own `localStorage` key). Placed so it doesn't crowd the existing start-screen controls (speed pill, level picker, WaniKani switch, sync label, build stamp) at 390×844 and 390×667.
- While on: Built-in kanji list only (the WaniKani switch is hidden or inert; WaniKani mode is not used), sync is off (no pull, no push), and the Supabase login/sync label is hidden.

### Its own save
- Progress and session log live under their own keys (e.g. `kanji-runner:meaning:v1` and a matching session-log key), loaded when the switch turns on and saved after each run while it's on. The owner's `kanji-runner:v1` and session log are never read or written in this mode.
- Switching back off reloads the owner's save; nothing carries over in either direction.
- Fresh meaning-mode progress starts at Kanji 1 (level 2): kana levels don't exist for it.

### What's asked
- Pool: kanji **meaning** entries of the unlocked levels only. No kana, reading or loanword entries, ever (whatever the boxes say). Re-asks, the new-items cap and warm-ups work as in Built-in mode, on this pool.
- Distractors: English meanings of other kanji, as meaning gates already draw.
- Levels: the existing level picker and `place`, offering Kanji 1 and up (no Hiragana/Katakana choices). Unlock by the existing 80% rule (`applyUnlock`; kanji levels already count meaning keys only).

### What's shown
- No answer reveal (v1.6) in this mode.
- End screen: the missed list as today (meaning gates already show kanji + meaning) and the session panel from this mode's log. No "Study" button and no study cards.
- Level names as today ("Kanji N").

## Testing
- **Unit:** the meaning-mode pool contains only meaning entries of unlocked levels, even with reading-eligible boxes and eligible words in the progress; fresh progress starts at level 2; placement and unlock work from Kanji 1; storage round-trips under the new keys and never touches `kanji-runner:v1`.
- **Unchanged:** the golden run and every existing test (Built-in and WaniKani modes behave exactly as before).
- **Browser:** 390×844 (and 390×667 for the start screen): switch on → place at a high level → a run with only kanji/English gates → loss end screen with no Study button; switch off → the owner's progress and session panel unchanged. Screenshots in the scratchpad.

## Boundaries
- **Always:** keep the owner's save, session log and sync untouched by this mode.
- **Never:** show kana, readings or loanwords in this mode; sync this mode's progress.

## Success Criteria
1. A run in meaning mode asks only kanji meanings at the picked level (tested and browser check).
2. The owner's progress is byte-for-byte the same after a meaning-mode session (tested).
3. No Japanese text other than the kanji themselves appears in this mode (browser check).
