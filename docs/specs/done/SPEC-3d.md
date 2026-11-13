# Spec: 3D run (v1.4)

Extends `docs/specs/done/SPEC.md` (v1) through `docs/specs/SPEC-session.md` (v1.3). Everything there still holds unless this spec says otherwise. It overrides v1's "3D art" out-of-scope line. Intent: `docs/intent/3d-run.md`. Idea: `docs/ideas/done/3d-run.md`. Extended by `docs/specs/done/SPEC-3d-depth.md` (v1.4.1: two horizons, haze, lower camera).

## Objective
Draw the run and the boss clash as one continuous 3D scene in the crowd-runner style: a low camera behind a crowd of low-poly figures running down a bright track. Gameplay does not change.

### Why
The flat 2D look (dots on a dark track) feels fake. The fun of the genre is seeing a crowd snowball; that needs figures, depth and a track running into the distance.

### User stories
- As the player, I see my army as a crowd of little running figures that visibly swells on a right answer and thins on a wrong one or a clip.
- As the player, gates, crates, saws, enemy packs and squads are solid 3D objects on the track ahead.
- As the player, after the last gate the boss crowd is waiting at the end of the track and my army runs straight into it. It feels like the end of the run, not a new screen.

## Rules

### What changes
- **Run and boss clash:** drawn in 3D with Three.js on a WebGL canvas.
- **Unchanged:** start, end and study screens, the pause overlay, the login and token forms (2D canvas and DOM, as now). All of `src/core` (sim, scoring, track, boss size, clash maths, tuning), the golden run, records, sessions and sync. Input (keys, drag, tap) and its targets.

### Layers
- A WebGL canvas sits behind the existing 2D `#game` canvas. During the run and the boss clash the 2D canvas is cleared to transparent and draws only the overlay: prompts, answer labels, numbers on crowds and crates, pop-ups, HUD, the result banner and the pause overlay. On other screens it is opaque, as now, and the 3D canvas does not render.
- Input stays bound to the top canvas, unchanged.
- Overlay text is placed by projecting 3D points to the screen with the live camera. It reuses the current label code (fitting, two-line wrap, okurigana dimmed).

### World
- One mapping, in a pure module: track x (0 left .. 1 right) → world X; track distance → world Z (the army runs towards −Z); track width is fixed in world units. The sim's numbers are drawn as they are: a crowd's footprint is `crowdWidth(army)` track widths, openings and hazards keep their spans, so what you see clips is what the sim clips.
- **Camera:** low and behind the army, looking down the track. Centred on the track (it does not follow steering), so both track edges stay in view at the army's depth on a 390×844 phone. Height, distance back, pitch and field of view are constants in `src/game/three/view.ts`, picked for drama, not label size.
- **Visibility horizon:** nothing on the track more than `VIEW_DISTANCE` ahead is visible. Fog (or an equivalent fade to the sky colour) starts at about 0.7 × `VIEW_DISTANCE` and is total by `VIEW_DISTANCE`. This keeps the re-ask rule's "no pop-in" guarantee: rows are replaced only beyond `VIEW_DISTANCE`. The track itself may run on into the fog.
- **Look:** bright daylight. Sky, ground beside the track, a light track surface with edges and scrolling markings so speed reads. Original colours and shapes; genre-inspired only.

