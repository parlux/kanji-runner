# Tasks: scenery (v1.8)

Spec: `docs/specs/SPEC-scenery.md` (2026-11-13). Intent: `docs/intent/scenery.md`. Idea and mockup: `docs/ideas/scenery.md`, `docs/ideas/scenery-mockup.html`. Started 2026-11-13.
Every task: `npm test && npm run lint && npm run build` pass before it is checked off.

## Plan
- **Shared part plus one look first.** S1 builds the module, the sky dome, the seed pick and Countryside. The owner checks the look and phone speed at Checkpoint L1 before the other four are built.
- **Pure layout, thin meshes.** Layouts, picking and wrapping live in `scenery.ts` and are tested; the mesh code only reads.
- **Core untouched.** No task edits `src/core`, the camera or 2D. A task that seems to need to stops and asks.
- **Mockup as reference.** `docs/ideas/scenery-mockup.html` has each look's shapes and colours. Port the look, not the code: the game must instance or merge its meshes.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Phone frame rate drops | High | Draw-call cap (≤ 40 per look), instancing, frame time logged in every task; checked on the phone at L1. |
| Props or petals hide gates or text | High | Track-clearance test; screenshots with gates; petals checked by the owner. |
| Scenery looks wrong when the camera follows sideways | Med | Props span ±40; screenshots with the army at both edges. |
| Cloud road breaks the boss scene (no ground) | Med | Boss approach and fight screenshots in S5. |

## Phase 14: Scenery

### Task S1: Scenery module, sky dome, seed pick, Countryside
**Description:**
- `scenery.ts` (pure): look ids, `sceneryFor(seed)`, the `?scenery` parse, `wrapZ`, and the Countryside layout (trees, bushes, fence along both kerbs, hills, clouds) from a seeded random.
- `sceneryMeshes.ts`: builds the instanced or merged meshes for a layout once, with show/hide and `update(runDist, clock)`. The backdrop is drawn without fog.
- `scene3d.ts`: the gradient sky dome replaces the flat background. The fog colour follows the look's horizon colour, and so does the overlay text haze colour, if it uses `HAZE_COLOUR`. Each render picks the look for `s.seed` (only Countryside exists for now) and updates it.

**Acceptance criteria:**
- [x] Tested: `sceneryFor` stable and in range; `?scenery` parse; `wrapZ`; every Countryside prop clears the track; layout identical across builds.
- [x] Browser check at 390×844 and 1280×800: a run with gates and a 40 crowd; the army steered to both edges; the boss fight. Gates and labels look as before. Screenshots in the scratchpad.
- [x] Draw calls and frame time with a 200 crowd logged, before and after: ≤ 40 extra draw calls, frame time ≤ 1.5×.
  - Headless (Chrome for Testing, GPU synced each frame), 200 crowd, a gate row and two saws in view, median of 3 × 240 frames: draw calls 16 → 24 (+8: sky dome, fence, trunks, round crowns, pines, bushes, hills, clouds); frame time 3.1 → 3.4 ms at 390×844 (1.1×), 5.1 → 5.9 ms at 1280×800 (1.16×).
  - Build: the `scene3d` chunk 573.0 → 582.5 kB (gzip 149.1 → 152.4); the main chunk unchanged.
- [x] `?2d` unchanged; golden run and existing tests unchanged; deploy green.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** none
**Files:** `src/game/three/{scenery,sceneryMeshes,scene3d,view,world}.ts`, `tests/game/scenery.test.ts`
**Scope:** M (highest risk: sets the structure and the performance budget for every look)

### Checkpoint L1: Countryside on the phone (owner)
- [x] The run feels less empty and still smooth on the phone.
- [x] Gates and text read as well as before.
- [x] Note any change to the look before the other four are built. (Owner, 2026-11-13: "Looks good, carry on"; no changes.)

### Task S2: Spring village
**Description:** cherry trees, stone lanterns along the kerbs, small houses set back, a snow-capped mountain and soft sun in the backdrop, and a pink horizon. Falling petals as one `Points` layer (≤ 300) moving with the run, kept off the track's text area or faint (see the spec).
**Acceptance criteria:**
- [x] Tested: the layout clears the track; the pick now covers both looks; petals are one layer of 260 (≤ 300) and never hang below 6 world units over the track, at any time.
- [x] Browser check as in S1 with `?scenery=spring`, including a screenshot with petals in front of a gate; draw calls and frame time logged within the limits.
  - Headless (Chrome for Testing, loaded machine, so noisy), 200 crowd, median of 3 × 240 frames, run in turn with Countryside: draw calls 16 (no scenery) → 25 (+9: sky dome, trunks, crowns, boxes, roofs, peaks, sun, clouds, petals); frame time 3.6-4.1 ms at 390×844 and 6.1-6.9 ms at 1280×800, against 3.1 / 5.1 ms with no scenery in S1 (1.2-1.35×) and the same as Countryside measured alongside (3.4-3.7 / 6.1-6.8 ms).
  - Looks: snow cap and sun sized to show on a phone's narrow sky; the mountain stands at z = -360 (far plane 400).
