# Spec: Kanji Runner

Source of intent: `docs/intent/kanji-runner.md` (confirmed 2026-11-07).
Status: APPROVED 2026-11-07.

### Changes from intent
| Date | Change | Reason |
|---|---|---|
| 2026-11-07 | Repo is public; hosted on GitHub Pages | Free hosting for phone play. |
| 2026-11-07 | Optional Supabase (free tier) sync with a single email/password login. Reverses the intent's "no accounts, no backend". | Share progress between laptop and phone. localStorage stays the primary store, so the game works offline and while the Supabase project is paused. |

## Objective

A browser "crowd runner" where the player steers an army down a track through answer gates. Each gate row shows a **prompt character** (kana or kanji) and 2–3 **answer gates**. Running through the correct answer grows the army. A wrong answer shrinks it and breaks the streak. The run ends in a boss clash decided by army size.

**User:** the project owner only. They are a returning Japanese learner: kana is rusty, and most kanji are forgotten after earlier WaniKani study.

**Why:** the snowball feeling, plus picking under time pressure, makes Japanese review feel like play.

### User stories
- As the player, I start a run with one keypress or tap. Each run's gate sequence is different.
- As the player, I steer between lanes with ←/→ on a laptop, or by tapping or swiping on a phone.
- As the player, I see a prompt (e.g. `水`) with answer gates (`water` / `fire` / `tree`) and must pick before the row reaches me.
- As the player, a correct streak escalates my reward and a wrong pick costs me, so accuracy matters.
- As the player, characters I get wrong come back more often in later runs.
- As the player, I start with kana, then move into kanji in a fixed progression. New kanji unlock as I master earlier ones.
- As the player, after the run I see a summary that lists the characters I missed, with their correct answers.
- As the player, I log in once per device and my progress follows me between laptop and phone. If I skip the login, the game still works local-only.

## Core Rules (proposed answers to the intent's open questions)

### Gate types
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
- A row has **2 answer gates** at first. Gate rows after #10 in a run have **3**.
- The army always passes through exactly one gate. Lanes cover the full track width, so there is no way to skip a row.

### Streak and payoff
- Streak = consecutive correct answers in this run.
- Reward for a correct answer, applied to the army count:
  - streak 1–2: `+base`
  - streak 3–4: `+base × 2`
  - streak 5–7: `×2` (doubling)
  - streak 8+: `×3`
- A **×N result is capped at +150 soldiers per gate**, which keeps late-run numbers readable and the boss tunable.
- **Wrong:** army loses `max(5, 30%)` (rounded up) and the streak resets to 0. If the army reaches 0, the run ends as a loss.
- Starting army: 5.

### Run shape
- 20 gate rows, then the boss. About 2–3 minutes in total.
- Track speed ramps linearly from 1.0× to 1.6× over the run. Time from when a row appears to when it's reached goes from about 3.0 s (first row) to about 1.8 s (last row).
- Each run uses a seeded PRNG. The seed is shown on the summary screen, and the same seed with the same SRS state reproduces the same run.

### Item selection per run (SRS-driven)
- Pick the 20 prompts by weighted random choice, without repeats, from the unlocked pool.
- Weight = `2^(5 − box)`. Box 0 has weight 32 and box 5 has weight 1.
- Introduce at most **4 new items** (never seen before) per run, taken in progression order.
- The first 3 rows of every run are **warm-ups**, chosen from the strongest known items (highest box). The exception is before any kanji is unlocked: then the warm-ups are kana.

### SRS model: Leitner boxes 0–5
- Track each item separately per gate type (`水:meaning` and `水:reading` are independent).
- Correct → box +1 (max 5). Wrong → box 0.
- Record `seen`, `correct`, `wrong`, and `lastSeen` for stats.

