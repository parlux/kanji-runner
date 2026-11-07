# Tasks: Kanji Runner

Plan: `tasks/plan.md`. Spec: `SPEC.md` (revision 4).
Every task: `npm test && npm run lint && npm run build` pass before it is checked off.

## Phase 1: Playable slice (done)

- [x] **Task 1: Scaffold project.** Vite + strict TS + Vitest + ESLint/Prettier, full-screen canvas, `base: /kanji-runner/`.
- [x] **Task 2: Core rules for a kana run.** `rng`, `tuning`, `scoring`, `kana.json`, seeded `run.ts`.
- [x] **Task 3: Playable kana run on laptop.** Fixed-step loop, canvas renderer, lanes, scenes. Owner playtested it: lane picking felt like timed flash cards, which led to spec revision 2. Its lane model is replaced by R1.
- ~~Task 4: Touch controls and GitHub Pages deploy~~. Superseded by R4 (drag replaces tap/swipe; the deploy part moves there unchanged).

## Phase 1b: Crowd runner rework

### Task R1: Continuous steering through wall gates
**Description:** Replace the lane index with a continuous crowd position.
- `RunState` gets `x` (crowd centre) and `targetX` in place of `lane`. `steer` becomes `setTarget` / `nudgeTarget`.
- `stepRun` moves `x` towards `targetX` at most `STEER_MAX_SPEED`, with light easing, and clamps it to the track.
- Gate rows become walls: the opening layout comes from `GATE_OPENING_2` / `GATE_OPENING_3`. The answer is the opening nearest `x` when the crowd reaches the wall. There is no clipping yet; the crowd is a point.
- Input: holding ←/→ moves the target continuously (keydown/keyup state, not single presses).
- Render: the crowd at `x`, and walls with labelled openings instead of lane bands.

**Acceptance criteria:**
- [x] The crowd never moves faster than `STEER_MAX_SPEED`, and never leaves [0, 1] (tested).
- [x] The chosen answer is the opening nearest the crowd centre, including when the centre is on solid wall (tested).
- [x] Holding ← or → glides the crowd smoothly in the browser, with no lane snapping.

**Verification:** `npm test -- sim`. Manual laptop run.
**Dependencies:** T3
**Files:** `src/core/{sim,tuning}.ts`, `src/game/{input,render}.ts`, `tests/core/sim.test.ts`
**Scope:** M

### Task R2: Crowd width and wall clipping
**Description:**
- `crowd.ts`: `crowdWidth(army)` and `clipLoss(army, x, w, solids)` per the spec.
- At a wall, clip losses are applied first, then the answer is scored on the remaining army. Clipping never changes the streak or results.
- Render the crowd as a blob of up to 200 dots spread over its width, plus a loss pop-up when soldiers are clipped.

**Acceptance criteria:**
- [x] Width follows `clamp(0.06, 0.03·√army, 0.30)`. Clip loss is `ceil(army × overlap / w)`, and 0 with no overlap (tested at the edges).
- [x] A max-width crowd fits a 2-answer opening without loss and clips a centred 3-answer opening (tested).
- [x] Clipping leaves the streak and the per-question results untouched (tested).

**Verification:** `npm test -- crowd sim`. Manual: grow the army and watch it get harder to thread.
**Dependencies:** R1
**Files:** `src/core/{crowd,sim,tuning}.ts`, `src/game/render.ts`, `tests/core/crowd.test.ts`
**Scope:** M

### Task R3: Track layout and hazards
**Description:**
- `track.ts` builds the beat layout from the seed: 14 questions (2 answers for 1–7, 3 after), 1–2 hazard beats between questions, and a calm stretch of `CALM_DISTANCE` before each question.
- Hazards: block (static, 0.15–0.35 wide) and saw (0.10 wide, sweeping). Every hazard beat leaves a gap ≥ `CROWD_MAX_W` at all times.
- `sim.ts` applies hazard clipping as the crowd passes each hazard. The army reaching 0 ends the run.
- Tuning: `ROWS_PER_RUN = 14`, `TWO_OPTION_ROWS = 7`, `MAX_SPEED_MUL = 1.3`. Spacing is set so a run takes about 2–3 minutes.
- Render blocks and moving saws.

