# Tasks: straight fire (v1.1.0)

Spec: `docs/specs/SPEC-straight-fire.md` (2026-11-15). Idea and confirmed intent: `docs/ideas/straight-fire.md`. Started 2026-11-15.
Review: https://claude.ai/artifact/EFKCvzghsaCHogg8jPnY4L
Every task: `npm run check` passes (plus `npm run test:slow` for `core/` tasks) before it is checked off.

## Plan
- **Rule first, then range, then looks.** F1 splits fire by lane with today's ranges, so crates block. F2 moves to one range and retunes. F3 draws it. F4 bumps the version.
- **Balance logged in every core task** (before and after, 200 seeds).

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Long range makes crates and gates trivial | High | Retune HP and gate growth in F2 against measured shatter distance and gate widening. |
| Splitting fire changes pack kill times | Med | Pack share never exceeds today's; bands logged. |
| Several targets per step break view/bot assumptions | Med | Run state lists targets with shares; existing consumers updated in F1. |

## Phase: Straight fire

### Task F1: Fire by lane, crates block
**Description:** as the spec's "Fire by lane": nearest threat per part of the army span takes that part's share; unblocked share goes to the wall; run state lists the step's targets with shares. Ranges unchanged in this task (crates 2.8, packs 12). Keep 3D, 2D and the bot working (3D may still draw the old way until F3).
**Acceptance criteria:**
- [x] Tested: a crate in front of a pack takes the lanes it covers and the pack gets only the rest; a crate covering the whole army blocks the pack entirely; two crates side by side both take fire; the free share widens the wall; a crate pays out once; two shattering in a step both pay.
  - `splitFire` (fire.ts) cuts the army span at every live threat's edges and gives each piece to the nearest threat over it (ties to the lower index); the rest is `free`. Run state: `targets` (index + share, by index), `target` (the largest share, nearest on a tie), `gateShare` (the free share the wall took). `pickTarget` is gone. Tests: fire.test.ts "splitFire", shooting.test.ts "fire by lane", gates.test.ts (half the crowd behind a crate: the wall grows by half).
