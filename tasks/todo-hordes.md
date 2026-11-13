# Tasks: hordes (v1.10)

Spec: `docs/specs/SPEC-hordes.md` (2026-11-13). Idea and confirmed intent: `docs/ideas/hordes.md`. Started 2026-11-13.
Every task: `npm test && npm run lint && npm run build` pass before it is checked off.

## Plan
- **Numbers, then bodies, then spectacle.** H1 changes the core so a pack is a horde with today's danger. H2 draws every enemy and adds `?fps`. The owner plays it on the Pixel 7 at Checkpoint M1 before the effects are built on top.
- **Effects in the view, not the core.** Kills are found by comparing survivors between frames. The core stays pure and deterministic.
- **Performance first.** Every 3D task logs frame time. On a miss, cheaper effects come before a lower count.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Pixel 7 frame rate drops with 200 enemies plus effects | High | Instancing, pooled effects, LOD, ≤ 1.3× frame-time limit, `?fps` checked by the owner at M1 and M. |
| Hordes change balance (packs too easy or too deadly) | Med | Total HP and contact loss tied to today's values; bot balance logged before and after. |
| 200 dense figures read as a blob | Med | Smaller figures with a stride, screenshots, owner check at M1. |
| Kill effects hide gates or labels | Med | Effects stay at pack height and fade fast; screenshots with a gate behind a dying pack. |

## Phase 15: Hordes

### Task H1: Horde numbers in the core
**Description:** `HORDE_K`, `PACK_MAX`, `HORDE_THREAT` in `tuning.ts`; `packCount` in `fire.ts`; per-enemy HP, `packSurvivors`, `packSpan` (by remaining HP) and `contactLoss` in `sim.ts`, as in the spec. 2D shows the new counts with its current look.
**Acceptance criteria:**
- [x] Tested: `packCount` scales and clamps; pack HP equals today's; survivors drop one per per-enemy HP; the span at full HP equals today's; contact loss matches the formula; time to die under steady fire is unchanged.
  - Head count is stored per hazard in run state (`heads`, from `hazardHeads` at build); each enemy has `hp / heads`. Tests in `tests/core/fire.test.ts` (`packCount`, `hazardHeads`) and `tests/core/sim.test.ts` ("hordes", contact formula).
- [x] Balance bands hold; final army before and after logged here.
  - 200 seeds, `botBossRun` final army (mean) and win rate, before → after: 100% 1537.16 → 1537.16 (win 1.00 → 1.00); 80% 276.89 → 277.50 (0.49 → 0.49); 50% 17.36 → 17.37 (0.06 → 0.06); 100% at skill 0.5 1118.86 → 1118.88 (1.00 → 1.00). `botRun` 50%: all 200 die, before and after. `HORDE_THREAT` stays 1; the small rise comes from contact rounding (round instead of ceil of the remaining strength).
- [x] Golden snapshot updated only for pack-contact changes, with the reason in the commit.
  - Not updated: the run golden snapshots built rows only, not the sim, so it didn't change (noted in slice 2's commit).
**Verification:** `npm test && npm run lint && npm run build`. **Dependencies:** none. **Files:** `src/core/{tuning,fire,sim}.ts`, `src/game/render.ts` (only if the count display needs it), `tests/core/*`. **Scope:** S (highest risk: balance; use opus)

### Task H2: Draw the whole horde, `?fps`
**Description:** `hazards.ts` draws every live enemy up to `PACK_MAX` per pack (cap covers two full packs), smaller (about 0.7×), denser and deeper, so 200 fit today's width. A dead figure shrinks out over a short time rather than popping. Add the `?fps` readout.
**Acceptance criteria:**
- [x] Tested: horde layout keeps every figure within the pack's span; caps hold.
  - `hordeLayout` (world.ts): a jittered hex pattern made once (`PACK_MAX` points, ordered centre-out on a 3:1 deep ellipse), scaled so the widest figure fits the span; figures at `HORDE_SCALE` 0.7, `HORDE_DEPTH` 3. A 200 pack at today's width: closest two figures > 1.5 figure radii apart. hazards.test.ts: 200 drawn for a full pack, 400 for three packs in view (cap), and 10 kills stay drawn while they fall, then go.
- [x] Browser at 390×844: a 200 pack approaching, half shot, and dying, with a 200 army, in Countryside and Race day; gates and labels read as before. Screenshots in the scratchpad.
  - Crafted states rendered offscreen with the overlay text on top (`h2-{country,stadium}-{1-approach,2-half-shot,3-dying}.png`). Killed figures topple back, hop and shrink out over 0.45 run distance (about 0.3 s) from a fixed ring of 64 in the same instanced mesh.
- [x] Frame time and draw calls logged before and after (≤ 1.3×, ≤ 4 extra draw calls). `?fps` shows and is absent without the flag.
  - Headless (Chrome for Testing, GPU synced each frame), 200 army, a 200 pack being shot from half to nearly dead, a gate row in view, median of 3 × 240 frames, before (c2bf4ed) and after run in turn, twice: Countryside 3.0-3.4 → 2.8-3.3 ms, Race day 3.5-3.9 → 3.0-3.7 ms (≤ 1.0×); draw calls unchanged (21 Countryside, 19 Race day; +0).
  - `?fps`: bottom-left readout (rolling 1 s average, updated 4×/s), shown only while the 3D run is drawn; hidden over menus; no element without the flag or in `?2d`.
