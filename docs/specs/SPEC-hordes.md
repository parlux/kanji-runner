# Spec: hordes (v1.10)

Extends `docs/specs/done/SPEC-3d.md` and the shooting rules (S1/S2, `docs/ideas/done/shooting.md`). Everything there still holds unless this spec says otherwise. Idea and confirmed intent: `docs/ideas/hordes.md`.

## Objective
Enemy packs become hordes of many weak enemies that the army mows down, with spectacular kills. A pack is about as dangerous as it is today, and the Pixel 7 stays smooth.

### User stories
- As the owner, I meet a pack and it's a crowd of enemies running at me, the biggest about 200, and my fire mows them down one after another.
- As the owner, a pack still costs me soldiers if I'm off to the side or my army is small.
- As the owner on my Pixel 7, the run stays smooth while a big pack dies.
- As the owner, I open `?fps` to see the frame rate on the phone.

## Rules

### Pack numbers (core)
- **Head count:** `packCount(expected) = clamp(round(HORDE_K × expected), ENEMY_MIN, PACK_MAX)`. Start with `HORDE_K = 3` (5× today's `ENEMY_K` 0.6) and `PACK_MAX = 200`. Both are tuning constants.
- **Total hit points stay as today:** pack HP = `ENEMY_HP × packStrength(expected)` (today's value). Each enemy has pack HP / head count, so the army shreds a pack in about the same time as now.
- **Survivors:** `packSurvivors` = ceil(remaining HP / per-enemy HP), so the count only drops when an enemy really dies.
- **Width stays as today:** the pack's span comes from its remaining HP as an "equivalent strength" (today's `crowdWidth(remaining HP / ENEMY_HP)`), not from its head count. A horde is denser, not wider, so dodging works as now.
- **Contact:** soldiers lost = `min(army, round(HORDE_THREAT × remaining HP / ENEMY_HP))`, with `HORDE_THREAT` in (0, 1]. Start at 1 (the same threat as today). Lower it only if the bot balance or the owner says packs feel unfair.
- Track generation, spawn chance, speed, steering, blocks, saws, squads and the boss are unchanged.

### Drawing the horde (3D)
- Every live enemy is drawn up to `PACK_MAX` per pack (no "drew 100, the label says 340"). The figure cap covers two full packs in view.
- Horde enemies are drawn smaller (about 0.7× a soldier) and packed denser and deeper, so up to 200 fit today's pack width. They still read as a crowd of figures, not a blob.
- A kill is visible: the dead figure is knocked back or topples and shrinks over a short time (not a pop to nothing), with a small spark burst in the enemy colour. Several kills per second overlap and read as a stream of hits.
- When the last enemy dies, the pack's final burst is bigger than today's.
- Kill effects come from a **pooled** particle and figure buffer in the view (not the core): a fixed-size ring that is allocated once. Nothing is allocated per frame. While the run is paused they stand still (they use the scene clock and `runDist`).
- **Level of detail:** kills beyond about half the shape distance use fewer pieces. Up close, the look is unchanged.
- 2D (`?2d`) shows the new counts with its current look. It gets no new effects.

### Performance (hard)
- One `InstancedMesh` for all pack figures and pooled `InstancedMesh`/`Points` for the kill effects. A horde adds at most 4 draw calls over today's pack scene.
- Logged in each 3D task: frame time with a 200 army, a 200 pack being shot and the busiest scenery look, at 390×844, before and after. The limit is ≤ 1.3× today's pack scene.
- `?fps` shows a small frame-rate readout (a rolling average over about 1 s) in a corner, for the owner's phone check. It isn't shown without the flag, and it isn't in 2D.
- If the limit is missed: make the effects cheaper first (pool sizes, fewer pieces, LOD distance), then lower `PACK_MAX`.

## Rework after Checkpoint M1 (owner, 2026-11-14)
Owner: "even at 200 it doesn't feel like a horde. It still looks like a static red blip that just explodes as soon as you shoot it. I think they also move too late. Can we add a slider to adjust the size/scale of the enemy. Honestly I'd like to see what 2000 looks like, maybe even 20,000."
Owner's choices: a big pack takes **about 2–3 s** to mow down; a horde **fills the track**; a dev panel has sliders for **enemy count, figure size, kill time and pack width**.

These rules replace the matching ones above:
- **Charge from the haze:** a pack starts running at the army as soon as it is drawn (`PACK_WAKE` = the default shape distance, 12 track units), not at `VIEW_DISTANCE` (3). Speed and steering are unchanged. A pack waits while an unanswered wall stands between it and the army, so it never runs through a wall (where it can't be shot).
- **Kill time:** pack HP = `KILL_SECONDS × FIRE_PER_SOLDIER × expected` (start `KILL_SECONDS` = 2.5), so an army of the expected size facing the whole pack mows it down in about that long. Per-enemy HP = pack HP / head count.
- **Width:** pack width = `PACK_WIDTH` (a share of the track, start 1.0, the whole track), shrinking towards today's `crowdWidth` as it is shot down (so a dying horde narrows, still in the same spot). With full width, every pack reaches the army, so contact replaces dodging as the threat.
- **Threat stays light:** soldiers lost on contact = `min(army, round(HORDE_THREAT × packStrength(expected) × survivors / heads))`: a fully intact pack costs today's pack strength, and a pack shot to 10% costs 10% of that. Tune `HORDE_THREAT` so the bot balance bands still hold.
- **Count:** `PACK_MAX` up to 20,000 (dev slider, log scale 200–20,000). The shipped default is picked by the owner at Checkpoint M2.
- **Runtime tuning:** `HORDE_K`/`PACK_MAX`, `KILL_SECONDS`, `PACK_WIDTH` and `HORDE_SCALE` (figure size) come from a `HordeTuning` object (defaults in `tuning.ts`) that the run is built with, so the core stays pure and the dev panel can change them. Panel changes apply from the next run.
- **Drawing up to 20,000:** one `InstancedMesh` whose figures are animated on the GPU: per-instance attributes (layout offset, phase, death time), with stride, bob, drift, the shrink-out and the pack's position computed in the vertex shader from a few uniforms per pack. Per frame the CPU writes only uniforms and changed death times, never 20,000 matrices. Draw calls: still ≤ 4 extra.
- **Performance:** frame time logged at 200, 2,000 and 20,000 (a 200 army, a pack being shot, the busiest look, 390×844). 2,000 must stay ≤ 1.3× today's pack scene; 20,000 is logged for the owner to judge (it may be too slow for the phone; that's what the slider is for).
- **Dev panel:** a "Horde" sheet styled like the camera panel (`camerasettings.ts`), opened from the same hidden gear. Sliders: enemy count, figure size, kill time, pack width; a reset button; saved on this device only (like `storage/camera.ts`).

## Code layout
- `src/core/tuning.ts`: `HORDE_K`, `PACK_MAX`, `HORDE_THREAT`.
- `src/core/fire.ts`: `packCount`, and `hazardHp` unchanged in value.
- `src/core/sim.ts`: per-enemy HP, `packSurvivors`, `packSpan` (by remaining HP) and `contactLoss` as above.
- `src/game/three/hazards.ts`, `world.ts`: horde layout and scale, and the per-pack and total caps.
- `src/game/three/kills.ts` (new): the pooled kill effects. The view finds a kill by comparing a pack's survivors this frame with the last frame.
- `src/game/three/scene3d.ts` or `view.ts`: the `?fps` readout.

## Testing
- **Unit:** `packCount` clamps and scales; pack HP equals today's for every expected army; survivors drop by one per per-enemy HP of damage; the span at full HP equals today's; contact loss matches the formula; a pack's time to die under steady fire is unchanged.
- **Balance:** the bot runs (`tests/core/balance.test.ts`) stay in their bands. Log the final army before and after.
- **Golden:** the run golden changes only where pack contact losses change. The snapshot is updated in the core task, with the reason in the commit.
- **Browser:** at 390×844, a 200 pack approaching, half shot and dying, with a 200 army, in at least two scenery looks. The frame-time log as above. Screenshots in the scratchpad.

## Boundaries
- **Always:** gates, labels and the army read as well as now. Packs stay dodgeable.
- **Never:** change the squads, the boss, the camera, the scenery or the track generator. No allocation per frame in the effects.

## Success Criteria
1. Big packs show about 200 enemies, every one drawn (tested, screenshots).
2. A pack's danger and time to die match today's, and balance bands hold (tested).
3. Kills look spectacular, with each death visible and a big final burst (owner, on the phone).
4. Frame time ≤ 1.3× today's pack scene (logged), and smooth on the Pixel 7 with `?fps` (owner).
