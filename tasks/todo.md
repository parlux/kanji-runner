# Tasks: Kanji Runner

Plan: `tasks/plan.md`. Spec: `SPEC.md`.
Every task: `npm test && npm run lint && npm run build` pass before it is checked off.

## Phase 1: Playable slice

### Task 1: Scaffold project
**Description:** Set up Vite + TS (strict) + Vitest + ESLint/Prettier with the spec's npm scripts, an `index.html` with a full-screen canvas, `.gitignore` (including `.env.local`), and `.env.example`.

**Acceptance criteria:**
- [x] All spec commands exist. `npm test` runs one trivial test.
- [x] `npm run dev` shows a blank, resizable canvas filling the viewport.
- [x] Vite `base` is `/number-runner/` for builds.

**Verification:** `npm test`, `npm run lint`, `npm run build`. Open the dev server.

**Dependencies:** None
**Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `src/main.ts`, `.gitignore`, `.env.example`
**Scope:** M (config-heavy, low risk)

### Task 2: Core rules for a kana run
**Description:** TDD the pure pieces a kana-only run needs:
- `rng.ts`: a seeded PRNG.
- `tuning.ts`: all tuning constants.
- `scoring.ts`: the streak/payoff curve, the cap and the wrong-answer penalty.
- `kana.json`: hand-written hiragana and katakana (with dakuten) mapped to romaji.
- `run.ts`: builds 20 rows from a seed. Prompts are chosen uniformly for now, with 2 options for rows 1–10 and 3 options after that. Distractors are random and never the correct romaji.

**Acceptance criteria:**
- [x] Scoring matches the spec table at every streak boundary (1, 2, 3, 4, 5, 7, 8) and the +150 cap. A wrong answer applies `max(5, ceil(30%))` with a floor of 0.
- [x] The same seed gives an identical run, and different seeds give different runs.
- [x] No row has a duplicate option or a distractor equal to the answer.

**Verification:** `npm test -- core`
**Dependencies:** T1
**Files:** `src/core/{rng,tuning,scoring,run,types}.ts`, `src/data/kana.json`, `tests/core/*.test.ts`
**Scope:** M

### Task 3: Playable kana run on laptop
**Description:**
- A fixed-timestep loop.
- A canvas renderer: track, lanes, gate rows with the prompt banner and options, the army as up to 200 circles with a count label.
- Keyboard input: ←/→ to change lane, Enter/Space to start, P to pause.
- Scenes: start → run → a basic end screen showing army, accuracy and seed.
- Speed ramps from 1.0× to 1.6×. When a row passes the army, the lane's option is resolved through `scoring.ts`.

**Acceptance criteria:**
- [ ] A full 20-row kana run plays start to finish with arrow keys only. An army of 0 ends the run.
- [x] Row lead time is about 3.0 s at the start and about 1.8 s at the end (tuning values).
- [x] Runs at 60 fps on the laptop (devtools performance check).

**Verification:** Tests, lint and build pass. Manual playthrough in the browser.
**Dependencies:** T2
**Files:** `src/game/{loop,render,input,scenes}.ts`, `src/main.ts`
**Scope:** M

### Task 4: Touch controls and GitHub Pages deploy
**Description:**
- Touch input: tap the left or right half, or swipe.
- Layout for a portrait phone viewport, with `touch-action: none` and no zoom or scroll.
- A GitHub Actions workflow that builds and deploys to Pages on push to `main`.

**Acceptance criteria:**
- [ ] A full run is playable with touch only in a narrow mobile viewport.
- [ ] Push to `main` deploys, and the site loads at `https://parlux.github.io/number-runner/`.

**Verification:** Mobile viewport emulation. The Actions run is green. Open the site on the phone.
**Dependencies:** T3. **Owner must make the repo public and enable Pages (source: GitHub Actions) first.**
**Files:** `src/game/input.ts`, `index.html`, `.github/workflows/deploy.yml`
**Scope:** S

### Checkpoint A
- [ ] Tests, lint and build pass
- [ ] Owner playtests on laptop and phone: speed, readability, Japanese font rendering
- [ ] Adjust `tuning.ts` from feedback before Phase 2

## Phase 2: Learning loop

### Task 5: Kanji data pipeline
**Description:** `scripts/build-data.ts` (run with tsx) downloads KANJIDIC2 and KRADFILE into a gitignored cache and keeps only Jōyō kanji. It orders them by grade, then frequency, then the component pass, then `order-overrides.json`. For each kanji it picks:
- the shortest clean primary gloss, with `gloss-overrides.json` available;
- the main on'yomi and kun'yomi, normalized to hiragana, with the okurigana split out and dashes stripped;
- its components.

