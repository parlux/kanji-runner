# Spec: Kanji Runner

Source of intent: `docs/intent/kanji-runner.md` (confirmed 2026-11-07).
Gameplay rework: `docs/ideas/crowd-runner-rework.md` (Direction C, confirmed 2026-11-07).
Status: APPROVED revision 2, 2026-11-07. Revision 2 replaces lane picking with a physical track (see Track, crowd and steering).

### Changes from intent
| Date | Change | Reason |
|---|---|---|
| 2026-11-07 | Repo is public; hosted on GitHub Pages | Free hosting for phone play. |
| 2026-11-07 | Optional Supabase (free tier) sync with a single email/password login. Reverses the intent's "no accounts, no backend". | Share progress between laptop and phone. localStorage stays the primary store, so the game works offline and while the Supabase project is paused. |
| 2026-11-07 | Continuous steering, crowd width, hazards between questions, and squad-charge questions. Replaces discrete lanes with full-width gates. Run is 14 questions instead of 20. | First playtest: lane picking felt like "time-pressured flash cards", not a crowd runner. The game needs to be fun even when the answers are known. |

## Objective

A browser "crowd runner". The player steers an army down a track full of hazards. At **question beats**, a **prompt character** (kana or kanji) appears with 2–3 answers. Most questions are **wall gates**: openings in a wall, one per answer. Some are **squad charges**: enemy squads, one per answer. Choosing the correct answer grows the army. A wrong answer shrinks it and breaks the streak. Between questions, the army must dodge hazards, and a bigger army is wider and harder to steer. The run ends in a boss clash decided by army size.

**User:** the project owner only. They are a returning Japanese learner: kana is rusty, and most kanji are forgotten after earlier WaniKani study. Typical play: on a phone, several runs back to back (5–15 min).

**Why:** the moment-to-moment fun is steering a crowd through danger, and the snowball. Making the key decisions Japanese recall means play time isn't wasted.

**Success feel:** "one more run", and still fun when the answers are known.

### User stories
- As the player, I start a run with one keypress or tap. Each run is different.
- As the player, I steer smoothly by holding ←/→ on a laptop, or by dragging anywhere on a phone.
- As the player, I dodge hazards between questions. Soldiers that touch a hazard are lost.
- As the player, I see a prompt (e.g. `水`) and must steer through the opening labelled with the correct answer (`water` / `fire` / `tree`).
- As the player, sometimes the answers stand above enemy squads. I charge one, and once I'm committed I can't change my mind.
- As the player, a correct streak escalates my reward and a wrong pick costs me, so accuracy matters.
- As the player, characters I get wrong come back more often in later runs.
- As the player, I start with kana, then move into kanji in a fixed progression. New kanji unlock as I master earlier ones.
- As the player, after the run I see a summary that lists the characters I missed, with their correct answers.
- As the player, I log in once per device and my progress follows me between laptop and phone. If I skip the login, the game still works local-only.

## Core Rules

### Gate types (what is asked)
| Type | Prompt → answers | Unlocks when | Base reward |
|---|---|---|---|
| `kana` | かな/カナ → romaji | from the start | +3 |
| `meaning` | kanji → English meaning (primary gloss) | its level is unlocked | +5 |
| `reading` | kanji → kana reading | that kanji's `meaning` box ≥ 3 | +8 |

- **Reading gates:** there is no on/kun label. The correct gate shows one of the kanji's main readings, rotating between runs. Wrong options never include any reading of that kanji.
  - Main readings are the first on'yomi and the first kun'yomi in KANJIDIC2's order.
  - Kun'yomi show only the kanji's part, with the trailing kana greyed in brackets: `あ.げる` → あ(げる). Prefix and suffix dashes are stripped.
  - All readings are written in hiragana.
  - Wrong options are picked within ±1 kana of the correct reading's length.
  - There is one review record per kanji for readings (`水:reading`), whichever reading was shown.
- Questions 1–7 of a run have **2 answers**. Questions 8+ have **3**.
- Every question must be answered: the army always ends up choosing exactly one answer.

### Question shapes (how it is asked)
| Shape | Where | How the answer is chosen |
|---|---|---|
| **Wall gate** | most questions | A wall spans the track with one opening per answer. The chosen answer is the opening nearest the crowd's centre when the crowd reaches the wall. |
| **Squad charge** | questions 4, 8 and 12 | One enemy squad per answer, each under its answer banner. Crossing the **charge line** locks steering. The chosen answer is the squad nearest the crowd's centre at the moment of the lock. |

