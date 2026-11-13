# Spec: scenery (v1.8)

Extends `docs/specs/done/SPEC-3d.md` and `docs/specs/done/SPEC-3d-depth.md`. Everything there still holds unless this spec says otherwise. Intent: `docs/intent/scenery.md`. Idea and mockup: `docs/ideas/done/scenery.md`, `docs/ideas/done/scenery-mockup.html`.

## Objective
Give the 3D run a sky and a roadside. There are five looks, and the run's seed picks one.

### User stories
- As the owner, I start a run and get a countryside, a spring village, a race day, a cloud road or a block city, and the next run is often different.
- As the owner on my phone, the run is as smooth as before.
- As the owner, I open `?scenery=city` to see one look on demand (for checks and screenshots).

## Rules

### Picking a look
- `sceneryFor(seed)` (pure) maps the run's seed to one of the built looks, roughly evenly. The run, pause and boss of one seed always show the same look.
- `?scenery=<id>` (`country`, `spring`, `stadium`, `sky`, `city`) forces a look. An unknown id is ignored.
- While only some looks exist, the pick chooses among those.

### What a look is
- A sky: a gradient dome (top colour → horizon colour, plus a below-horizon colour for Cloud road). The fog colour equals the horizon colour, so the far track blends into it. The fog range stays the game's own (`fogRange`, the haze setting).
- A ground colour, or no ground (Cloud road).
- **Roadside props** that scroll with the run's distance (like the lane dashes) and wrap from behind the camera to the far end, hazed by the scene fog.
- **Backdrop** (hills, mountains, skyline, clouds, balloons, sun): beyond the haze, drawn without fog, never scrolls. It may drift slowly sideways.
- The contents of each look follow the mockup (see the idea). Exact positions and counts are the implementer's call, but each look must read like its mockup at a glance.

### Hard rules
- **The track stays clear:** no prop or backdrop draws over the track or kerbs between the camera and the haze: every scrolling prop has |world x| ≥ `TRACK_W / 2 + 0.8`. Backdrop sits beyond the haze. The kerbs, track, dashes, walls, hazards, squads, army and boss draw exactly as now.
- **The camera's sideways follow never shows a bare edge:** props cover at least ±40 world units sideways, and the ground still fills the view.
- **Deterministic layout:** a look's layout comes from a fixed seed, so it's identical every time (tests and screenshots are stable).
- **Cheap:** built once when the 3D view is created, and the look is swapped by visibility, not rebuilt per run. No allocation per frame. Props are instanced or merged by material. A look adds at most 40 draw calls (`renderer.info.render.calls`, run with a 200 crowd, compared with no scenery), and frame time with the busiest look and a 200 crowd stays within 1.5× of today's.
- **Pause:** while the run is paused, props, drift and particles stand still (they use the scene's `clock` and `runDist`).
- **2D unchanged:** nothing here loads or draws in `?2d` or when WebGL is missing.

### Per-look notes
- **Spring village:** falling petals as one `Points` layer (≤ 300 points) that moves with the run. They stay off the track area, above head height, or are sparse and faint enough not to hide gate text. Owner check at the checkpoint.
- **Race day:** the spectators are one `InstancedMesh` per side (or one in total), coloured per instance. Flags may flutter by scaling.
- **Cloud road:** the ground is hidden. The track gets a visible underside slab and pillars down into a cloud sea. The boss and the boss fight must still stand on the track and look right (screenshots of the boss approach and the fight).
- **Block city:** the window pattern is one small `CanvasTexture` made in code.

## Code layout
- `src/game/three/scenery.ts` (pure, no Three.js): look ids, `sceneryFor(seed)`, the `?scenery` parse, the wrap maths (`wrapZ`), and each look's layout as plain data (positions, sizes and colours from a seeded random). Tested.
- `src/game/three/sceneryMeshes.ts`: builds the meshes for a layout, and `update(runDist, clock)` scrolls them. Thin; it only reads.
- `scene3d.ts`: creates the sky dome and the scenery once; each `render` selects the look for `s.seed` and updates it. The `LOOK.sky` flat background is replaced by the dome.

## Testing
- **Unit (`tests/game/scenery.test.ts`):** `sceneryFor` covers every built look across seeds 0–999 (each 10–30%), is stable for a seed, and `?scenery` overrides it. Every scrolling prop of every look clears the track (|x| ≥ `TRACK_W / 2 + 0.8`). The layout is identical across two builds. `wrapZ` keeps z within range for any distance.
- **Unchanged:** the golden run and every existing test.
- **Browser:** for each look, `?scenery=<id>` at 390×844 and 1280×800: a run with gates and a 40 crowd, and the boss fight. Draw calls and frame time logged with a 200 crowd. Screenshots in the scratchpad.

## Boundaries
- **Always:** keep the track, gates and text exactly as readable as now.
- **Never:** change `src/core`, the camera, the haze settings or 2D. Never load external art.

## Success Criteria
1. Each run shows one of the five looks, picked by its seed (tested, browser).
2. No prop is over the track, and gates and labels look the same as before (tested, screenshots).
3. Draw-call and frame-time limits met with the busiest look (logged).
