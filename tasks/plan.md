# Implementation Plan: Kanji Runner

Spec: `SPEC.md` (approved 2026-11-07). Tasks: `tasks/todo.md`.

## Overview
Build the game in vertical slices:
1. A playable kana-only run on the laptop, deployed to GitHub Pages so the feel can be tested on the phone early.
2. Real kanji data plus the learning loop (review boxes, levels).
3. The boss and polish.
4. Supabase sync last. It's optional by design, so everything before it works without it.

## Architecture Decisions
- **Pure core, thin shell.** `src/core` holds every rule as a pure function: `(state, input, rng) → state`. `src/game` only renders and turns input into lane changes. This makes the rules TDD-able and keeps the balance simulation fast.
- **One `Progress` type is the contract.** Storage, merge, run building and sync all read and write the same versioned `Progress` shape, defined once in `src/core/types.ts` during Task 5.
- **Generated data is committed.** The data pipeline is dev-only, so the runtime and CI never download EDRDG files.
- **Fixed-timestep loop.** The simulation runs on a fixed step, decoupled from rendering, so speed and timing are the same at any frame rate.
- **Kana data is hand-written** (`src/data/kana.json`, about 140 entries). It needs no pipeline, which unblocks the first playable slice.

## Dependency Graph
```
T1 scaffold
 ├─ T2 core rules (rng, scoring, kana data, simple run builder)
 │   └─ T3 playable kana slice (loop, render, input, scenes)
 │       └─ T4 touch + Pages deploy ──────────────┐
 ├─ T5 data pipeline (kanji.json) [parallel-safe] │
 │   └─ T6 kanji gates + distractors              │
 │       └─ T7 SRS + local storage                │
 │           └─ T8 progression + placement        │
 │               └─ T9 boss + balance sim         │
 │                   └─ T10 summary + polish      │
 └─ T11 merge (pure) [parallel-safe after T7 types]
     └─ T12 sync module + schema
         └─ T13 login UI + wiring ◄────────────────┘ (needs deployed site + Supabase setup)
```

## Task List

### Phase 1: Playable slice
- [ ] T1: Scaffold project
- [ ] T2: Core rules for a kana run
- [ ] T3: Playable kana run on laptop
- [ ] T4: Touch controls and GitHub Pages deploy

### Checkpoint A: playtest on laptop and phone
- [ ] Tests, lint and build pass
- [ ] Owner plays it on the laptop and the phone and confirms speed, lane feel and readability before we build on top

### Phase 2: Learning loop
- [ ] T5: Kanji data pipeline
- [ ] T6: Kanji meaning and reading gates with distractor rules
- [ ] T7: SRS and local persistence
- [ ] T8: Levels, unlock rule and placement

### Checkpoint B: learning loop works
- [ ] Missed characters come back more often across runs, and progress survives a reload
- [ ] Kanji level 2 unlocks via placement and via the 80% rule

### Phase 3: Boss and polish
- [ ] T9: Boss sizing, clash and balance simulation
- [ ] T10: Summary screen, streak feedback and attribution

### Checkpoint C: v1 local complete
- [ ] Spec success criteria 1–9 met
- [ ] Owner playtest

### Phase 4: Sync
- [ ] T11: Progress merge (pure)
- [ ] T12: Supabase schema and sync module
- [ ] T13: Login form and sync wiring

### Checkpoint D: complete
- [ ] Spec success criteria 10–12 met (cross-device check, RLS check)

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| The game isn't fun at the spec's speed and timing | High | Playable slice first (T3), then Checkpoint A playtest. All timing lives in `tuning.ts`. |
| KANJIDIC glosses are long or odd (e.g. "Chinese numeral one") | Med | T5 picks the shortest clean gloss and writes a report of the questionable ones. `order-overrides.json` gets a sibling gloss-overrides map. |
| Balance thresholds are hard to hit | Med | The simulation is a unit test, so `K` and the caps get tuned quickly against it. |
| Japanese glyphs render badly on Android without a webfont | Low | Check at Checkpoint A on the real phone. A subset webfont is the fallback (ask first). |
| Supabase free project pauses | Low | Local-first design: sync failure only changes the status label. |
| Repo still private, so Pages won't deploy | Blocks T4 | Owner runs `gh repo edit … --visibility public` before T4. |
| The `browser-test` skill isn't available in this session | Low | Manual browser checks by the owner at the checkpoints. |

## Parallelization
- T5 (data pipeline) depends only on T1. It can run alongside T2–T4.
- T11 (merge) depends only on the `Progress` type from T7.
- Everything else is sequential.

## Open Questions
- None blocking. Before T4 the owner must make the repo public and enable Pages. Before T13 the owner must do the Supabase setup (spec, "One-time manual setup").