- [x] Deploy green (checkpoint follows).
**Verification:** as H1, plus the browser check. **Dependencies:** H1. **Files:** `src/game/three/{hazards,world,scene3d,view}.ts`, tests. **Scope:** M

### Checkpoint M1: horde on the Pixel 7 (owner)
Owner, 2026-11-14: not a horde yet. "Still looks like a static red blip that just explodes as soon as you shoot it. I think they also move too late." Wants sliders and to see 2,000, maybe 20,000. Choices: 2–3 s to mow down, fills the track, sliders for count, figure size, kill time and width. See the spec's "Rework after Checkpoint M1". Tasks H3–H5 below; the old kill-effects task is now H6.

### Task H3: Horde rework in the core
**Description:** as the spec's rework: `HordeTuning` (count factor and `PACK_MAX`, `KILL_SECONDS`, `PACK_WIDTH`, `HORDE_SCALE`) with defaults in `tuning.ts`, passed into the run build (default when absent). Packs wake at `PACK_WAKE` (12). Pack HP by `KILL_SECONDS`, width by `PACK_WIDTH` narrowing as shot, contact by survivors × today's strength × `HORDE_THREAT`. 2D keeps its look with the new numbers. Current 3D keeps working (draws up to its cap).
**Acceptance criteria:**
- [ ] Tested: packs move from 12 ahead; a full pack under the expected army's fire dies in `KILL_SECONDS` ± 10%; width at full HP = `PACK_WIDTH` and narrows as shot; contact formula; tuning overrides change the run, defaults match the constants.
- [ ] Balance bands hold (tune `HORDE_THREAT`); final army and win rate before/after logged here.
**Verification:** `npm test && npm run lint && npm run build`. **Dependencies:** H2. **Files:** `src/core/{tuning,fire,sim,run?}.ts`, tests. **Scope:** M (highest risk: balance; use opus)

### Task H4: GPU-animated horde, up to 20,000
**Description:** replace the per-figure matrix writes for pack enemies with one `InstancedMesh` animated in the vertex shader (per-instance layout offset, phase, death time; per-pack uniforms for position, width, depth and survivors). Layout fills the pack's span and is deep. Shrink-out on death is kept. Figure size from `HORDE_SCALE`.
**Acceptance criteria:**
- [ ] Tested: layout for 200, 2,000 and 20,000 stays inside the span; buffers allocated once at the max; no per-frame allocation; per-frame CPU work does not grow with the head count (only uniforms and changed death times).
- [ ] Browser at 390×844 with 200, 2,000 and 20,000 enemies: approaching, half shot, nearly dead; Countryside and Race day; gates and labels readable. Screenshots in the scratchpad.
- [ ] Frame time and draw calls logged at 200 / 2,000 / 20,000 (2,000 ≤ 1.3× today's pack scene; ≤ 4 extra draw calls).
**Verification:** as H3, plus browser. **Dependencies:** H3. **Files:** `src/game/three/{hazards,horde,world,figures}.ts`, tests. **Scope:** M (use opus)

### Task H5: Horde dev panel
**Description:** a "Horde" sheet like the camera panel, opened from the hidden gear: sliders for enemy count (log 200–20,000), figure size, kill time, pack width; reset; saved on this device (`storage/horde.ts`); applied from the next run.
**Acceptance criteria:**
- [ ] Tested: storage round-trip, malformed or out-of-range saves fall back to defaults; the run is built with the saved tuning.
- [ ] Browser: the sheet opens and closes, values show, a changed count shows up in the next run.
- [ ] Deploy green (checkpoint follows).
**Verification:** as H4. **Dependencies:** H4. **Files:** `src/game/hordesettings.ts`, `src/storage/horde.ts`, wiring, tests. **Scope:** S

### Checkpoint M2: horde tuning on the Pixel 7 (owner)
- [ ] Packs charge from the haze and take a few seconds to mow down.
- [ ] Try counts up to 20,000 with `?fps`; pick the default count, figure size, kill time and width.
- [ ] The chosen defaults are smooth on the phone.

### Task H6: Spectacular kills
**Description:** `kills.ts`: a pooled kill-effect ring. Each kill knocks the figure back or topples it with a spark burst in the enemy colour. Kills are found by comparing survivors between frames. The final burst of a pack is bigger than today's. Fewer pieces beyond about half the shape distance. Effects freeze when paused.
**Acceptance criteria:**
- [ ] Tested: the pool never grows; kill detection counts drops correctly, including across pause and a new run; LOD piece counts.
- [ ] Browser as in H4 at the owner's default count, plus a gate behind a dying pack (labels stay readable). Screenshots in the scratchpad.
- [ ] Frame time logged against H4 and against today's pack scene (≤ 1.3× today's). On a miss: shrink the effects first, then `PACK_MAX`, and log what changed.
- [ ] Deploy green.
**Verification:** as H2. **Dependencies:** H5 and the owner's defaults from M2. **Files:** `src/game/three/{kills,hazards,horde,fx}.ts`, tests. **Scope:** M

### Checkpoint M: v1.10 (owner, on the Pixel 7)
- [ ] Mowing down a pack looks spectacular.
- [ ] Smooth with `?fps` while big packs die, in several looks.
- [ ] Packs still feel fair: a light bite when misaligned.