- Both shapes shuffle answer positions every question.
- Shape is independent of gate type: a squad charge can ask `kana`, `meaning` or `reading`.

**Squad honesty rules** (the answer must never leak):
- All squads in a charge look identical until contact: same count shown, same formation, same animation. The renderer gets no correctness data for squads until the charge resolves.
- Steering is locked from the charge line until contact, so there is no touch-and-retry.

### Streak and payoff
- Streak = consecutive correct answers in this run, across both shapes.
- Reward for a correct answer, applied to the army count:
  - streak 1–2: `+base`
  - streak 3–4: `+base × 2`
  - streak 5–7: `×2` (doubling)
  - streak 8+: `×3`
- A **×N result is capped at +150 soldiers per question**, which keeps late-run numbers readable and the boss tunable.
- **Correct squad charge:** the streak reward, plus `SQUAD_DEFECT_GAIN` (10) defecting soldiers.
- **Wrong wall gate:** army loses `max(5, 30%)` (rounded up) and the streak resets to 0.
- **Wrong squad charge:** army loses `max(8, 50%)` (rounded up) and the streak resets to 0.
- If the army reaches 0 at any point, the run ends as a loss.
- Starting army: 5.

### Track, crowd and steering
All distances are in track units. The track is 1.0 wide; `x` runs from 0 (left edge) to 1 (right edge).

- **Crowd:** a blob with a centre `x` and a width `w = clamp(CROWD_MIN_W, CROWD_K × √army, CROWD_MAX_W)`, starting at 0.06 / 0.03 / 0.30. Up to 200 dots are drawn inside it. The crowd is always kept fully on the track.
- **Steering:** input sets a target `x`. The crowd moves towards it at most `STEER_MAX_SPEED` (start: 1.2 track widths per second), with light easing so it feels weighty, not snappy.
  - Laptop: holding ← or → moves the target at `STEER_MAX_SPEED`.
  - Phone: relative drag. The target moves by the horizontal finger movement × `DRAG_GAIN` (start: 1.5 × screen width → track width). Touching doesn't jump the crowd to the finger.
- **Losses from overlap (clipping):** when the crowd passes a hazard or a wall, the fraction of the crowd's width that overlaps the solid part is lost: `loss = ceil(army × overlap / w)`. Clipping losses:
  - never change the streak or the SRS (only answers do);
  - at a wall gate, are applied first, then the answer is scored on the remaining army.
- **Wall gates:** openings are `GATE_OPENING_2` (0.36) wide for 2 answers and `GATE_OPENING_3` (0.26) wide for 3, spread evenly with solid wall between and at the edges. The largest crowd (0.30) fits a 2-answer opening but clips a 3-answer one. This is deliberate: a big army is harder to manage.
- **Hazards** (between questions only):
  - **Block:** a static solid, 0.15–0.35 wide.
  - **Saw:** 0.10 wide, sweeping side to side at a set speed and range.
- **Beat layout** (generated by `track.ts` from the seed):
  - 14 question beats. Between consecutive questions there are 1–2 hazard beats (seeded).
  - Before each question there is a **calm stretch** of `CALM_DISTANCE` with no hazards, starting when the prompt appears. This leaves time to read the prompt and recall the answer.
  - Hazard layouts must always leave a gap wide enough for the current maximum crowd width (0.30), so a skilled player never takes forced losses.
- **Speed:** ramps linearly from 1.0× to **1.3×** over the run. Spacing is tuned so that a run (14 questions plus boss) takes about 2–3 minutes.

### Run shape
- 14 question beats with hazards between them, then the boss.
- Each run uses a seeded PRNG for question content and the track layout. The seed is shown on the summary screen, and the same seed with the same SRS state reproduces the same run.

### Item selection per run (SRS-driven)
- Pick the 14 prompts by weighted random choice, without repeats, from the unlocked pool.
- Weight = `2^(5 − box)`. Box 0 has weight 32 and box 5 has weight 1.
- Introduce at most **4 new items** (never seen before) per run, taken in progression order.
- The first 3 questions of every run are **warm-ups**, chosen from the strongest known items (highest box). The exception is before any kanji is unlocked: then the warm-ups are kana. Warm-ups are always wall gates.

### SRS model: Leitner boxes 0–5
- Track each item separately per gate type (`水:meaning` and `水:reading` are independent).
- Correct → box +1 (max 5). Wrong → box 0. Both question shapes count the same.
- Record `seen`, `correct`, `wrong`, and `lastSeen` for stats.

