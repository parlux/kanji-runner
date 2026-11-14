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
- [x] Tested: packs move from 12 ahead; a full pack under the expected army's fire dies in `KILL_SECONDS` ± 10%; width at full HP = `PACK_WIDTH` and narrows as shot; contact formula; tuning overrides change the run, defaults match the constants.
  - `HordeTuning` (`hordeK`, `packMax`, `killSeconds`, `packWidth`, `hordeScale`; `HORDE_DEFAULTS` in tuning.ts) is the 4th argument of `createRunState` and lives in `RunState.horde`; per hazard the run also keeps `strength` (today's `packStrength`). Pack HP = `killSeconds × FIRE_PER_SOLDIER × expected`; width = f × `packWidth` + (1 − f) × `crowdWidth(strength × f)` (f = HP share left), centred on the pack and kept on the track; contact = min(army, round(`HORDE_THREAT` × strength × survivors / heads)). `PACK_WAKE` = 12, but a pack waits while an unanswered wall stands between it and the army (packs never run through walls; every pack follows a question, so in real runs they start at 3, 6 or 9 ahead). Tests in sim.test.ts and fire.test.ts, including 20,000 heads (survivors, contact, 3D draw cap without NaN).
- [x] Balance bands hold (tune `HORDE_THREAT`); final army and win rate before/after logged here.
  - `HORDE_THREAT` 1 → 0.2. 200 seeds, `botBossRun` mean final army and win rate, before → after: 100% 1537.16 → 1531.01 (1.00 → 1.00); 80% 277.50 → 278.32 (0.49 → 0.51); 50% 17.37 → 15.80 (0.06 → 0.06); 100% at skill 0.5 1118.88 → 1121.60 (1.00 → 1.00). `botRun` 50%: all 200 die, before and after; 100%: none die. At 80%, a pack costs 0.93 soldiers on average (median 0, 90th percentile 3, 6.8% of the army); 45% of packs are mown down before contact, the rest arrive with 26% HP left on average. At `HORDE_THREAT` 1 the 80% win rate fell to 0.28.
**Verification:** `npm test && npm run lint && npm run build`. **Dependencies:** H2. **Files:** `src/core/{tuning,fire,sim,run?}.ts`, tests. **Scope:** M (highest risk: balance; use opus)

### Task H4: GPU-animated horde, up to 20,000
**Description:** replace the per-figure matrix writes for pack enemies with one `InstancedMesh` animated in the vertex shader (per-instance layout offset, phase, death time; per-pack uniforms for position, width, depth and survivors). Layout fills the pack's span and is deep. Shrink-out on death is kept. Figure size from `HORDE_SCALE`.
**Acceptance criteria:**
- [x] Tested: layout for 200, 2,000 and 20,000 stays inside the span; buffers allocated once at the max; no per-frame allocation; per-frame CPU work does not grow with the head count (only uniforms and changed death times).
  - Column layout (owner's change during H4): a pack is a column at the army's width (`crowdWidth(run.army)`, centred on the army) for `HORDE_COLUMN` (3 world units), a funnel widening over `HORDE_FUNNEL` (8) to the core's pack span, then that width on back. Figures fill it front to back by area (`HORDE_GAP` 0.36 × figure size apart), across each row at a golden-ratio fraction, so a 200 pack is a short column, 2,000 runs back about 1.7 track units, 20,000 about 12 (into the haze). The highest index stands at the front and dies first; the rest step up. A waiting pack mills (wanders, turns, slower stride) and draws in to 30% of its column; a charging one forms it in about 0.4 s. The column width is a uniform, ready for the core's value (H3b).
  - `horde.ts`: two slots (one per pack in view, by pack order), each one `InstancedBufferGeometry` draw of up to `HORDE_CAP` 20,000 placed from `gl_InstanceID` in the vertex shader (`hordePlace` in world.ts is the tested CPU mirror). The only per-figure data is a death record (run distance, world x, z) written for the killed range with `addUpdateRange`: 480 KB for both slots, allocated once. A horde figure has legs that swing (72 triangles: 20,000 = 1.44 M triangles). horde.test.ts: layout inside the funnel and on the track at 200 / 2,000 / 20,000, whole or shot down; front first; length grows; buffers the same arrays across frames and runs; no update range on a frame without kills, one range of exactly the kills otherwise; falling figures drawn for `DIE_DIST`, then not; column forms when charging, mills when waiting, stands still when paused; a new run starts empty.
- [x] Browser at 390×844 with 200, 2,000 and 20,000 enemies: approaching, half shot, nearly dead; Countryside and Race day; gates and labels readable. Screenshots in the scratchpad.
  - Crafted runs (200 army, a gate row behind the pack, 1.5 s of charging at run speed, the last 0.3 s shot down) rendered offscreen with the overlay text: `h4-{country,stadium}-{200,2000,20000}-{1-approach,2-half-shot,3-nearly-dead}.png`, plus a waiting 2,000 pack (`h4-*-2000-0-waiting.png`).
- [x] Frame time and draw calls logged at 200 / 2,000 / 20,000 (2,000 ≤ 1.3× today's pack scene; ≤ 4 extra draw calls).
  - Headless (Chrome for Testing, GPU synced each frame), 200 army, a charging pack shot from half to nearly dead, a gate row in view, median of 3 × 240 frames, run twice. Today's pack scene (9ed777a): Countryside 3.6-4.0 ms, Race day 3.4-3.8 ms. After: 200 3.2-3.4 / 3.3-3.7 ms; 2,000 3.8-4.0 / 4.0-4.1 ms (≤ 1.1×); 20,000 13.8-13.9 / 14.3 ms (for the owner to judge). Draw calls unchanged (20 Countryside, 18 Race day; a second pack in view adds 1).
**Verification:** as H3, plus browser. **Dependencies:** H3. **Files:** `src/game/three/{hazards,horde,world,figures}.ts`, tests. **Scope:** M (use opus)

### Task H3b: Column in the core (stream contact, 1 s, merge)
**Description:** as the spec's "Column design": the core's pack span becomes the army-wide column (homing on the army, no dodging); `KILL_SECONDS` default 1.0; stream contact (enemies arrive row by row and cost soldiers as they arrive while fire continues); a pack that wakes while another is still charging joins the back of its column (one target, one stream). Feed the core's column width into the 3D horde uniform so the drawn column and the hit column match. 2D keeps its look with the new numbers.
**Acceptance criteria:**
- [x] Tested: span equals the army's width and follows it; a full pack under the expected army's fire dies in ~1 s; stream contact loses soldiers gradually and stops when the pack is shot out; a pack that arrives untouched costs `HORDE_THREAT × strength` in total; merged packs form one column; pause holds everything.
  - Owner refinement during H3b: far away a pack stays spread wide where it is (`packMouth`: `packWidth` at its own x, no drift, no narrowing as shot: it thins from the front) and mills; within `STREAM_DISTANCE` (2.5) its span closes (`packConverge` 0 → 1) into the column as wide as the army, centred on it (`packSpan`), so nothing that reaches the army can be dodged. `KILL_SECONDS` 1.0.
  - Stream contact: the column holds `packDensity` = max(heads / `PACK_COLUMN_MAX`, crowdWidth(army) / (`HORDE_AREA` × hordeScale²)) enemies per track unit (`HORDE_AREA` is the view's figure gap squared, so they match), capped at `PACK_COLUMN_MAX` 1.2 track units: a stream lasts at most about 0.5 s and ends before the next wall (at least `CALM_DISTANCE` beyond the pack). The front stays at the army; what would run past it arrives (`arrived`, counted as damage so survivors drop) and costs round(`HORDE_THREAT` × strength × arrived / heads) in total, lost as that rounds up; fire keeps shooting the front. The pack is passed once shot out or streamed in; hazards behind wait.
  - Merging: a pack right behind a charging pack with enemies left catches up with its tail (`PACK_MERGE_SPEED` 2.5 faster) and follows it: one target (the front pack), then one stream.
  - Tests: sim.test.ts "stream contact" (untouched costs `HORDE_THREAT` × strength, per-arrival total, front stays at the army, stops when shot out, 20,000 within `PACK_COLUMN_MAX` / closing speed, holds hazards behind, merge, no stream across a wall in real runs at 2,000 / 20,000), span tests (mouth far, column at contact, waiting stays wide, no drift), scenes.test.ts (pause mid-stream holds the scene), horde.test.ts (drawn front = core span far and near, arrivals vanish and shot ones fall, `HORDE_GAP` matches `HORDE_AREA`). 701 tests.
- [x] Balance bands hold (retune `HORDE_THREAT` if needed); before/after logged here.
  - `HORDE_THREAT` stays 0.2. 200 seeds, mean final army, win rate, before (H4) → after: 80% 278.32 → 294.65 (0.51 → 0.535); 100% 1531.01 → 1536.89 (1.00 → 1.00); 50% 15.80 → 17.57 (0.055 → 0.06); 100% at skill 0.5 1121.60 → 1127.39 (1.00 → 1.00). Soldiers lost per pack at 80%: 0.93 → 0.36 (median 0 → 0, 90th percentile 3 → 1, packs costing nothing 56% → 82%): with a 1 s kill most packs die in the stream zone, and only small armies feel the stream.
- [x] Browser: a column streaming into the army at 200 and 2,000; drawn and hit columns line up. Screenshots in the scratchpad.
  - Crafted runs (200 army, centre and near the left edge), far / closing / streaming, the core's hit span drawn as cyan lines at the drawn front: `/private/tmp/claude-501/-Users-parlux-Projects-number-runner/f5677bf4-525f-4e7b-b244-2498cfdcf504/scratchpad/h3b-{200,2000}-{centre,edge}-{1-far,2-near,3-stream}.png`. The drawn front is the core's span; a stream's drawn front sits at the army's front rows (the core meets it at its centre).
  - Frame time (headless, GPU synced, 240 frames closing and streaming, median of 3, run twice, interleaved with H4 at 3bc934b on the same harness): 2,000 4.1-4.5 ms vs H4 4.0-4.5 ms; 200 3.4-3.7 vs 3.1-3.5 ms.
**Verification:** tests (`npx vitest run --maxWorkers=2` under load), lint, build. **Dependencies:** H4. **Files:** `src/core/{tuning,fire,sim}.ts`, `src/game/three/{hazards,horde}.ts`, `src/game/render.ts`, tests. **Scope:** M (highest risk: balance; use opus)

### Task H5: Horde dev panel
**Description:** a "Horde" sheet like the camera panel, opened from the hidden gear: sliders for enemy count (log 200–20,000), figure size, kill time (0.5–3 s), pack width (the far, funnel-mouth width); reset; saved on this device (`storage/horde.ts`); applied from the next run.
**Acceptance criteria:**
- [x] Tested: storage round-trip, malformed or out-of-range saves fall back to defaults; the run is built with the saved tuning.
- [x] Browser: the sheet opens and closes, values show, a changed count shows up in the next run.
- [x] Deploy green (checkpoint follows).
**Verification:** as H4. **Dependencies:** H3b. **Files:** `src/game/hordesettings.ts`, `src/storage/horde.ts`, wiring, tests. **Scope:** S

### Checkpoint M2: horde tuning on the Pixel 7 (owner)
- [ ] Packs mill, funnel into a column and stream in; mowing it down feels like blasting through a horde.
- [ ] Try counts up to 20,000 with `?fps`; pick the default count, figure size, kill time and width.
- [ ] The chosen defaults are smooth on the phone.

Owner, 2026-11-14: defaults count 500, kill time 2.5 s, figure size 1.0×, pack width 0.8. Prefers a loose scattered crowd while waiting, then streaming once they see you (Task H5b).

### Task H5b: Scattered crowd, early stream, owner defaults
**Description:** as the spec's "Scattered crowd and early stream": defaults 500 / 2.5 s / 1.0 / 0.8 (`HORDE_DEFAULTS` and the panel's defaults); a waiting pack is a loose scattered crowd that wanders; on waking the front streams at the army at once and the crowd empties into the stream; the army's fire reaches the stream from where it starts. Core and view agree on the stream's front and width.
Owner change during H5b: default count back to **200** (K 3); and packs follow the army you actually have, part of the way (spec, "Owner change during H5b").
**Acceptance criteria:**
- [x] Tested: defaults; scattered layout spacing (min gap) and extent at 200 / 500 / 2,000; the stream starts at waking and is fed from the crowd's front; fire reaches the stream from its start (never past an unanswered wall); stream contact and merge still hold; pause holds everything.
  - Defaults 200 / 2.5 s / 1.0 / 0.8 (`HORDE_DEFAULTS` = the panel at 200: K = 3 × count / 200); an old save builds as before.
  - Scattered crowd (`packCrowd`, core): a jittered, staggered lattice across the mouth (`packWidth` at the pack's own x), figures `HORDE_GAP_LOOSE` 0.065 × size apart (~2.7 figure widths), as deep as that needs up to `CROWD_DEPTH_MAX` 2 track units, then closer. 200 at 0.8: 1.1 deep, min centre gap 2.1 figure widths; 500: 2.0 deep, 1.75; 2,000: 2.0 deep, 0.84 (20,000 overlaps; dev only). The crowd starts 1 short of the pack's place (the deepest is centred on it, clear of the beats around it) and each figure wanders (≤ 2 × 0.2 gaps) and turns while it waits; it never follows the army.
  - Stream model (core): every pack is a column `PACK_COLUMN_MAX` 2.6 long (deepest crowd + `STREAM_LEAD` 0.6), its head starting at the crowd's front and running at `ENEMY_SPEED` from the moment it wakes, as wide as the army and centred on it (`packSpan`); enemy k stands k × 2.6 / heads behind the head. Drawn, a figure stays in the crowd until its column place is nearer than its crowd place, so the crowd empties from its front (a few rows peel at once) while the rest stand still; it then turns into its lane over 6 world units and runs into the army's front rows. Stream contact, merging and front-first deaths unchanged; the whole column streams in by about 0.7 track units past the pack's place even at the fastest scroll, before the next wall (tested in real runs at 500, 2,000, 20,000).
  - Fire: an awake pack can be shot up to `PACK_FIRE_RANGE` = `PACK_WAKE` (12) ahead, nearest threat first, never past an unanswered wall; in real runs the army fires at each lone pack for ≥ 1.7 s (2.2 s at the start's speed).
  - Packs follow the army (`PACK_ADAPT` 0.8): at waking a pack's HP, heads (capped at packMax) and contact strength are set for expected^0.2 × army^0.8, never below the expected army; kill time under steady fire 2.5 s at 1×, 2.2 s at 2×, 1.8 s at 5×, 1.3 s at 25× (0.7 would give 0.95 s at the 25× a flawless run reaches); armies at or below expected unchanged; nothing changes before waking.
  - Tests: sim.test.ts "scattered crowd and early stream", "packs follow the army you have", stream contact; horde.test.ts (lattice gap and extent at 200 / 500 / 2,000, wander, front-first emptying, no jumps, lane = core span, crash into the front rows, nothing drawn behind the army, pause, the drawn crowd and head match the core); storage defaults and old save. 721 tests.
- [x] Balance bands hold at the new defaults (retune `HORDE_THREAT` if needed); before/after and mean loss per pack logged here.
  - `HORDE_THREAT` stays 0.2. 200 seeds, mean final army and win rate, before (H5) → after: 80% 294.65 → 270.86 (0.54 → 0.51); 100% 1536.89 → 1467.02 (1.00 → 1.00); 50% 17.57 → 14.91 (0.06 → 0.06); 100% at skill 0.5 1127.39 → 1078.00 (1.00 → 1.00); `botRun` 50% all die, 100% none. Loss per pack at 80%: 0.35 → 3.51 soldiers (median 0 → 2, 90th percentile 1 → 10), 4.8% → 6.1% of the army at waking; at 100%: 0.15 → 6.7 soldiers, 0.6% → 2.0%. Late in a 100% run the army is ~24× expected: packs used to vanish in 0.1 s, now last ~1.0 s (median, including the stream's arrivals).
- [x] Browser at 390×844, 500 enemies: waiting, just woken, mid-stream, nearly done; Countryside and Block city; gates readable. Frame time at 500 and 2,000 logged. Screenshots in the scratchpad.
  - Crafted runs (army 100, a 2-answer wall 3 before the pack and the next wall 1.2 past it, kill time 2.5 s): `/private/tmp/claude-501/-Users-parlux-Projects-number-runner/f5677bf4-525f-4e7b-b244-2498cfdcf504/scratchpad/h5b-{country,city}-500-{1-waiting,2-woken,3-mid,4-nearly}.png`, army near the left edge `/private/tmp/claude-501/-Users-parlux-Projects-number-runner/f5677bf4-525f-4e7b-b244-2498cfdcf504/scratchpad/h5b-country-500-edge-{2-woken,3-mid}.png`, and 2,000 `/private/tmp/claude-501/-Users-parlux-Projects-number-runner/f5677bf4-525f-4e7b-b244-2498cfdcf504/scratchpad/h5b-country-2000-{1-waiting,3-mid}.png`.
  - Frame time (headless, GPU synced, 200 army, the last 240 frames of a pack waking, streaming and shot, median of 3, run twice, interleaved with the pre-horde pack scene c2bf4ed on the same harness): pre-horde 3.2-3.6 ms; 500 3.1-4.1 ms (≤ 1.2×); 2,000 3.8-4.9 ms (Countryside and Block city).
- [x] Deploy green.
**Verification:** tests (`npx vitest run --maxWorkers=2`), lint, build. **Dependencies:** H5. **Files:** `src/core/{tuning,sim}.ts`, `src/game/three/{horde,hazards,world}.ts`, `src/storage/horde.ts`, tests. **Scope:** M (use opus)

### Checkpoint M3: scattered crowd and stream on the Pixel 7 (owner)
- [ ] Waiting packs look like a loose crowd milling about; they see you and stream in.
- [ ] 2.5 s of mowing feels right; damage still light.
- [ ] Smooth with `?fps` at 500.

### Task H6: Spectacular kills
**Description:** `kills.ts`: a pooled kill-effect ring. Each kill knocks the figure back or topples it with a spark burst in the enemy colour. Kills are found by comparing survivors between frames. The final burst of a pack is bigger than today's. Fewer pieces beyond about half the shape distance. Effects freeze when paused.
**Acceptance criteria:**
- [ ] Tested: the pool never grows; kill detection counts drops correctly, including across pause and a new run; LOD piece counts.
- [ ] Browser as in H4 at the owner's default count, plus a gate behind a dying pack (labels stay readable). Screenshots in the scratchpad.
- [ ] Frame time logged against H4 and against today's pack scene (≤ 1.3× today's). On a miss: shrink the effects first, then `PACK_MAX`, and log what changed.
- [ ] Deploy green.
**Verification:** as H2. **Dependencies:** H5b and Checkpoint M3. **Files:** `src/game/three/{kills,hazards,horde,fx}.ts`, tests. **Scope:** M

### Checkpoint M: v1.10 (owner, on the Pixel 7)
- [ ] Mowing down a pack looks spectacular.
- [ ] Smooth with `?fps` while big packs die, in several looks.
- [ ] Packs still feel fair: a light bite when misaligned.