### Figures
- One factory, `src/game/three/figures.ts`, builds every figure: the player's soldiers, enemy pack members, squad members, the boss crowd. Nothing else creates figure geometry or materials, so downloaded models can replace it later.
- Low-poly, built in code: a body and a head (e.g. capsule plus sphere), flat shaded. Player soldiers and enemies differ by colour (and the boss crowd by size).
- Drawn as instanced meshes. Up to `MAX_DRAWN_SOLDIERS` (200, may rise if the phone keeps up) per crowd; above that the count on the crowd tells the real number, as now.
- **Crowd layout:** a pure function gives each figure's offset inside the crowd's footprint (packed, the same idea as today's sunflower disc, flattened to the track). Same army size, same layout, so figures don't jitter between frames.
- **Run cycle:** each figure bobs and leans as it runs, with its own phase so the crowd doesn't move in lockstep. Done per frame on instance matrices or in the vertex shader; no skinned animation.
- **Growth and loss:** new soldiers scale in at the crowd's edge; lost ones (wrong answer, clip, firefight, clash) drop out with a short fall or shrink. Purely visual; the sim's count is the truth.

### Objects on the track
Everything the 2D renderer draws today has a 3D form with the same position, span and state:
- **Walls:** a solid slab across the track with the openings cut out (separate wall pieces between openings). Each opening holds a translucent pane: neutral, green or red once answered, glowing at both edges while being shot. Openings widen as the sim grows them.
- **Prompts and labels:** overlay text above the wall and centred in each opening. Their size follows the projected size of the wall: they shrink with distance like real 3D. The current minimum sizes (`PROMPT_MIN_PX`, `LABEL_MIN_PX`) no longer apply in 3D; keep them as constants so readability can be tuned later. Labels still fit their opening's projected width (shrink, then wrap to two lines). A passed wall's labels and prompt fade as now. Far walls' text is drawn first.
- **Squad charges:** a squad of enemy figures standing beyond each opening, with its count on top.
- **Crates:** boxes with hit points and the `+N` reward as overlay text; damage shows (darker or chipped from the top), a hit crate flashes, a shattered crate bursts into pieces; recruits run in to join the crowd.
- **Saws:** a toothed spinning disc on its rail, moving with the sim.
- **Enemy packs:** a crowd of enemy figures facing the army, thinned as they are shot.
- **Fire:** tracers from the crowd to its target; the firefight at a squad charge; kills pop off.
- **Pop-ups:** the clip loss, answer feedback (`+N`, tier tag, `−%`) and streak HUD as overlay text, as now.

### Boss at the end of the track
> **Amendment (owner, 2026-11-13):** in 3D the boss is **one giant figure**, not a crowd: the enemy figure about 5–6× a soldier's height with a big gun, fixed size, HP = the boss size (number and draining bar above it). The clash is a gunfight with no charge: the army stops at firing range, both sides fire, each soldier lost takes 1 HP per `clashAt`. Victory: it topples; Defeated: it stomps forward; Tie: it stands. Read "boss crowd" below as this boss; the maths, timings and the 2D boss are unchanged.
- The boss crowd stands on the track past the last question, at the distance the army covers in `CLASH_APPROACH_SECONDS` at the run's final speed. It comes into view through the fog like anything else, as a large crowd of enemy figures.
- Its count is shown above it once it is in view (see Open Questions).
- The scene switch from `run` to `boss` is invisible: no clear, no "BOSS" title. During the `boss` scene the renderer keeps the camera moving at the final speed for `CLASH_APPROACH_SECONDS` until the fronts meet, then the clash plays: both crowds lose figures per `clashAt`, with sparks or tracers at the front. The result banner (`Victory!`, `Defeated`, `Tie: the boss holds`) shows over the scene, then the end screen follows as now.
- The boss size is computed as it is now (`bossSize(plannedRows(run), charges, seed)`), once per run, so it can be drawn before the `boss` scene starts. No change to its value.

### Fallback
- If WebGL is unavailable, the run and boss clash use the existing 2D renderer, kept as it is (no new features).
- Until Checkpoint H, 3D is opt-in with a `?3d` URL flag; the last task makes it the default and keeps `?2d` to force the old renderer.

### Performance
- Target: smooth play (about 60 fps) on the owner's laptop and phone with a full crowd, a pack and a crate on screen.
- Device pixel ratio capped (e.g. at 2). Instanced figures; shared geometries and materials; no per-frame allocations in the hot path.
- Three.js is a runtime dependency, pinned to an exact version. Import only what is used.

## Project Structure (additions)
```
src/game/three/
  world.ts     → pure: track ↔ world mapping, crowd layout, boss placement, fog distances
  view.ts      → camera and look constants; camera setup
  figures.ts   → the one figure factory (geometry + materials per kind)
  scene3d.ts   → builds and updates the Three.js scene from a run / boss scene each frame
  overlay.ts   → projected overlay text (prompts, labels, numbers, pop-ups)
```
Touches `index.html` (the WebGL canvas), `main.ts` (create the 3D renderer, choose 3D or 2D, resize both canvases), `render.ts` (transparent overlay mode; share its text helpers).

## Commands
Unchanged: `npm test`, `npm run lint`, `npm run build`, `npx vite --port 8765`.

## Code Style
As `docs/specs/done/SPEC.md`: strict TS, short doc comments that state the rule. Pure maths (mapping, layout, placement) lives in `world.ts` with tests; Three.js code stays thin and in `src/game/three/`. Rendering constants live with the renderer, not in `src/core/tuning.ts` (which stays gameplay-only).

## Testing Strategy
- **Unit (vitest, no WebGL):** the track ↔ world mapping and its inverse; crowd layout (count, stays inside `crowdWidth`, stable for the same size); boss placement; the fog end equals `VIEW_DISTANCE`; projected label size shrinks with distance.
- **Unchanged:** the golden run and every existing test pass without edits.
- **Browser checks** (the `browser-test` skill) at 390×844 and a laptop size: crafted run states (small and full crowd, a 2- and a 3-answer wall, an answered wall, a squad charge mid-firefight, a crate under fire, a saw, a pack, the boss coming into view, mid-clash, the result banner). Screenshots in the scratchpad. Check nothing appears beyond `VIEW_DISTANCE`, and the overlay text sits on its object.
- **Frame time:** log average frame time over a few seconds of a full-crowd state in the browser check.

## Boundaries
- **Always:** keep `src/core` and the golden run unchanged; keep every figure in the one factory; keep the 2D fallback working.
- **Ask first:** any gameplay change (timing, sizes, rules) to make the 3D look work; downloaded models or textures; 3D on menu screens.
- **Never:** copy any existing game's art, name or characters; show a track row beyond `VIEW_DISTANCE`.

## Success Criteria
1. With `?3d` (then by default), the run and boss clash render in 3D per the rules; the other screens are unchanged (browser checks).
2. The boss clash continues the run on the same track with no visible scene switch (browser check).
3. `src/core`, the golden run and every existing test are unchanged (tested).
4. No row is visible beyond `VIEW_DISTANCE` (tested and browser check).
5. Smooth on the owner's phone with a full crowd.
6. **Owner checkpoint:** on the phone, a run looks and feels like a crowd runner, and the boss feels like the end of the run.

## Out of Scope (v1.4)
3D start, end and study screens; downloaded, skinned or animated models; textures or asset files; sound; camera that follows steering; label readability tuning (unless the owner raises it at a checkpoint); changes to any gameplay number.

## Open Questions
1. **Boss count before the clash:** today the boss's size appears only when the clash starts. Default: show it above the boss crowd once it is in view, like a pack. Revisit if it changes how runs feel.
2. **Camera numbers:** picked by eye in Task T1 and shown to the owner at Checkpoint H1.
3. **`MAX_DRAWN_SOLDIERS`:** 200 to start; raise it if the phone keeps up.