**Verification:** as S1. **Dependencies:** S1. **Files:** `scenery.ts`, `sceneryMeshes.ts`, tests. **Scope:** S

### Task S3: Race day
**Description:** stepped grandstands on both sides with instanced spectators coloured per instance, roofs, flags on poles along the kerbs alternating kerb orange and army blue (flutter by scale), balloons in the sky and a deeper blue sky.
**Acceptance criteria:**
- [x] Tested: the layout clears the track; the pick covers three looks.
- [x] Browser check as in S1 with `?scenery=stadium`; draw calls and frame time logged within the limits.
  - Screenshots (run, both edges, boss, at 390×844 and 1280×800) checked; gates and labels read as before; the stands leave the track and a strip of sky.
  - Headless (Chrome for Testing, loaded machine), 200 crowd, median of 3 × 240 frames: draw calls 16 (no scenery) → 22 (+6: sky dome, boxes for tiers, spectators and poles, awnings, flags, balloons, clouds); frame time 3.9-4.1 ms at 390×844 (1.3×) and 7.0-7.1 ms at 1280×800 (1.4×) against 3.1 / 5.1 ms with no scenery; Countryside alongside 3.3 / 6.4 ms. About 3,000 instances in the box mesh (stands and crowd).
  - Flags flutter by scaling their length (per-frame matrix write); balloons drift sideways and bob (they do not rise); the roof slopes up towards the back. All from the scene clock, so they stand still when paused.
**Verification:** as S1. **Dependencies:** S1. **Files:** as S2. **Scope:** S

### Task S4: Block city
**Description:** pastel block buildings with a window texture made in code, in a near-continuous row on both sides; pavement strips; street lamps along the kerbs; a pale skyline backdrop; a slowly drifting blimp.
**Acceptance criteria:**
- [x] Tested: the layout clears the track (buildings start beyond the pavement); the pick covers four looks.
- [x] Browser check as in S1 with `?scenery=city`; draw calls and frame time logged within the limits.
  - Screenshots (run, both edges, boss, at 390×844 and 1280×800) checked; gates and labels read as before; tall blocks leave a strip of sky and the track clear.
  - Headless (Chrome for Testing, loaded machine), 200 crowd, median of 3 × 240 frames: draw calls 16 (no scenery) → 23 (+7: sky dome, blocks, boxes for pavement and lamps, skyline, blimp body, fin, clouds); frame time 3.5-3.8 ms at 390×844 (1.2×) and 7.1-7.5 ms at 1280×800 (about 1.4-1.5×) against 3.1 / 5.1 ms with no scenery in S1; Countryside alongside 3.4-3.7 / 6.3-7.0 ms (city about 1.1× that).
  - Windows: a `block` shape with its own material; a small `onBeforeCompile` tweak computes the window UVs from each instance's own scale (sides only, one window per 2 × 2.4 world units; block sizes are multiples, so windows fit), from one 32×32 `CanvasTexture`. No extra draw call per size. Two rows of blocks per side tile the wrap exactly (gaps absorb the remainder). Lamp arms reach outward over the pavement, never over the kerb. The skyline and blimp glow a little (emissive) so they stay pale.
**Verification:** as S1. **Dependencies:** S1. **Files:** as S2. **Scope:** S

### Task S5: Cloud road
**Description:** no ground; the track gets an underside slab and pillars; a scrolling cloud sea below and a far cloud backdrop; floating grassy islands with trees beside the road; a sky with a white below-horizon colour.
**Acceptance criteria:**
- [ ] Tested: the layout clears the track; the pick covers all five looks evenly (each 10–30% over seeds 0–999).
- [ ] Browser check as in S1 with `?scenery=sky`, including the boss approach and fight (boss stands on the track; nothing looks cut off). Draw calls and frame time logged within the limits.
- [ ] Deploy green.
**Verification:** as S1. **Dependencies:** S1. **Files:** `scenery.ts`, `sceneryMeshes.ts`, `scene3d.ts` (ground and underside toggles), tests. **Scope:** M

### Checkpoint L: v1.8 (owner, on the phone)
- [ ] Several runs show different looks, and each matches its mockup.
- [ ] Smooth on the phone with every look.
- [ ] Gates, text and the boss read as well as before.
