# Changelog

## 1.6.13 (2026-11-21)

- Kanji parts are now the chunks you see (閉 = gate + 才), from KanjiVG instead of the smallest strokes.

## 1.6.12 (2026-11-21)

- Our own stories for Kanji 1–4 (120 kanji), in the sound-highlight form: Kanji 1–6 no longer need WaniKani's stories.

## 1.6.11 (2026-11-21)

- Reading stories (Kanji 5–6): no closing explainer and no kana; the sound-alike chunk is highlighted in the story (a steel **sa**fe). The checker now requires the new form.

## 1.6.10 (2026-11-21)

- Reading stories get a `<sound>` highlight tag: checker rules (behind a temporary flag), card style, review page shows the reading above each story, STYLE.md rewritten.

## 1.6.9 (2026-11-21)

- Story dictionary: せい keyword "safe" (was "sail", the part name of 方); 性 reading story rewritten.

## 1.6.8 (2026-11-21)

- Story dictionary: らん runway, ろ rodent, part 艮 robot (clashes between part names and sound keywords removed).

## 1.6.7 (2026-11-21)

- Story dictionary: the owner's final part and sound review applied (26 part names such as 甘 yoke, 頁 rubber duck, 酉 dynamite; r-sounds now use r-words: ら rah-rah, らい rhino, りつ Ritz crackers…). Notes and the touched stories rewritten to match; review-only alternatives removed.

## 1.6.6 (2026-11-21)

- Review page: every part up for review now offers 2-3 alternative names (91 parts newly given options).

## 1.6.5 (2026-11-21)

- Review page: each tab also counts items marked ✗ (the r-sounds showed "0 left" while still needing work). Name and keyword options for the last 5 parts and 11 sounds (r-sounds now offer r-words).

## 1.6.4 (2026-11-20)

- Review page: alternative names show as chips; one click picks one. Round 3 of part names from the owner's review (巴 bed, 廾 goal, 毋 window, 巛 speed zone, 耒 plough, 生 life, 屮 sprout and nine more).

## 1.6.3 (2026-11-20)

- Story dictionary: 126 parts named by their own meaning (戈 spear, 豕 pig…) are marked fixed and left off the review page; round 2 of part names, sound keywords (vowel rule) and Kanji 5–6 stories.

## 1.6.2 (2026-11-20)

- Review page saves verdicts optimistically: a click shows at once, a brief "saved ✓" confirms the write, and a failed save reverts the row with an error.

## 1.6.1 (2026-11-20)

- Word lists no longer reserve a quarter of each level for one-kanji words, which brought in odd readings (行 ぎょう, 下 もと). One-kanji words now compete with compounds on usefulness.

## 1.6.0 (2026-11-17)

Kanji levels reordered by usefulness for travel.

- Levels now start with the kanji you meet most on a trip (menus, stations, shops, signs) instead of school grade order.
- Your progress carries over: every kanji and word you learned is kept, and you land on the level that fits what you know.
- New coverage report tool (`npm run data:coverage`) shows how much of travel texts and children's stories each level unlocks.
- New data credits: Tatoeba sentences (CC BY 2.0 FR) and Aozora Bunko stories (public domain, dev check only), see the README.

## 1.5.0 (2026-11-17)

Kanji words join the runs.

- Kanji words (JMdict, ranked by TUBELEX subtitle frequency) come as meaning and reading gates.
- Word gates get their own tint on the prompt and the gate frame.
- A level's own words come first; at most 2 new words per run.
- The summary and study card show a kanji word's reading, meaning and kanji.

## 1.4.0 (2026-11-17)

Reading gates teach the readings people actually use.

- Each kanji's gate teaches its most-used on'yomi and kun'yomi, counted from common JMdict words; kun'yomi are counted from words where the kanji stands alone.
- Overrides are checked against a researched golden set of 373 kanji.
- Examples: 明 あか(るい), 生 い(きる), 木 もく.

## 1.3.0 (2026-11-17)

On'yomi stories from compound words.

- An on'yomi with no WaniKani kanji story and no single-kanji word story (like 家 か) borrows the reading story of a compound word that uses it, labelled "from <word> <reading>".
- The compound is the lowest-level WaniKani word with that reading whose story actually mentions it; filler stories are skipped, and "no story" stays when nothing fits.
- Kun'yomi are unchanged. The saved story library is refetched once in the new format.

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