### Distractors
- Distractors come from the same gate type, drawn from unlocked items plus the next level.
- Never use a distractor that is also a correct answer for the prompt. For readings, exclude every reading of that kanji. For meanings, exclude any overlapping gloss.
- Prefer confusable items when they exist:
  - kana: a hand-curated look-alike list (シ/ツ, ソ/ン, ぬ/め, わ/れ/ね, …).
  - kanji: other kanji that share a component per KRADFILE (e.g. 体/休).
- Each question shuffles answer positions.

### Progression and levels
- Level 0 is hiragana (46 basic + dakuten). Level 1 is katakana.
- Kanji levels 2+ hold **30 kanji each**, in progression order.
- The next level unlocks when **≥ 80% of the current level's items have box ≥ 2** for their primary gate type (`kana` or `meaning`).
- A **"I already know these" placement** on the start screen marks every item in a chosen level and the levels before it as box 2. This lets the returning user skip kana quickly.

### Ordering source (WaniKani-like proxy)
- Use the Jōyō kanji only, ordered by **KANJIDIC2 school grade, then newspaper frequency**.
- A post-pass moves a kanji's KRADFILE components earlier when they are themselves Jōyō kanji, so simple building blocks come before compounds. This approximates WaniKani's radical-first ordering without using WaniKani data.
- If the early levels feel wrong in play, an optional `scripts/order-overrides.json` lets the data script move specific kanji. It starts empty.

### Progress sync (Supabase)
- **Local first:** `localStorage` is always read and written. Sync is an optional layer on top.
- **Auth:** Supabase Auth with email and password. A minimal login form opens from the start screen; it has a "play offline" option. The session persists, so login happens once per device. Sign-ups are disabled in the dashboard (single user).
- **Table:** `progress(user_id uuid primary key references auth.users, data jsonb not null, updated_at timestamptz not null default now())`. RLS policy: `user_id = auth.uid()` for select, insert and update.
- **When to sync:** on app load (pull, merge, save locally) and after each run (merge, push).
- **Merge (pure function in `src/core/merge.ts`):** per item key, keep the record with the later `lastSeen`. `unlockedLevel` takes the max, and global run stats take the max of each counter. The merge is commutative and idempotent.
- **Failure handling:** a network error, a paused project, or an expired session never blocks play. The start screen shows a small sync status (`synced` / `offline` / `login`), and the next successful sync catches up.
- **Config:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public by design; RLS protects the data). If either is missing, the sync UI is hidden.

### Boss clash
- Boss size = `round(K × expected army)`. The expected army is what the army would be if the player answered at 80% accuracy, simulated from the run's actual question sequence (including squad shapes), times `EXPECTED_SURVIVAL` (start: 0.85) to account for clipping losses. `K` is a tuning constant, starting at 1.0.
- In the clash, both sides lose one unit per tick, animated, until one side reaches 0. Equal sizes count as a loss.
- Win or lose, the SRS updates from the questions. The boss outcome only affects the summary screen and the win/loss stats.

## Tech Stack
- **TypeScript 5 (strict)** and **Vite 6**. No game engine.
- **Canvas 2D** rendering: a simple top-down track, with the army drawn as a blob of up to 200 dots plus a count label (the label always shows the true count). Hazards, walls and squads are flat shapes.
- Japanese glyphs use system fonts (Hiragino on macOS/iOS, Noto Sans JP on Android). No webfont download.
- **Vitest** for unit tests.
- Dev-only data build: Node 22 script (`tsx`) that downloads KANJIDIC2 and KRADFILE (EDRDG, CC BY-SA 4.0) and emits compact JSON into `src/data/`. The generated JSON is committed, so the app needs no network at runtime.
- Storage: `localStorage`, key `kanji-runner:v1`, with a versioned schema and a migration hook.
- Sync: `@supabase/supabase-js` v2 (the only runtime dependency), on the Supabase free tier.
- Hosting: GitHub Pages, deployed by a GitHub Actions workflow on push to `main`. Vite `base` is `/kanji-runner/`. The Supabase URL and anon key come from repo Actions variables.

## Commands
```
Install:     npm install
Dev:         npm run dev           # vite, http://localhost:5173 (use --host for phone on LAN)
Build:       npm run build         # tsc --noEmit && vite build → dist/
Preview:     npm run preview
Test:        npm test              # vitest run
Test watch:  npm run test:watch
Lint:        npm run lint          # eslint . && prettier --check .
Format:      npm run format        # prettier --write .
Data:        npm run data:build    # regenerate src/data/*.json from EDRDG sources
Deploy:      git push origin main  # Actions builds and publishes to GitHub Pages
```

