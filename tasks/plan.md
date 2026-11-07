# Implementation Plan: Kanji Runner

Spec: `SPEC.md` (revision 4, approved 2026-11-07). Tasks: `tasks/todo.md`. Rework rationale: `docs/ideas/crowd-runner-rework.md`. Shooting rationale: `docs/ideas/shooting.md`. Crates: `docs/ideas/crates.md`.

## Overview
Build the game in vertical slices:
1. ~~A playable kana-only run~~ (done). The playtest showed lane picking felt like timed flash cards.
2. **Rework (Phase 1b):** continuous steering, crowd width and hazards, then drag + deploy, then shooting (auto-fire, breakable blocks, enemy packs), then a phone feel test, then squad charges. The rework is proven fun on kana before anything is built on top of it.
3. Real kanji data plus the learning loop (review boxes, levels).
4. The boss, the balance bot and polish.
5. Supabase sync last. It's optional by design, so everything before it works without it.

## Architecture Decisions
- **Pure core, thin shell.** `src/core` holds every rule as a pure function: `(state, input, rng) → state`. `src/game` only renders and turns input into a steering target. This makes the rules TDD-able and lets the balance bot drive the real sim.
- **Continuous position, not lanes.** `RunState` holds the crowd centre `x` and a `targetX`. Every choice (gate opening, squad) is "nearest to `x` at the decision point". One rule serves both question shapes.
- **Track is data.** `track.ts` turns a seed into a list of beats (question, hazard, calm stretch). `sim.ts` only consumes beats, so layouts are property-testable without running the game.
- **Fire is part of the sim.** Firepower, targeting and threat damage are stepped in `sim.ts` with the rules in `fire.ts`, so the balance bot gets shooting for free. Threat strength comes from `expectedArmy`, computed once from the run's questions.
- **Clipping is separate from answers.** Clip losses go straight to the army count and never touch the streak, results or SRS. This keeps the practice signal clean.
- **Renderer reads a view model.** `viewOf(state)` hides squad correctness until resolution. That makes the honesty rule testable instead of a promise.
- **One `Progress` type is the contract.** Storage, merge, run building and sync all read and write the same versioned `Progress` shape, defined once in `src/core/types.ts` during Task 7.
- **Generated data is committed.** The data pipeline is dev-only, so the runtime and CI never download EDRDG files.
- **Fixed-timestep loop.** The simulation runs on a fixed step, decoupled from rendering, so speed and timing are the same at any frame rate.

## Dependency Graph
```
T1 scaffold ─ T2 core rules ─ T3 lane slice (done)
                                 └─ R1 continuous steering + wall gates
                                     └─ R2 crowd width + clipping
                                         └─ R3 track layout + hazards
                                             └─ R4 drag + Pages deploy ──────────┐
                                                 └─ S1 auto-fire + breakable blocks
                                                     └─ S2 enemy packs           │
                                                         └─ ◆ Checkpoint A: feel test
                                                             └─ R5 squad charges │
                                                                 └─ ◆ Checkpoint A2
 T5 data pipeline [parallel-safe, needs only T1]                                 │
  └─ T6 kanji gates + distractors (after A2)                                     │
      └─ T7 SRS + local storage                                                  │
          ├─ T8 progression + placement                                          │
          ├─ T9 boss + balance bot (needs R5) ─ T10 summary + polish             │
          └─ T11 merge [parallel-safe] ─ T12 sync module ─ T13 login + wiring ◄──┘
```

## Task List

### Phase 1: Playable slice (done)
- [x] T1: Scaffold project
- [x] T2: Core rules for a kana run
- [x] T3: Playable kana run on laptop (lane model, now replaced)
- ~~T4~~: superseded by R4

### Phase 1b: Crowd runner rework
- [x] R1: Continuous steering through wall gates
- [x] R2: Crowd width and wall clipping
- [x] R3: Track layout and hazards
- [x] R4: Drag steering and GitHub Pages deploy
- [x] S1: Auto-fire and breakable blocks
- [x] S2: Enemy packs
- [x] S3: Always-on fire and supply crates (Checkpoint A feedback)
- [x] S4: Longer fire range and crate rewards shown (Checkpoint A feedback)