**Acceptance criteria:**
- [x] Property test over 1,000 seeds: every hazard beat leaves a passable gap ≥ `CROWD_MAX_W` (for saws, at every point of their sweep), and no hazard falls inside a calm stretch.
- [x] Same seed → identical track; different seeds → different tracks.
- [x] A full run plays start to finish with hazards between the questions (owner, on the phone).

**Verification:** `npm test -- track sim`. Manual laptop run.
**Dependencies:** R2
**Files:** `src/core/{track,sim,run,tuning}.ts`, `src/game/render.ts`, `tests/core/track.test.ts`
**Scope:** M–L (the largest rework task; split saws into their own task if it runs long)

### Task R4: Drag steering and GitHub Pages deploy
**Description:**
- Relative drag: pointer movement × `DRAG_GAIN` moves the target. Touching doesn't jump the crowd.
- A portrait phone layout with `touch-action: none` and no zoom or scroll. Tap to start and pause.
- A GitHub Actions workflow that builds and deploys to Pages on push to `main` (carried over from the old T4).

**Acceptance criteria:**
- [x] A full run is playable with drag only (owner, on the phone).
- [x] Touching down without moving doesn't move the crowd.
- [x] Push to `main` deploys, and the site loads at `https://parlux.github.io/kanji-runner/`.

**Verification:** Mobile viewport emulation. The Actions run is green. Open the site on the phone.
**Dependencies:** R3. **Owner must make the repo public and enable Pages (source: GitHub Actions) first.**
**Files:** `src/game/input.ts`, `src/main.ts`, `index.html`, `.github/workflows/deploy.yml`
**Scope:** S–M

### Task S1: Auto-fire and breakable blocks
**Description:** (spec: Shooting)
- `fire.ts`: `firepower(army)`, `expectedArmy(rows)` (deterministic 80% pass: every 5th answer wrong, no clipping), and `pickTarget(...)` (nearest shootable threat ahead within `FIRE_RANGE` whose span overlaps the crowd).
- `track.ts`/`sim.ts`: blocks get hit points `BLOCK_HP_K × expectedArmy(q)`. Each step, `sim.ts` applies `firepower × dt` to the target. A block at 0 is shattered and no longer clips.
- Tuning: `FIRE_PER_SOLDIER`, `FIRE_RANGE`, `BLOCK_HP_K`.
- Render: a stream of bullets from the crowd to its target, a hit flash, a shatter burst, and a block that shows its damage. Nothing drawn over the prompt or the labels.

**Acceptance criteria:**
- [x] Damage per second is `FIRE_PER_SOLDIER × army`, and goes only to the nearest overlapping block in range (tested).
- [x] A block shatters exactly when its damage reaches its hit points, and a shattered block never clips; an intact one clips as before (tested).
- [x] Walls and saws take no damage, and shooting never changes streak or results (tested).
- [x] `expectedArmy` is deterministic per run and never decreases after a correct answer (tested).
- [x] In the browser, a strong army visibly shreds blocks, and a 5-soldier army barely dents them.

**Verification:** `npm test -- fire sim track`. Phone-sized browser check.
**Dependencies:** R4
**Files:** `src/core/{fire,track,sim,tuning}.ts`, `src/game/render.ts`, `tests/core/fire.test.ts`
**Scope:** M

### Task S2: Enemy packs
**Description:** (spec: Shooting)
- `track.ts`: some hazard beats become enemy packs (none before question 2), with strength `max(3, ENEMY_K × expectedArmy(q))`. Block and saw gap rules are unchanged.
- `sim.ts`: packs approach at `ENEMY_SPEED` on top of the scroll and drift towards the crowd at `ENEMY_STEER_SPEED`. They are shootable targets: each `ENEMY_HP` of damage kills one enemy, and the pack narrows (`crowdWidth`). On contact, overlapping spans cost `ENEMY_DAMAGE` per survivor; a miss costs nothing.
- Tuning: `ENEMY_K`, `ENEMY_SPEED`, `ENEMY_STEER_SPEED`, `ENEMY_HP`, `ENEMY_DAMAGE`.
- Render: the pack as a blob of enemy dots with its count, kills popping off, and the contact loss pop-up.