Local config: copy `.env.example` to `.env.local` (gitignored) and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### One-time manual setup (owner)
1. Make the GitHub repo public, then enable Pages with source "GitHub Actions".
2. Create a Supabase project (free tier). Run `supabase/schema.sql` in the SQL editor.
3. Create your user under Auth → Users, then disable new sign-ups.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repo Actions variables and to `.env.local`.
5. If the game shows `offline` after a break of a week or more, restore the paused project in the Supabase dashboard.

## Project Structure
```
SPEC.md                 → this file
docs/intent/            → intent docs (input to specs)
docs/ideas/             → idea one-pagers (input to spec revisions)
tasks/                  → plan.md, todo.md
src/main.ts             → bootstraps canvas, input, scenes
src/core/               → PURE game logic, no DOM. Fully unit-tested.
  rng.ts                → seeded PRNG
  scoring.ts            → streak/payoff, wrong penalties (gate and squad)
  run.ts                → builds a run's questions from seed + SRS state
  track.ts              → beat layout: question shapes, hazards, calm stretches
  crowd.ts              → crowd width, steering motion, overlap losses
  sim.ts                → steps the run: movement, clipping, question resolution, charge lock
  srs.ts                → Leitner updates, selection weights
  progression.ts        → levels, unlock rule, placement
  distractors.ts        → answer generation
  boss.ts               → boss sizing + clash resolution
  merge.ts              → progress merge (local ⇄ remote)
src/game/               → DOM/canvas layer: loop, render, input (keys/drag), scenes
src/storage/            → localStorage load/save/migrate
src/sync/               → Supabase client, login form, pull/push
supabase/schema.sql     → table + RLS policies
.github/workflows/      → Pages deploy
src/data/               → kana.json, generated kanji.json, confusables.json
scripts/build-data.ts   → data pipeline (dev only)
tests/                  → Vitest specs mirroring src/core and src/storage
```

## Code Style
- Strict TS, ES modules, named exports, no default exports.
- `src/core` holds pure functions over plain data, with no classes and no globals. Randomness is passed in as an `Rng`, so tests are deterministic.
- `camelCase` for functions and variables, `PascalCase` for types, `SCREAMING_SNAKE` for tuning constants. Tuning constants live in `src/core/tuning.ts`.
- Prettier defaults with 2-space indent and no semicolon debates (Prettier decides).
- The renderer reads a **view model** from `src/core`, not raw run state, so it can't see squad correctness before resolution.

```ts
// src/core/crowd.ts
import { CROWD_K, CROWD_MAX_W, CROWD_MIN_W } from "./tuning";

export function crowdWidth(army: number): number {
  return Math.min(CROWD_MAX_W, Math.max(CROWD_MIN_W, CROWD_K * Math.sqrt(army)));
}

/** Soldiers lost when a crowd [x - w/2, x + w/2] passes solids. */
export function clipLoss(army: number, x: number, w: number, solids: Span[]): number {
  const overlap = solids.reduce((sum, s) => sum + spanOverlap(x - w / 2, x + w / 2, s), 0);
  return overlap > 0 ? Math.ceil((army * overlap) / w) : 0;
}
```

## Testing Strategy
- **Unit tests (Vitest)** cover everything in `src/core` and `src/storage`: scoring curve and both wrong penalties, crowd width, clip loss, steering speed limit, charge-line lock, wall-gate and squad resolution, SRS box transitions and weights, new-item cap, unlock rule, placement, distractor validity (no correct answer among distractors, no duplicates), run and track determinism per seed, and storage migration and corrupt-data recovery.
- **Track property tests:** over 1,000 seeds, every hazard beat leaves a gap ≥ `CROWD_MAX_W`; no hazard falls inside a calm stretch; squads only appear at questions 4, 8 and 12.
- **Honesty tests:** the squad view model is identical for every squad in a charge (no correctness, size or position tell). Clipping never changes streak or SRS.
- **Balance simulation test:** a scripted bot with accuracy `p` and a "steering" factor `s` (the fraction of avoidable clipping it avoids) plays 1,000 seeded runs. With `s = 1`: 100% accuracy always beats the boss, 50% accuracy wins less than 10% of the time, and 80% accuracy wins 40–70% of the time. With `p = 1, s = 0.5`: wins at least 50% of the time.
- **Merge tests:** the merge is commutative, idempotent, and never loses an item present on either side. The later `lastSeen` wins.
- **Sync tests:** `src/sync` runs against a mocked Supabase client. They cover offline, paused (network error), expired session, and first sync with no remote row.
- **Data test:** generated JSON passes a schema check. Every kanji has at least one meaning and at least one reading. Every level has 30 items, except the last.
- **Manual / browser checks:** a playthrough on a laptop (keys) and in a narrow mobile viewport (drag) using the `browser-test` skill, with screenshots of the start screen, a hazard, a wall gate, a squad charge, the boss, and the summary.
- TDD for `src/core`. Rendering code is not unit-tested.

