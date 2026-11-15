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
- [ ] Tested: crate reward in soldiers equals today's for the same expected army; crates and walls are hit from 12 ahead, never past the next wall.
- [ ] 80% bot, 200 seeds, before → after logged: mean shatter distance ahead (±25%), share of crates shattered (±5 points), mean gate widening per row (±20%).
- [ ] Balance bands hold and are logged (spec's list).
**Verification:** `npm run check && npm run test:slow`. **Dependencies:** F1. **Files:** `src/core/{tuning,fire,shooting,walls}.ts`, tests. **Scope:** S (highest risk: balance; use opus)

### Task F3: Straight tracers
**Description:** as the spec's "Drawing": each lane's tracer straight ahead, stopping at what that lane hits, fading at 12 or stopping at the wall. No aimed streams; crate hit flash where its lanes hit. 2D the same rule.
**Acceptance criteria:**
- [ ] Tested: lane end points for a crate in front of a pack, a crate to one side, and nothing ahead.
- [ ] Browser at 390×844: crate in front of a pack (partial and full cover), crate alone, wall only; Countryside and Race day. Screenshots in the scratchpad.
- [ ] Frame time and draw calls unchanged (logged).
**Verification:** `npm run check` plus browser. **Dependencies:** F2. **Files:** `src/game/three/hazards.ts`, `src/game/render.ts` (2D), tests. **Scope:** S

### Task F4: Version 1.1.0
**Description:** `package.json` 1.1.0, CHANGELOG 1.1.0 entry, pause screen shows `v1.1.0`.
**Acceptance criteria:**
- [ ] Build label shows `v1.1.0 · <hash> · <time>`; CHANGELOG entry lists the changes.
- [ ] Deploy green (checkpoint follows).
**Verification:** `npm run check`. **Dependencies:** F3. **Files:** `package.json`, `package-lock.json`, `CHANGELOG.md`. **Scope:** XS

### Checkpoint F: straight fire on the phone (owner)
- [ ] Owner: no hits through crates; tracers straight; crates and gates feel as hard as before; build label v1.1.0.
