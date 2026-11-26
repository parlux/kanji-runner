# Spec: change speed from the pause screen

Intent: `docs/intent/pause-speed.md` (2026-11-26). Tasks: `tasks/todo-pause-speed.md`. Extends the pause card (`done/SPEC-reveal.md`) and the speed setting.

## Today
- Speed presets `SPEED_PRESETS` (relaxed 0.7, normal 0.85, fast 1.0) are read every frame (`src/main.ts`, `panels.speed()`), so a change applies at once. Settings saves them with `saveSpeed` (device only, not synced).
- Pausing a run or the boss clash shows the DOM pause panel (`src/game/ui/pausecard.ts`: "Paused", last answer, study card, "Tap or P to resume") once there is an answer and not in Meaning mode. Otherwise the canvas draws a plain "Paused" (`renderPaused` in `src/game/hud.ts`). A tap on the panel resumes.

## Rule
- **Every pause screen** shows the DOM pause panel. With a last answer (and not Meaning mode): as today. Otherwise: the title, the speed row and the hint only. The canvas then draws only the dimming and the build label (`renderPaused` with its panel flag always true while paused).
- **Speed row:** under the card, above the hint. Three buttons Relaxed / Normal / Fast, the current one marked, styled as the Settings segmented control (same look: `.seg`, 44 px tall, `aria-checked`, `role="radio"`). Tapping one sets the speed and saves it exactly as Settings does (`panels.ts` `speed` + `saveSpeed`), re-marks the row, and does **not** resume (the click doesn't reach the panel's resume handler). Tapping anywhere else on the panel still resumes; P still resumes.
- The study card keeps its scroll area; the row and hint stay on screen (the panel's max height is shared, the card scrolls).
- Same three presets; nothing in `core/` changes.

## Tests
- Pure parts where they exist (e.g. which panel content shows for: no answer, answer, Meaning mode). A DOM test is optional; the project has no DOM test setup for the pause card, so a browser check covers it.
- Browser check at 390×844: paused with a card and paused before the first answer, each showing the row with the current speed marked; a speed tap changes `kanji-runner:speed` in localStorage and leaves the scene paused.

## Out of scope
Opening Settings from pause, new presets, speed controls outside the pause screen.