## Boundaries
- **Always:** keep `src/core` DOM-free; run `npm test` and `npm run lint` before each commit; put tuning numbers in `tuning.ts`; credit EDRDG (CC BY-SA 4.0) in the README and on the in-app about line.
- **Ask first:** adding any runtime dependency beyond supabase-js; changing the storage schema version or the Supabase table/RLS; changing the scoring curve, squad penalty or SRS model beyond tuning constants; adding new hazard or question shapes.
- **Never:** use WaniKani content or its API; commit `.env.local`, the Supabase service-role key, or passwords; disable RLS; let sync failures block play; add analytics; copy any existing game's name, art, or levels; commit downloaded raw EDRDG files (only the generated JSON); let clipping or hazards affect SRS; leak squad correctness to the renderer before resolution.

## Success Criteria
1. `npm run build` produces a static `dist/` that runs offline in Chrome/Safari on a laptop and a phone.
2. A full run (14 questions, hazards, 3 squad charges, boss) is playable with ←/→ only, and with drag only, at 60 fps on the laptop.
3. Steering is continuous: the crowd moves smoothly at a capped speed, and there is no lane snapping.
4. Two consecutive runs with different seeds have different questions and track layouts. The same seed and the same state reproduce the same run.
5. A skilled player can always avoid every hazard (track property test), and a bigger army is measurably harder to keep whole (3-answer walls clip a max-size crowd).
6. Squad charges can't be read before commit, and can't be retried after the charge line (honesty tests).
7. After answering an item wrong, its box is 0 and its selection weight is 32× that of a box-5 item. Tests verify this.
8. Progress (boxes, unlocked level, stats) survives a page reload. Corrupt storage resets without crashing.
9. Kana levels unlock kanji level 2 under the 80% rule, or immediately via placement.
10. The balance simulation meets its thresholds (see Testing Strategy).
11. No distractor is ever a valid answer for its prompt. This is property-tested over all items.
12. The summary lists every missed item with its correct answer.
13. The game is live on GitHub Pages and playable on a phone.
14. Progress from a run on the laptop shows up on the phone after login, and the reverse. With the network off, play still works and syncs later.
15. A request with another user's session (or none) cannot read or write the progress row. This is checked manually against RLS.
16. **Feel checkpoint (owner):** after the steering + hazards slice, the owner confirms on the phone that it feels like a crowd runner, and that prompts are readable while steering.

## Out of Scope (v1)
Maths gates, English→kanji gates, sound/TTS, multi-user, sign-up flow, password reset UI, realtime sync, vocabulary (multi-kanji words), multiplayer, leaderboards, any backend beyond the Supabase progress table, 3D art, native app.
Also deferred from the rework (see `docs/ideas/crowd-runner-rework.md`): splitting the crowd across gates; stage chains / long-session structure; more hazard types or enemy variety; tap-left/right touch controls; the boss as a big squad charge; art, sound and juice beyond simple feedback.
Future enhancement idea (owner, 2026-11-07, after R2): shooting or another mechanism that lets the player widen gaps. Clipping works, but big crowds feel forced to lose units with no way to prevent it. To refine or discuss later.

## Open Questions
1. ~~Hosting~~: resolved, public repo on GitHub Pages.
2. ~~Export/import~~: resolved, replaced by Supabase sync.
3. ~~Scoring curve~~: resolved. Keep `−max(5, 30%)` for gates. Squads use `−max(8, 50%)`.
4. ~~Ordering~~: resolved. Use grade + frequency + the component pass, with an override file kept in reserve. No WaniKani-derived data.
5. ~~Reading gates~~: resolved. Accept any main reading, with no label (see Gate types). A labelled on/kun gate type may come later.
6. ~~Rework open questions~~: resolved in `docs/ideas/crowd-runner-rework.md` (blob crowd, 1.3× speed, 14 questions, unchanged boss).

None remaining. All new numbers are starting values in `tuning.ts`, to be tuned at the feel checkpoint.