### Checkpoint A: feel test on the phone (spec criterion 16)
- [x] Feels like a crowd runner, right answers feel like power, prompts readable while steering and firing, fun with known answers
- [x] **Go/no-go:** passed 2026-11-07; if the feel is wrong, revisit the idea doc before R5

- [ ] R5: Squad charges

### Checkpoint A2: squads
- [ ] Squads are fun and give nothing away. Runs with squads beat runs without.

### Phase 2: Learning loop
- [ ] T5: Kanji data pipeline
- [ ] T6: Kanji meaning and reading gates with distractor rules
- [ ] T7: SRS and local persistence
- [ ] T8: Levels, unlock rule and placement

### Checkpoint B: learning loop works
- [ ] Missed characters come back more often across runs, and progress survives a reload
- [ ] Kanji level 2 unlocks via placement and via the 80% rule

### Phase 3: Boss and polish
- [ ] T9: Boss sizing, clash and balance bot
- [ ] T10: Summary screen, streak feedback and attribution

### Checkpoint C: v1 local complete
- [ ] Spec success criteria 1–12 and 16 met
- [ ] Owner playtest

### Phase 4: Sync
- [ ] T11: Progress merge (pure)
- [ ] T12: Supabase schema and sync module
- [ ] T13: Login form and sync wiring

### Checkpoint D: complete
- [ ] Spec success criteria 13–15 met (deployed, cross-device check, RLS check)

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Drag steering feels bad on the phone | High | R4 comes before squads, and Checkpoint A is a go/no-go. `DRAG_GAIN`, `STEER_MAX_SPEED` and easing live in `tuning.ts`. |
| Reading prompts while dodging is too much | High | Calm stretch before every question. Lengthen `CALM_DISTANCE` at Checkpoint A rather than slowing the whole run. |
| Still not fun when the answers are known | High | Checkpoint A tests it explicitly with all-easy runs. If it fails, the problem is the track, not the quiz: revisit the idea doc before R5. |
| Replacing lanes breaks `sim.test.ts` (151 lines) | Med | R1 rewrites the lane tests as position tests in the same task. Scoring and run-builder tests are unaffected. |
| Fire and effects make prompts hard to read | High | The spec bans effects over the prompt and labels. Checkpoint A checks it on the phone. Quieten effects during calm stretches if needed. |
| Snowball: a big army flattens everything and the run gets boring | High | Threat strength follows `expectedArmy` (80%-accuracy pass), not the player's actual army. The balance bot checks that 50% accuracy dies early and 100% doesn't. |
| Too much on screen in ~65 s (walls, blocks, saws, enemies) | Med | Enemy packs take existing hazard beats instead of adding more. Thin them at Checkpoint A. |
| R3 is too large | Med | Split saws into their own task if blocks + layout already fill a session. |
| Squad answers leak through visuals | Med | View-model honesty test (R5) plus the owner check at Checkpoint A2. |
| Balance thresholds are hard to hit with clipping | Med | The bot drives the real sim. Tune `K`, `EXPECTED_SURVIVAL` and the hazard widths against it. |
| KANJIDIC glosses are long or odd (e.g. "Chinese numeral one") | Med | T5 picks the shortest clean gloss and writes a report of the questionable ones. A gloss-overrides map backs it up. |
| Japanese glyphs render badly on Android without a webfont | Low | Check at Checkpoint A on the real phone. A subset webfont is the fallback (ask first). |
| Supabase free project pauses | Low | Local-first design: sync failure only changes the status label. |
| ~~Repo still private, so Pages won't deploy~~ | Resolved | Repo is public, Pages deploys from Actions. |

## Parallelization
- T5 (data pipeline) depends only on T1. It can run alongside the rework.
- T11 (merge) depends only on the `Progress` type from T7.
- R1–R4, S1, S2 and R5 are strictly sequential: each one changes `sim.ts`.

## Open Questions
- None blocking. Before R4 the owner must make the repo public and enable Pages. Before T13 the owner must do the Supabase setup (spec, "One-time manual setup").