It also emits `confusables.json` (the kana look-alikes list plus a component index) and a report of questionable glosses.

**Acceptance criteria:**
- [ ] `npm run data:build` regenerates `src/data/kanji.json` deterministically, and the raw files are not committed.
- [ ] Data test: every kanji has at least one gloss and at least one reading, there are no katakana readings, and every level has 30 kanji except the last.
- [ ] The first 30 kanji look sensible on manual review (一 二 三 人 口 山 …), and every component comes before the kanji it appears in.

**Verification:** `npm run data:build && npm test -- data`. Read the gloss report.
**Dependencies:** T1 (parallel-safe with T2–T4)
**Files:** `scripts/build-data.ts`, `scripts/order-overrides.json`, `scripts/gloss-overrides.json`, `src/data/{kanji,confusables}.json`, `tests/data/kanji.test.ts`
**Scope:** M (highest data risk)

### Task 6: Kanji meaning and reading gates with distractor rules
**Description:** Add the `meaning` and `reading` gate types and `distractors.ts` with the full spec rules:
- Distractors come from the same gate type, drawn from the unlocked pool plus the next level.
- Never use a distractor whose gloss overlaps a correct gloss, or that is any reading of the prompt kanji.
- Prefer confusables (kana look-alikes, kanji sharing a component).
- Reading options are within ±1 kana of the correct reading's length.
- The shown reading rotates. Kun'yomi render as あ(げる).

Base rewards are 3, 5 and 8 for kana, meaning and reading.

**Acceptance criteria:**
- [ ] Property test over all items and many seeds: no option is ever a valid answer for the prompt, and there are no duplicates.
- [ ] When a confusable exists in the pool, it is chosen over a random item (seeded test).
- [ ] Meaning and reading gates render correctly in game, with the okurigana greyed.

**Verification:** `npm test -- distractors`. Manual run with kanji unlocked via a dev flag.
**Dependencies:** T2, T5
**Files:** `src/core/{distractors,run,types}.ts`, `src/game/render.ts`, `tests/core/distractors.test.ts`
**Scope:** M

### Task 7: SRS and local persistence
**Description:**
- Define the `Progress` type in `src/core/types.ts`: items keyed `char:type` holding box, seen, correct, wrong and lastSeen; plus unlockedLevel, stats and schema version.
- `srs.ts`: Leitner updates and weights.
- `run.ts`: weighted selection with no repeats, at most 4 new items in progression order, and 3 warm-ups chosen from the highest boxes.
- `src/storage`: load, save and migrate under `kanji-runner:v1`, resetting on corrupt data.
- Reading gates unlock once the meaning box is at least 3.
- The game saves after every run.

**Acceptance criteria:**
- [ ] Tests cover: correct moves the box up by 1 (max 5), wrong sets it to 0, and weight is `2^(5−box)`, so box 0 is 32× box 5.
- [ ] Never more than 4 new items per run. Warm-ups are the strongest known items (kana when no kanji is unlocked).
- [ ] Progress survives a reload. A corrupt localStorage value resets to defaults without throwing.

**Verification:** `npm test -- srs storage run`. Manual: play, reload, see the progress persisted.
**Dependencies:** T6
**Files:** `src/core/{types,srs,run}.ts`, `src/storage/storage.ts`, `tests/core/srs.test.ts`, `tests/storage/storage.test.ts`
**Scope:** M

### Task 8: Levels, unlock rule and placement
**Description:**
- `progression.ts`: level 0 is hiragana, level 1 katakana, levels 2+ are kanji in 30s. The next level unlocks when at least 80% of the current level's items are at box 2 or higher for their primary type.
- Placement on the start screen ("I already know up to level N") sets those items to box 2 or higher.
- The start screen shows the current level and its progress.

**Acceptance criteria:**
- [ ] Unlock happens at exactly 80% (tested at the boundary).
- [ ] Placement to level N unlocks N+1 and never lowers an existing box.
- [ ] The start screen shows the level, progress and the placement control, and it works with keyboard and touch.

**Verification:** `npm test -- progression`. Manual placement flow.
**Dependencies:** T7
**Files:** `src/core/progression.ts`, `src/game/scenes.ts`, `tests/core/progression.test.ts`
**Scope:** S–M

### Checkpoint B
- [ ] Tests, lint and build pass
- [ ] Owner: missed characters come back noticeably more often, and progress survives a reload
- [ ] Owner: placement skips kana, and kanji runs feel right

