# Spec: 3D depth and camera (v1.4.1)

Extends `docs/specs/SPEC-3d.md` (v1.4). Everything there still holds unless this spec says otherwise. Intent: `docs/intent/3d-depth.md`. Raised by the owner at Checkpoint H1 (2026-11-12), with a screenshot of a commercial crowd runner as the reference for the *feel* only (genre-inspired; nothing copied).

> **Amendment v1.4.2 (owner, 2026-11-13, Task T3c):** overlay text is no longer held back to `VIEW_DISTANCE`. Prompts, labels and counts show from `SHAPE_DISTANCE`, hazed exactly like their object (opaque, colours mixed toward the haze by the object's haze factor; size proportional). This overrides the **Read horizon** rule, the text fade band, and the matching Always/Never/success lines below. 3D may be easier than 2D.

> **Amendment v1.4.3 (owner, 2026-11-13, Tasks C1–C2):** camera tuning and sideways follow. Intent: `docs/intent/3d-camera-follow.md`. See **Camera tuning (v1.4.3)** below; it overrides "The camera still does not follow steering" and, for tuned settings, the camera **Hard rule** and **Aim** bands. With no tuned settings, today's camera is unchanged.

## Objective
Make the 3D run read like a crowd runner seen from just behind the crowd. The track should run deep into the distance, with gates, crates, saws and crowds appearing far off as faint shapes that fade in slowly instead of popping in. The camera is lower, flatter and closer, so the army is bigger on screen. Gameplay and difficulty do not change.

### Why
- **Pop-in:** objects stay hidden until `FOG_START` × `VIEW_DISTANCE` (0.7 × 3.0) and then fade in over only the last 0.9 track distance (about 9 world units). They seem to pop out of the fog.
- **Feels faster than 2D:** 2D shows a row from `VIEW_DISTANCE`, but in 3D the row is only fully visible from about 0.7 × `VIEW_DISTANCE`. The player gets less warning, so the same speed feels faster.
- **Too steep:** the camera sits about 45° above the track (12 up, 12 back) and goes steeper on narrow screens. The screen shows the ground under the army instead of the track ahead.

### User stories
- As the player, I can see the next gates, crates and enemy crowds far down the track as small, hazy shapes that gradually firm up as I run towards them.
- As the player, I can read a gate's kanji at the same distance as in 2D, so the 3D run doesn't feel faster or harder than 2D.
- As the player, my army is big and close in front of me, and I can always see both sides of every gate.

## Rules

### Two horizons
There are now two distances ahead of the army:
- **Shape horizon, `SHAPE_DISTANCE`** (rendering constant in `src/game/three/world.ts`; start at 2 × `VIEW_DISTANCE` = 6.0, tuned by eye). Solid 3D objects can be seen up to here: wall slabs and their opening panes, crates, saws, packs, squads and the boss crowd. Beyond it, nothing on the track is drawn. The track surface, its edges and markings may carry on into the haze.
- **Read horizon, `VIEW_DISTANCE`** (unchanged, gameplay). Overlay information appears only inside this distance: prompts, answer labels, and the counts on crowds, squads, crates and the boss. This is the information that decides play, so readable warning stays the same as in 2D.

This replaces SPEC-3d's **Visibility horizon** rule ("nothing on the track more than `VIEW_DISTANCE` ahead is visible") and its fog numbers.

### Haze (replaces the short fog band)
- Distance haze fades objects towards the sky or horizon colour over a long range. An object at `SHAPE_DISTANCE` is almost entirely sky-coloured. It gains contrast steadily as it comes closer, and is at full colour by about `VIEW_DISTANCE` (tuned by eye; exponential or long linear fog are both fine).
- No step: an object's on-screen contrast never jumps from one frame to the next as it approaches (no pop-in). This includes the moment it crosses `SHAPE_DISTANCE`, where it must already be essentially invisible in the haze.
- Overlay text fades in over a short band just inside `VIEW_DISTANCE`: alpha 0 at `VIEW_DISTANCE`, 1 by 0.9 × `VIEW_DISTANCE`. This replaces `fogAlpha`'s 0.7–1.0 band. It never shows earlier than `VIEW_DISTANCE`.

### Re-ask safety (keeps SPEC-reask's guarantee)
- A re-ask can change a row's shape, for example from a 2-answer wall to a 3-answer wall. The replaced row must never be within `SHAPE_DISTANCE` when the substitution happens, or a visible wall would change shape.
- Rows are at least `CALM_DISTANCE + 2 × HAZARD_SPACING` (7.2) apart, and a re-ask replaces a row at least `REASK_GAP_MIN` (3) rows ahead, so a replaced row is at least 21.6 ahead. `SHAPE_DISTANCE` must stay below that minimum gap. A test pins this, so raising `SHAPE_DISTANCE` past it fails.
- Hazards, packs and squads come from the planned track, as now. If anything is created or replaced at runtime ahead of the army, it must happen beyond `SHAPE_DISTANCE`. If it can't, stop and ask.

### Camera (replaces T1b's aim)
- Lower, flatter and closer than now, so the army is visibly bigger on screen and the track runs up towards the top. Height, distance back, pitch and FOV are picked by eye in `view.ts` and stay pure and tested in `world.ts`, as now.
- **Aim** (shares of screen height from the top, at 390×844 and 1280×800):
  - Army centre at 66–76%. This overrides T1b's 78–86%.
  - Track at `SHAPE_DISTANCE` at 5–15%.
  - Sky above that is at most about 10% of the screen. T1b's "half the screen is light blue" must not come back.
- **Hard rule:** at 390×844, both track edges are inside the screen at the army's depth, and both side openings of a wall are fully on screen (with their labels) from `VIEW_DISTANCE` until the wall reaches the army. Fitting a narrow screen may change distance back, height, pitch or FOV, in that order of preference. Making the camera steeper is the last resort.
- **Ask first** if the hard rule can't be met with a camera clearly flatter than now (pitch at the army more than about 8° shallower than the current 390×844 pose). Report the numbers rather than quietly going steep.
- The camera still does not follow steering.

### Camera tuning (v1.4.3)
- **Camera settings** (pure, in `world.ts`/`view.ts`): pitch (°, at the army), distance (camera to army, world units), FOV (°), follow (0–1), follow smoothing (seconds to close most of the gap; 0 = instant). The pose is built from these around the army. Height and distance back follow from pitch and distance.
- **Defaults:** with no saved settings, the pose is exactly today's fitted camera for the screen's aspect (existing aim and hard-rule tests pass unchanged). The settings screen opens with today's pose expressed as settings, follow 0.
- **Follow:** the camera's target sideways position is `follow × worldX(run.x)`; the camera and its look point both shift by it (no yaw). It eases toward the target with the smoothing time, continuous frame to frame, framerate-independent. Run scene only; in the boss scene it eases back to centre. The overlay (labels, counts, pop-ups) projects with the same camera, so text stays on its object.
- **No hard rule for tuned settings:** edges and outer openings may leave the screen. The re-ask, haze and text rules still hold.
- **Settings screen (dev tool):** a DOM panel like the pause card, opened from a gear on the start screen and from the pause card (so the owner can tweak mid-run and resume). One slider per setting with its value shown, a Reset (back to today's camera), and Close. Changes apply live and are saved to `localStorage`; bad or missing saved data falls back to the defaults. Slider ranges: pitch 8–45°, distance from about 0.4× to 2× today's, FOV 20–75°, follow 0–1, smoothing 0–1 s.
- **v1.4.4 (owner at H2, Task C2):** the default camera is the owner's tuned settings (pitch 8°, distance 15, FOV 34°, follow 0.4, smoothing 1 s) at every aspect; the both-edges/outer-openings hard rule and the 66–76% / 5–15% aim bands are retired (army still at 80%). Answers may leave the screen. `SHAPE_DISTANCE` defaults to about 4 × `VIEW_DISTANCE` (still below the re-ask gap) and is a sixth setting. The gear is hidden until revealed (5 taps on the build stamp).
- **Untouched:** 2D (the gear's panel may show in 2D but changes nothing there), `src/core`, the golden run, haze, `SHAPE_DISTANCE`, text rules.

### What stays
- `VIEW_DISTANCE`, and every number in `src/core/tuning.ts`.
- Label fitting and wrapping, and label size following projected wall size.
- The 2D renderer and the `?2d` fallback.

## Project Structure
No new files. Touches:
- `src/game/three/world.ts`: `SHAPE_DISTANCE`, the haze range, the overlay fade band and the aim maths.
- `src/game/three/view.ts`: camera constants and aim.
- `src/game/three/scene3d.ts`, `hazards.ts`, `squads.ts` (and wall code): cull objects at `SHAPE_DISTANCE` instead of `VIEW_DISTANCE`, but keep overlay text gated at `VIEW_DISTANCE`.
- `src/game/three/overlay.ts` / `render.ts`: the overlay fade.
- `tests/game/world.test.ts`.

## Testing Strategy
- **Unit (vitest, no WebGL):**
  - Haze is near-total at `SHAPE_DISTANCE` and close to none at `VIEW_DISTANCE`.
  - Overlay alpha is 0 at and beyond `VIEW_DISTANCE`, and 1 inside 0.9 × `VIEW_DISTANCE`.
  - `SHAPE_DISTANCE` is below the minimum re-ask gap. Extend SPEC-reask's seeded "not visible" test to use `SHAPE_DISTANCE`.
  - Aim bands hold at both screen sizes.
  - Both track edges and a wall's outer openings are inside the screen at 390×844 at the army's depth and at `VIEW_DISTANCE`.
- **Unchanged:** the golden run and every existing test, except SPEC-3d's "fog end = `VIEW_DISTANCE`" test, which becomes the haze test above.
- **Browser checks** at 390×844 and 1280×800 with `?3d`, screenshots in the scratchpad:
  - A row and a crate at about 1.8×, 1.2×, 1.0× and 0.8× `VIEW_DISTANCE`: faint shapes far off, firmer closer, labels only from `VIEW_DISTANCE`.
  - A filmstrip of a wall approaching from `SHAPE_DISTANCE` with no visible jump.
  - A 3-answer wall near the army with both outer openings and labels fully on screen.
  - Crowds of 5, 40 and 200.
  - A side-by-side of 2D and 3D at the same run state.
- **Frame time:** logged with a full crowd and everything inside `SHAPE_DISTANCE` drawn. More objects are now on screen, so compare with T3's numbers.

## Boundaries
- **Always:** keep `src/core`, `VIEW_DISTANCE` and the golden run unchanged; keep labels and counts hidden beyond `VIEW_DISTANCE`; keep both gate sides on screen at 390×844.
- **Ask first:** a camera that can only meet the hard rule by staying as steep as now; `SHAPE_DISTANCE` near the re-ask gap; any gameplay change.
- **Never:** let a shape pop in (visible contrast jump), show overlay text beyond `VIEW_DISTANCE`, or let a re-ask change a row within `SHAPE_DISTANCE`.

This replaces SPEC-3d's "Never: show a track row beyond `VIEW_DISTANCE`" and success criterion 4. Its intent is kept: no row's *content* is shown early, and no visible row changes.

## Success Criteria
1. Shapes are visible up to `SHAPE_DISTANCE` and fade in smoothly, with no pop-in (tested and filmstrip).
2. Labels and counts appear at `VIEW_DISTANCE`, as in 2D, never earlier (tested).
3. Re-ask substitution is never within `SHAPE_DISTANCE` (tested).
4. The aim bands and the both-gate-sides rule hold at 390×844 and 1280×800 (tested and browser check).
5. Still smooth on the phone with a full crowd (frame time).
6. **Owner checkpoint (H1, on the phone):** things appear "in the distance" and fade in, the camera feels closer and less steep, and 3D no longer feels faster than 2D.

## Out of Scope
- Changes to the 2D renderer.
- Any gameplay or tuning number, including `VIEW_DISTANCE` and speed.
- Making 3D easier than 2D (no earlier labels).
- New art, models or textures.
- A camera that follows steering. (Superseded by v1.4.3.)
- Label readability tuning beyond what the closer camera gives for free.

## Open Questions
1. **`SHAPE_DISTANCE` value:** 2 × `VIEW_DISTANCE` to start. The owner may want more, up to the re-ask gap, if the reference's long view is still missing.
2. **Haze colour:** fade to the sky colour (as now) or to a paler horizon colour, for a softer far edge. Picked by eye, shown at H1.