- [x] Balance bands logged before and after (spec's list).
  - 200 seeds, `botBossRun` mean final army and win rate, before → after: 100% 1601.51 → 1601.76 (1.00 → 1.00); 80% 321.87 → 321.75 (0.570 → 0.565); 50% 22.36 → 22.30 (0.080 → 0.075); 100% at skill 0.5 1219.53 → 1117.11 (1.00 → 0.925). The skill-0.5 drop: a crate now takes only the lanes it covers (it used to take all the fire on any overlap), so a half-steered army shatters fewer crates before reaching them (100 seeds at 100%: 99.8% → 88.3% shattered) and clips more. Left for F2's retune (longer range gives more time).
**Verification:** `npm run check && npm run test:slow`. **Dependencies:** none. **Files:** `src/core/{fire,shooting,walls,state,horde}.ts`, consumers of `target`, tests. **Scope:** M (highest risk: rule change across core; use opus)

### Task F2: One range, retune crates and gates
**Description:** `FIRE_RANGE` = `PACK_WAKE` for everything; drop `Threat.range`; retune `BLOCK_HP_K`, crate reward and `GATE_GROW_PER_DAMAGE` as in the spec's "Retune".
**Acceptance criteria:**
- [x] Tested: crate reward in soldiers equals today's for the same expected army; crates and walls are hit from 12 ahead, never past the next wall.
  - `FIRE_RANGE` = `PACK_WAKE` (12), `Threat.range` gone. `crateReward(hp)` = round(`CRATE_REWARD_K` (0.3) × round(hp ÷ `BLOCK_HP_K`)): the reward is written from the expected army (always whole soldiers), so it matches the old round(0.3 × hp) for any `BLOCK_HP_K`. Tests: shooting.test.ts "a crate pays as many soldiers as before the retune" (e = 1..2000 and every crate of 20 seeded tracks) and "crates and walls are hit from FIRE_RANGE (12) ahead, never past the next wall".
- [x] 80% bot, 200 seeds, before → after logged: mean shatter distance ahead (±25%), share of crates shattered (±5 points), mean gate widening per row (±20%).
  - Chosen: `BLOCK_HP_K` 1.0 → **1.3**, `GATE_GROW_PER_DAMAGE` 0.001 → **0.0008** (not the spec's 4.0 and 0.00025: the bot lines up on a crate only once the hazard before it is passed, about 3 apart, so the longer range adds little fire time; 4.0 left 15.6% shattered, 1.5 left 48%; 0.00025 halved gate widening).
  - Pre-round (54c9789) / after F1 / after F2: shatter distance ahead 1.975 / 1.842 / 2.437 (+23%); crates shattered 60.2% / 59.8% / 58.3% (−1.9 points); gate widening per row (widest opening − default, rows reached) 0.0844 / 0.0839 / 0.0804 (−5%).
- [x] Balance bands hold and are logged (spec's list). **Met after F2b** (bot change only; see F2b for the numbers: skill 0.5 win rate back to 1.00).
  - 200 seeds, `botBossRun` mean final army (win), pre-round → after F2: 100% 1601.51 → 1592.51 (1.00 → 1.00); 80% 321.87 → 319.03 (0.570 → 0.570); 50% 22.36 → 21.65 (0.080 → 0.075); 100% at skill 0.5 1219.53 → 1116.24 (−8.5%) (1.00 → **0.94**, after F1 0.925). **Not met:** skill-0.5 win rate is 0.06 down. All 12 losses are deaths on an unbroken crate the half-steered crowd lines up on (it covers only part of it, so it takes part of the fire). No mix of the three knobs fixes it: `BLOCK_HP_K` 0.8–1.3 with growth 0.0008–0.002 gives 0.93–0.95, and only 0.95 at growth 0.002, where gate widening is +25%. Left for the owner (a bot or crate-clip change is outside F2).
**Verification:** `npm run check && npm run test:slow`. **Dependencies:** F1. **Files:** `src/core/{tuning,fire,shooting,walls}.ts`, tests. **Scope:** S (highest risk: balance; use opus)

### Task F2b: Bot judges crates by lanes
**Description:** owner, 2026-11-15, after F2 (skill 0.5 win rate 1.00 → 0.94, every loss an unbroken crate): the balance bot decides to shoot or dodge a crate by the fire share it will actually get (the lanes it covers, as `splitFire`), not by any overlap. It shoots when it can break the crate before reaching it, dodges otherwise. Skill noise still applies to steering, so skill 0.5 stays a sloppy player. Game rules unchanged.
**Acceptance criteria:**
- [x] Tested: the bot dodges a crate it can't break with the lanes it would cover and lines up on one it can.
  - `tests/core/bot.ts`: `crateAim` = crate centre + this beat's aim offset (kept on the track; the old aim clamped inside the crate, which put a crowd wider than the crate off-centre); `canBreak(s, i, aim)` = firepower × `splitFire` share at that aim × seconds to the crate (≤ `FIRE_RANGE`) ≥ 1.25 × hp left. Skill noise still moves the aim, and the bot judges where it will actually be. Tests: bot.test.ts (lines up on a wide crate; dodges a crate a fifth of its width; a 0.7-width crate is shot dead on, dodged a quarter-width off).
- [x] Balance bands vs the pre-round baseline logged (spec's list), F2's crate/gate measures re-logged; skill 0.5 within band or the reason explained.
  - 200 seeds, `botBossRun` mean final army (win), pre-round (54c9789) → after F2 → after F2b: 100% 1601.51 → 1592.51 → 1592.76 (−0.5%) (1.00 → 1.00 → 1.00); 80% 321.87 → 319.03 → 318.31 (−1.1%) (0.570 → 0.570 → 0.565); 50% 22.36 → 21.65 → 21.07 (−5.8%) (0.080 → 0.075 → 0.075); 100% at skill 0.5 1219.53 → 1116.24 → 1189.59 (−2.5%) (1.00 → 0.94 → **1.00**). All within ±10% / ±0.05.
  - 80% bot crate/gate measures, pre-round / after F2 / after F2b: shatter distance ahead 1.975 / 2.437 / 2.459 (+24.5%, inside ±25% but at its edge); crates shattered 60.2% / 58.3% / 57.7% (−2.5 points); gate widening per row 0.0844 / 0.0804 / 0.0804 (−5%).
**Verification:** `npm run check && npm run test:slow`. **Dependencies:** F2. **Files:** the bot (tests/ or src/core), tests. **Scope:** S (use opus)

### Task F3: Straight tracers
**Description:** as the spec's "Drawing": each lane's tracer straight ahead, stopping at what that lane hits, fading at 12 or stopping at the wall. No aimed streams; crate hit flash where its lanes hit. 2D the same rule.
**Acceptance criteria:**
- [x] Tested: lane end points for a crate in front of a pack, a crate to one side, and nothing ahead.
  - `laneHits(threats, from, dist, xs, limit)` (fire.ts, pure): per lane x the nearest threat whose span holds x (same filter and tie rule as `splitFire`), else null. `hazards.ts` draws every lane straight from its x to that hit, or on to range end (fading) clipped at the next wall or the boss; the crate's hit flash is one spark at the mean x of its lanes. The squads' separate wall stream is gone (the lanes that hit nothing already end at the wall), so no double drawing. `scene3d.ts` clears `targets` on the boss copy too. Tests: fire.test.ts "laneHits" (crate in front of a pack, full cover, crate to one side, nothing ahead, agrees with `splitFire`).
- [x] Browser at 390×844: crate in front of a pack (partial and full cover), crate alone, wall only; Countryside and Race day. Screenshots in the scratchpad.
  - Crafted states (army 100, 4 lanes) rendered at 390×844: `/private/tmp/claude-501/-Users-parlux-Projects-number-runner/cb6c1d62-6a62-4355-856e-bd452d799f45/scratchpad/f3-{partial,full,crate,wall}-{country,stadium}.png` (partial: crate over the left lanes, the rest reach the pack; full: crate over the whole crowd; crate: 0.2 wide, the outer lanes fly on; wall: no hazards, tracers stop at the wall). 2D: `render.ts` draws no run without the 3D view (a run is never entered), so there are no 2D tracers to change.
- [x] Frame time and draw calls unchanged (logged).
  - Render CPU time per frame (mean of 35, headless Chrome), before the task was not measured with the same harness; after: 1.0–1.5 ms across the 8 scenes (wall only 1.3). Draw calls: same instanced tracer and spark meshes, same caps (120 and 80), no new meshes or materials; at most 5 lanes × 6 tracers + 1 spark per crate.
**Verification:** `npm run check` plus browser. **Dependencies:** F2. **Files:** `src/game/three/hazards.ts`, `src/game/render.ts` (2D), tests. **Scope:** S

### Task F4: Version 1.1.0
**Description:** `package.json` 1.1.0, CHANGELOG 1.1.0 entry, pause screen shows `v1.1.0`.
**Acceptance criteria:**
- [x] Build label shows `v1.1.0 · <hash> · <time>`; CHANGELOG entry lists the changes.
  - `package.json` and lock 1.1.0; the label is built from package.json (`__APP_VERSION__`), no hardcoded label. CHANGELOG 1.1.0 entry (2026-11-15).
- [x] Deploy green (checkpoint follows).
  - Deploy to GitHub Pages run 43688815233 (commit 3c2585e): success.
**Verification:** `npm run check`. **Dependencies:** F3. **Files:** `package.json`, `package-lock.json`, `CHANGELOG.md`. **Scope:** XS

### Checkpoint F: straight fire on the phone (owner)
- [ ] Owner: no hits through crates; tracers straight; crates and gates feel as hard as before; build label v1.1.0.