### Distractors
- Distractors come from the same gate type, drawn from unlocked items plus the next level.
- Never use a distractor that is also a correct answer for the prompt. For readings, exclude every reading of that kanji. For meanings, exclude any overlapping gloss.
- Prefer confusable items when they exist:
  - kana: a hand-curated look-alike list (シ/ツ, ソ/ン, ぬ/め, わ/れ/ね, …).
  - kanji: other kanji that share a component per KRADFILE (e.g. 体/休).
- Each row shuffles answer positions.

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
- Boss size = `round(K × expected army)`. The expected army is what the army would be if the player answered at 80% accuracy, simulated from the run's actual gate sequence. `K` is a tuning constant, starting at 1.0.
- In the clash, both sides lose one unit per tick, animated, until one side reaches 0. Equal sizes count as a loss.
- Win or lose, the SRS updates from the gates. The boss outcome only affects the summary screen and the win/loss stats.

## Tech Stack
- **TypeScript 5 (strict)** and **Vite 6**. No game engine.
- **Canvas 2D** rendering: a simple top-down track, with the army drawn as clustered circles and a count label. At most 200 sprites are drawn; the label always shows the true count.
- Japanese glyphs use system fonts (Hiragino on macOS/iOS, Noto Sans JP on Android). No webfont download.
- **Vitest** for unit tests.
- Dev-only data build: Node 22 script (`tsx`) that downloads KANJIDIC2 and KRADFILE (EDRDG, CC BY-SA 4.0) and emits compact JSON into `src/data/`. The generated JSON is committed, so the app needs no network at runtime.
- Storage: `localStorage`, key `kanji-runner:v1`, with a versioned schema and a migration hook.
- Sync: `@supabase/supabase-js` v2 (the only runtime dependency), on the Supabase free tier.
- Hosting: GitHub Pages, deployed by a GitHub Actions workflow on push to `main`. Vite `base` is `/number-runner/`. The Supabase URL and anon key come from repo Actions variables.

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
tasks/                  → plan.md, todo.md (created in the Plan phase)
src/main.ts             → bootstraps canvas, input, scenes
src/core/               → PURE game logic, no DOM. Fully unit-tested.
  rng.ts                → seeded PRNG
  scoring.ts            → streak/payoff, wrong penalty
  srs.ts                → Leitner updates, selection weights
  progression.ts        → levels, unlock rule, placement
  run.ts                → builds a run (gate rows) from seed + SRS state
  distractors.ts        → answer generation
  boss.ts               → boss sizing + clash resolution
  merge.ts              → progress merge (local ⇄ remote)
src/game/               → DOM/canvas layer: loop, render, input (keys/touch), scenes
src/storage/            → localStorage load/save/migrate
src/sync/               → Supabase client, login form, pull/push
supabase/schema.sql     → table + RLS policies
.github/workflows/      → Pages deploy
src/data/               → generated kana.json, kanji.json, confusables.json
scripts/build-data.ts   → data pipeline (dev only)
tests/                  → Vitest specs mirroring src/core and src/storage
```

## Code Style
- Strict TS, ES modules, named exports, no default exports.
- `src/core` holds pure functions over plain data, with no classes and no globals. Randomness is passed in as an `Rng`, so tests are deterministic.
- `camelCase` for functions and variables, `PascalCase` for types, `SCREAMING_SNAKE` for tuning constants. Tuning constants live in `src/core/tuning.ts`.
- Prettier defaults with 2-space indent and no semicolon debates (Prettier decides).

```ts
// src/core/scoring.ts
import { MAX_MULTIPLY_GAIN, WRONG_MIN_LOSS, WRONG_PCT_LOSS } from "./tuning";

export type GateResult = { army: number; streak: number };

export function applyCorrect(army: number, streak: number, base: number): GateResult {
  const next = streak + 1;
  const gain =
    next >= 8 ? Math.min(army * 2, MAX_MULTIPLY_GAIN)
    : next >= 5 ? Math.min(army, MAX_MULTIPLY_GAIN)
    : next >= 3 ? base * 2
    : base;
  return { army: army + gain, streak: next };
}