**Acceptance criteria:**
- [x] Contact costs one soldier per surviving enemy only when spans overlap; a pack shot to 0 costs nothing (tested).
- [x] Packs never appear in calm stretches or before question 2, and the track stays deterministic per seed (property test over 1,000 seeds).
- [x] Enemy losses never change streak or results, and an army reaching 0 ends the run (tested).
- [x] Bot check: with perfect steering, 100% accuracy never dies before the last question, and 50% accuracy dies before it in at least half of 200 seeded runs.

**Verification:** `npm test -- fire sim track`. Phone-sized browser check, then push and the owner plays on the phone.
**Dependencies:** S1
**Files:** `src/core/{track,sim,fire,tuning}.ts`, `src/game/render.ts`, `tests/core/{fire,track,sim}.test.ts`
**Scope:** M

### Task S3: Always-on fire and supply crates
**Description:** (spec: Shooting; idea: `docs/ideas/crates.md`). From Checkpoint A feedback.
- `sim.ts`: when a block shatters, add `round(CRATE_REWARD_K × its hit points)` to the army, once. Record it for feedback (`lastCrate`).
- Tuning: `CRATE_REWARD_K` (start 0.3).
- Render: a constant bullet stream straight ahead that fades out at `FIRE_RANGE`, with or without a target; a "+N" pop-up and recruits joining when a crate pays out; blocks drawn as crates.
- Balance bot: shoots a crate when it can break it in time, otherwise dodges.

**Acceptance criteria:**
- [x] A shattered crate adds `round(CRATE_REWARD_K × hp)` exactly once; an unbroken one adds nothing and clips as before (tested).
- [x] Crate rewards never change streak or results (tested).
- [x] Bot check still holds: 100% accuracy never dies early, 50% dies early in at least half of 200 runs.
- [x] In the browser, fire is always visible and ends at the range line, below the prompts.

**Verification:** `npm test -- fire sim balance`. Phone-sized browser check, then push and the owner plays on the phone.
**Dependencies:** S2
**Files:** `src/core/{sim,tuning}.ts`, `src/game/render.ts`, `tests/core/{sim,balance}.test.ts`
**Scope:** S–M