## Phase 3: Boss and polish

### Task 9: Boss sizing, clash and balance simulation
**Description:**
- `boss.ts`: expected army is the median of N simulated 80%-accuracy passes over the run's actual gates. Boss size is `round(K × expected)`.
- The clash ticks both sides down until one reaches 0. A tie is a loss.
- Render the boss scene with an animated clash.
- Add the balance simulation test.

**Acceptance criteria:**
- [ ] Over 1,000 seeded runs: 100% accuracy always wins, 50% wins less than 10% of the time, 80% wins 40–70% of the time.
- [ ] A tie is a loss. The review boxes update regardless of the boss outcome.
- [ ] The boss scene plays after row 20 and leads to the summary.

**Verification:** `npm test -- boss`. Manual run to the boss.
**Dependencies:** T7
**Files:** `src/core/{boss,tuning}.ts`, `src/game/{scenes,render}.ts`, `tests/core/boss.test.ts`
**Scope:** M

### Task 10: Summary screen, streak feedback and attribution
**Description:**
- The summary lists every missed item with its correct answer (both readings for reading gates), plus army, accuracy, boss result and seed.
- An in-run streak indicator and gain/loss pop-ups (+10, ×2, −30%).
- EDRDG CC BY-SA 4.0 attribution in an about line and in the README.

**Acceptance criteria:**
- [ ] Every missed gate in the run appears on the summary with its correct answer (tested via the run result data).
- [ ] The streak tier and gain are visible during play.
- [ ] Attribution is present in the app and the README.

**Verification:** Tests, plus a manual run with deliberate misses.
**Dependencies:** T9
**Files:** `src/core/run.ts`, `src/game/{scenes,render}.ts`, `README.md`
**Scope:** S–M

### Checkpoint C
- [ ] Spec success criteria 1–9 met
- [ ] Owner playtest on the deployed site

## Phase 4: Sync

### Task 11: Progress merge (pure)
**Description:** `merge.ts` follows the spec rules. Per item, the later `lastSeen` wins. `unlockedLevel` takes the max, and stats take the max of each counter.

**Acceptance criteria:**
- [ ] Property tests: the merge is commutative, idempotent and associative, and no item from either side is lost.
- [ ] Merging with an empty or default progress returns the other side unchanged.

**Verification:** `npm test -- merge`
**Dependencies:** T7 (the `Progress` type). Parallel-safe with T8–T10.
**Files:** `src/core/merge.ts`, `tests/core/merge.test.ts`
**Scope:** S

### Task 12: Supabase schema and sync module
**Description:**
- `supabase/schema.sql`: the table plus RLS select, insert and update policies on `user_id = auth.uid()`.
- `src/sync/sync.ts`: create the client only when both env vars are set. `pull()` fetches, merges and saves locally. `push()` merges and upserts.
- It exposes a status of `synced`, `offline` or `login`, and never throws to callers.
- Add `@supabase/supabase-js` v2 (pre-approved in the spec).

**Acceptance criteria:**
- [ ] Mocked tests: offline, network error (paused project), expired session and no remote row all resolve with the correct status and no exception.
- [ ] With env vars missing, sync is a no-op and reports itself disabled.

**Verification:** `npm test -- sync`
**Dependencies:** T11
**Files:** `supabase/schema.sql`, `src/sync/sync.ts`, `tests/sync/sync.test.ts`, `package.json`
**Scope:** M

### Task 13: Login form and sync wiring
**Description:**
- A minimal email/password form opened from the start screen, with a "play offline" option.
- Pull on load and push after each run.
- A sync status label on the start screen.
- The Supabase vars are passed to the deploy workflow from repo Actions variables.

**Acceptance criteria:**
- [ ] Logging in once per device persists the session across reloads.
- [ ] A run on the laptop appears on the phone after reload, and the reverse.
- [ ] With the network off, play is unaffected, the status shows `offline`, and the next online sync catches up.

**Verification:** Manual cross-device test. Manual RLS check with curl, with no session and with the anon key only (spec criterion 12).
**Dependencies:** T12, T4. **Owner must complete the Supabase setup first** (spec, "One-time manual setup", steps 2–4).
**Files:** `src/sync/login.ts`, `src/game/scenes.ts`, `src/main.ts`, `.github/workflows/deploy.yml`
**Scope:** M

### Checkpoint D
- [ ] Spec success criteria 10–12 met
- [ ] All tasks checked. v1 done.