export function applyWrong(army: number): GateResult {
  const loss = Math.max(WRONG_MIN_LOSS, Math.ceil(army * WRONG_PCT_LOSS));
  return { army: Math.max(0, army - loss), streak: 0 };
}
```

## Testing Strategy
- **Unit tests (Vitest)** cover everything in `src/core` and `src/storage`: scoring curve, SRS box transitions and weights, new-item cap, unlock rule, placement, distractor validity (no correct answer among distractors, no duplicates), run determinism per seed, and storage migration and corrupt-data recovery.
- **Balance simulation test:** across 1,000 seeded runs, 100% accuracy always beats the boss, 50% accuracy wins less than 10% of the time, and 80% accuracy wins 40–70% of the time.
- **Merge tests:** the merge is commutative, idempotent, and never loses an item present on either side. The later `lastSeen` wins.
- **Sync tests:** `src/sync` runs against a mocked Supabase client. They cover offline, paused (network error), expired session, and first sync with no remote row.
- **Data test:** generated JSON passes a schema check. Every kanji has at least one meaning and at least one reading. Every level has 30 items, except the last.
- **Manual / browser checks:** a playthrough on a laptop (keys) and in a narrow mobile viewport (touch) using the `browser-test` skill, with screenshots of the start screen, a gate row, the boss, and the summary.
- TDD for `src/core`. Rendering code is not unit-tested.

## Boundaries
- **Always:** keep `src/core` DOM-free; run `npm test` and `npm run lint` before each commit; put tuning numbers in `tuning.ts`; credit EDRDG (CC BY-SA 4.0) in the README and on the in-app about line.
- **Ask first:** adding any runtime dependency beyond supabase-js; changing the storage schema version or the Supabase table/RLS; changing the scoring curve or SRS model beyond tuning constants.
- **Never:** use WaniKani content or its API; commit `.env.local`, the Supabase service-role key, or passwords; disable RLS; let sync failures block play; add analytics; copy any existing game's name, art, or levels; commit downloaded raw EDRDG files (only the generated JSON).

## Success Criteria
1. `npm run build` produces a static `dist/` that runs offline in Chrome/Safari on a laptop and a phone.
2. A full run (20 rows plus boss) is playable with ←/→ only, and with touch only, at 60 fps on the laptop.
3. Two consecutive runs with different seeds have different gate sequences. The same seed and the same state reproduce the same run.
4. After answering an item wrong, its box is 0 and its selection weight is 32× that of a box-5 item. Tests verify this.
5. Progress (boxes, unlocked level, stats) survives a page reload. Corrupt storage resets without crashing.
6. Kana levels unlock kanji level 2 under the 80% rule, or immediately via placement.
7. The balance simulation meets its thresholds (see Testing Strategy).
8. No distractor is ever a valid answer for its prompt. This is property-tested over all items.
9. The summary lists every missed item with its correct answer.
10. The game is live on GitHub Pages and playable on a phone.
11. Progress from a run on the laptop shows up on the phone after login, and the reverse. With the network off, play still works and syncs later.
12. A request with another user's session (or none) cannot read or write the progress row. This is checked manually against RLS.

## Out of Scope (v1)
Maths gates, English→kanji gates, sound/TTS, multi-user, sign-up flow, password reset UI, realtime sync, vocabulary (multi-kanji words), enemies or obstacles between gates, multiplayer, leaderboards, accounts, backend, 3D art, native app.

## Open Questions
1. ~~Hosting~~: resolved, public repo on GitHub Pages.
2. ~~Export/import~~: resolved, replaced by Supabase sync.
3. ~~Scoring curve~~: resolved. Keep `−max(5, 30%)`, because losing the streak is the real penalty. It's tunable in `tuning.ts`.
4. ~~Ordering~~: resolved. Use grade + frequency + the component pass, with an override file kept in reserve. No WaniKani-derived data.
5. ~~Reading gates~~: resolved. Accept any main reading, with no label (see Gate types). A labelled on/kun gate type may come later.

None remaining.