### Checkpoint A: feel test (spec criterion 16)
- [x] Tests, lint and build pass
- [x] Owner plays on the phone: it feels like a crowd runner, not flash cards ("feeling pretty good", 2026-11-07)
- [x] Owner: right answers feel like power
- [x] Owner: a weak run gets overrun
- [x] Owner: prompts are readable while steering and firing
- [x] Owner: still fun when the answers are known (play some all-easy runs). Owner: "yes, I think we can refine to make it more fun" (follow-up below)
- [x] Owner: S3 (always-on fire, crates) plays well on the phone
- [x] Adjust `tuning.ts` from feedback: `BASE_SPEED` 1.3 → 1.6 (scrolling too slow). **If the feel is wrong, stop and revisit the idea doc before R5.**
- [x] Passed, 2026-11-07. Follow-ups: S4 below (fire range too short, leaving stretches with nothing to do; show each crate's reward). Open: refine the all-easy runs to make them more fun.

### Task S4: Longer fire range and crate rewards shown
**Description:** From Checkpoint A feedback.
- Tuning: raise `FIRE_RANGE` (2.0 → 2.8) so there is less time with nothing in reach.
- Render: each crate shows the recruits it pays (`+N`) as well as its hit points.

**Acceptance criteria:**
- [x] Bot check still holds with the longer range: 100% accuracy never dies early, 50% dies early in at least half of 200 runs.
- [x] Every crate shows its hit points and its `+N` reward, readable on the phone.
- [x] Fire still stops at the next wall and never covers a prompt.

**Verification:** `npm test`. Phone-sized browser check, then push and the owner plays on the phone.
**Dependencies:** S3
**Files:** `src/core/tuning.ts`, `src/game/render.ts`
**Scope:** S

### Task R5: Squad charges
**Description:**
- `track.ts` marks questions 4, 8 and 12 as squad charges, with a charge line `CHARGE_LINE_DISTANCE` before the squads. Squads never occur in the 3 warm-ups.
- `sim.ts`: crossing the charge line locks steering and fixes the choice (the squad nearest `x`). At contact the charge resolves:
  - correct: streak reward + `SQUAD_DEFECT_GAIN`;
  - wrong: `applyWrongCharge` = `max(8, ceil(50%))`, streak reset.
- A view model (`viewOf(state)`) exposes squads without any correctness data until resolution. The renderer uses only the view model.
- Render identical squads, the charge line and the locked state. After the lock, the charge plays as a short firefight: the correct squad stops fighting and joins, a wrong one fires back. Squads aren't fire targets before the lock.

**Acceptance criteria:**
- [x] Steering input after the charge line has no effect until contact (tested).
- [x] Before resolution, the view model for every squad in a charge is identical except for its answer label and position (tested over many seeds).
- [x] Scoring: the wrong-charge penalty and the defect gain match the spec at the boundaries (tested).

**Verification:** `npm test -- sim scoring track`. Manual: three charges per run on laptop and phone.
**Dependencies:** S2 (and Checkpoint A passed)
**Files:** `src/core/{track,sim,scoring,tuning}.ts`, `src/game/render.ts`, `tests/core/squad.test.ts`
**Scope:** M

### Checkpoint A2: squads
- [ ] Owner: squad charges are fun, and their answers can't be told apart before contact
- [ ] Owner: runs with squads beat runs without (temporarily toggle them off in `tuning.ts` to compare)

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
**Dependencies:** T5, Checkpoint A2
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
- [ ] Never more than 4 new items per run. Each run picks 14 prompts. Warm-ups are the strongest known items (kana when no kanji is unlocked) and are always wall gates.
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
- `boss.ts`: expected army is the median of N simulated 80%-accuracy passes over the run's actual questions (including squad shapes), × `EXPECTED_SURVIVAL` (0.85). Boss size is `round(K × expected)`.
- The clash ticks both sides down until one reaches 0. A tie is a loss.
- Render the boss scene with an animated clash.
- Balance bot: drives the real `sim.ts` with accuracy `p` and steering skill `s`. With `s = 1` it steers through the gap centres; with lower `s` it adds a seeded aim offset, so it clips some of the time.

**Acceptance criteria:**
- [ ] Over 1,000 seeded runs with `s = 1`: 100% accuracy always wins, 50% wins less than 10% of the time, 80% wins 40–70% of the time.
- [ ] With `p = 1, s = 0.5`, the bot wins at least 50% of the time.
- [ ] A tie is a loss. The review boxes update regardless of the boss outcome. The boss scene plays after question 14 and leads to the summary.

**Verification:** `npm test -- boss balance`. Manual run to the boss.
**Dependencies:** T7, R5
**Files:** `src/core/{boss,tuning}.ts`, `src/game/{scenes,render}.ts`, `tests/core/{boss,balance}.test.ts`
**Scope:** M

### Task 10: Summary screen, streak feedback and attribution
**Description:**
- The summary lists every missed item with its correct answer (both readings for reading gates), plus army, accuracy, boss result and seed.
- An in-run streak indicator and gain/loss pop-ups (+10, ×2, −30%) for answers. Clipping losses are already shown (R2).
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
- [ ] Spec success criteria 1–12 and 16 met
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
**Dependencies:** T12, R4. **Owner must complete the Supabase setup first** (spec, "One-time manual setup", steps 2–4).
**Files:** `src/sync/login.ts`, `src/game/scenes.ts`, `src/main.ts`, `.github/workflows/deploy.yml`
**Scope:** M

### Checkpoint D
- [ ] Spec success criteria 13–15 met
- [ ] All tasks checked. v1 done.
