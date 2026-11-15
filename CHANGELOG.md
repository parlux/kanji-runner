# Changelog

## 1.2.0 (2026-11-15)

Reading stories match the reading.

- The study and pause cards show the reading story for the reading the run showed, not always the kanji's one.
- When the kanji's WaniKani story doesn't cover that reading, the story comes from a WaniKani vocabulary word read that way, labelled "from <word>".
- No story for a reading: "No story for this reading. This one just needs remembering."
- A kanji only asked for its meaning shows every reading's story.
- Stories now fetch WaniKani vocabulary too; the saved story library is refetched once in the new format.

## 1.1.1 (2026-11-15)

- Tapping Study on the end screen opens it on phones (it closed at once: the tap also hit its Back button).

## 1.1.0 (2026-11-15)

Straight fire. The pause screen shows `v1.1.0 · <hash> · <time>`.

- Fire goes straight ahead, lane by lane; each lane hits the nearest thing in front of it.
- Crates block the lanes behind them: no more hits through a crate.
- One firing range (12) for crates, packs and walls.
- Crates retuned (1.3x HP, same reward) and gate growth retuned (0.8x) so they feel as hard as before.
- The balance bot judges a crate by the lanes it covers.
- 里 shows "hometown" instead of "ri" (gloss override).
- 厘 shows "tiny bit" instead of "rin".

## 1.0.0 (2026-11-15)

First tagged release. The pause screen shows `v1.0.0 · <hash> · <time>`.

### Game
- Crowd runner: steer an army through gates that ask a kanji, with crates, saws, enemy packs, squads and a boss at the end of every run.
- Built-in kanji levels with kana first, spaced repetition, and katakana loanwords in kanji levels.
- Ask again: missed or guessed items come back a few rows later and only move up when answered right twice.
- WaniKani mode (read-only token): runs weighted toward overdue reviews, plus a study screen with meanings, readings, radicals and mnemonics in both modes.
- Meanings-only mode for readers of Chinese, with its own progress that never touches the main save.
- Session progress: what you fixed and what is still missing in this sitting, after every run.
- Summary screen after a run: result, progress to the next level, misses with answers, and Play again, Study and Home buttons.
- 3D run and boss clash with a low follow camera, deep fog-in view distance and five sceneries (country, spring village, stadium, sky road, city).
- Hordes: enemy packs are crowds of up to about 200 weak enemies that your fire mows down.
- Optional Supabase sync between devices; localStorage stays the primary store.

### Clean-up (v1)
- Tests split into a fast tier (about 15 s) and a slow tier; `npm run check` runs test, typecheck, lint, knip, dependency rules and build.
- Faster agent loop: edit hook, parallel `check:fast`, `tsgo` typecheck.
- Removed the 2D renderer, the sandbox and URL flags (`?2d`, `?fps`, `?scenery`), and dead code found by knip (source 16.2k to 13.6k lines).
- Layer rules enforced by dependency-cruiser; `render.ts`, `core/sim.ts`, `three/world.ts`, `three/scenery.ts` and `main.ts` split so no file is over 600 lines.
- A device without WebGL shows a message instead of a broken start screen.
