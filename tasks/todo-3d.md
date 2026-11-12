# Tasks: 3D run (v1.4)

Spec: `docs/specs/SPEC-3d.md` (2026-11-12). Intent: `docs/intent/3d-run.md`. Idea: `docs/ideas/3d-run.md`. Starts after v1.3 (runs alongside the owner's Checkpoint G playtest).
Every task: `npm test && npm run lint && npm run build` pass before it is checked off. Test fixtures are synthetic: never commit real WaniKani content.

## Plan
- **Behind a flag until the end.** 3D is opt-in with `?3d` until T5 makes it the default, so every deploy in between leaves the phone game working.
- **Look first.** T1 builds the camera, environment and crowd, and the owner judges the look at Checkpoint H1 before the rest is built on it.
- **Pure maths, thin Three.js.** Mapping, crowd layout and boss placement are pure and tested in `world.ts`; the scene code reads the sim's state and never changes it.
- **Core untouched.** No task edits `src/core` or the golden run. A task that seems to need it stops and asks.
- **One figure factory.** Every figure comes from `figures.ts`.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Labels too small to read under the low camera | High | Owner chose look first; size constants kept for later tuning; owner checks at H1 and H. |
| Rows pop in, breaking the re-ask guarantee | High | Fog total by `VIEW_DISTANCE`, tested in `world.ts` and checked in the browser (T1, T2). |
| Slow on the phone with a full crowd | Med | Instancing, DPR cap, frame-time log in browser checks; `MAX_DRAWN_SOLDIERS` is the lever. |
| 3D and the sim disagree on where things are (clips look wrong) | Med | One mapping in `world.ts`, footprint = `crowdWidth`; screenshots of a crowd at an opening edge (T2). |
| Bundle size grows | Low | Pinned Three.js, import only what is used; note the build size in T1. |

## Phase 10: 3D run

### Task T1: 3D scaffold, camera, environment and crowd (behind `?3d`)
**Description:**
- Add Three.js (exact version pinned). A WebGL canvas behind `#game`; `main.ts` creates the 3D renderer when `?3d` is set and WebGL works, resizes both canvases, and renders 3D only during `run` and `boss` scenes.
- `world.ts` (pure): track ↔ world mapping, crowd layout, fog distances. `view.ts`: camera constants (low, behind, centred on the track) and setup.
- Environment: sky, ground, light track with edges and scrolling markings; fog total by `VIEW_DISTANCE`.
- `figures.ts`: the one factory; low-poly soldier (body + head), flat shaded. The player's army as an instanced crowd at `run.x`, sized by `crowdWidth`, with a run bob, scale-in on growth and drop-out on loss.
- `render.ts`: a transparent overlay mode during `run`/`boss` with `?3d`, drawing only the HUD, the army count and pop-ups for now. Walls, hazards and the boss are not drawn yet in 3D (the run is playable but blind; that's fine behind the flag).

**Acceptance criteria:**
- [x] Without `?3d` the game is unchanged (golden run and every existing test pass unchanged; browser check of a run).
- [x] `world.ts` tested: mapping round trip, layout count and footprint within `crowdWidth`, layout stable for the same size, fog end = `VIEW_DISTANCE`.
- [x] Browser check at 390×844 and 1280×800 with `?3d`: crowds of 5, 40 and 200; both track edges visible at the army; screenshots in the scratchpad. Frame time logged for the 200 crowd. Build size before and after noted.
  - Build: main chunk 615.9 → 617.4 kB (gzip 160.8 → 161.4); Three.js loads only with `?3d`, as its own chunk (529 kB, gzip 134). Frame time with a 200 crowd (headless, 390×844): 0.37 ms CPU per frame, 60 fps.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** none
**Files:** `package.json`, `index.html`, `src/main.ts`, `src/game/render.ts`, `src/game/three/{world,view,figures,scene3d}.ts`, `tests/game/world.test.ts`
**Scope:** L (highest risk: the look and camera set up everything after it)

### Task T1b: Camera fix (owner feedback at H1)
**Owner, 2026-11-12, on the phone with `?3d`:** "the player is a long way up the screen, and basically half the screen is light blue." (Gates missing was expected: T2.) H1 moved after T2 so the look is judged with gates.

**Description:** Re-tune the camera in `view.ts` (height, distance back, pitch, field of view; `DIST_SCALE`/`TRACK_W` if needed) so the screen is mostly track, like the 2D layout: the army near the bottom and the fog line high. Both track edges stay visible at the army. Still a low-ish, behind-the-crowd 3D view, not top-down.

**Acceptance criteria:**
- [x] Tested (pure projection in `world.ts`/`view.ts`) at 390×844 and 1280×800: army centre at 78–86% of screen height; the fog line (track at `VIEW_DISTANCE`) at 18–28% from the top; both track edges inside the screen at the army's depth.
- [x] Army count and pop-ups stay on screen at both sizes.
- [x] Browser check at both sizes with crowds of 5, 40, 200; screenshots in the scratchpad.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T1
**Files:** `src/game/three/{view,world,scene3d}.ts`, `tests/game/world.test.ts`
**Scope:** S

### Task T2: Walls, gates, labels and squad charges
**Description:**
- 3D walls with openings cut out and translucent panes: neutral, green or red once answered, glowing edges while shot; openings widen with the sim.
- `overlay.ts`: prompts and answer labels as projected overlay text, sized by projected wall size (no minimum floors in 3D; constants kept), fitted and wrapped to the opening's projected width, far walls first, passed walls fading as now. Share the label helpers from `render.ts` rather than copying them.
- Squad charges: enemy figures (from the factory) standing beyond each opening, counts on top; the firefight with tracers and figures dropping.

**Acceptance criteria:**
- [x] Browser check at 390×844 with `?3d`: a 2- and a 3-answer wall far and near, an answered wall (green and red), a wall being shot, a reading label with okurigana, a squad charge before and mid-firefight, a crowd at an opening's edge (the clip matches what is seen). Screenshots in the scratchpad.
- [x] No row visible beyond `VIEW_DISTANCE` (browser check of a row just beyond and just inside).
- [x] Projected label size shrinks with distance (tested).

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T1b
**Files:** `src/game/three/{scene3d,overlay,world}.ts`, `src/game/render.ts`, `tests/game/world.test.ts`
**Scope:** L

### Task T3: Hazards, fire and pop-ups
**Description:** Crates (hit points and `+N` as overlay, damage, hit flash, burst on shatter, recruits running in), saws (toothed spinning disc on its rail), enemy packs (enemy figures facing the army, thinned as shot, kills popping off), fire tracers from the crowd to its target, and the clip-loss and answer-feedback pop-ups placed on the crowd.

**Acceptance criteria:**
- [x] Browser check at 390×844 with `?3d`: a crate full, damaged, flashing and bursting; recruits running in; a saw mid-sweep; a pack before and under fire; a clip pop-up; right and wrong answer feedback. Screenshots in the scratchpad.
- [x] Every 2D run element has a 3D form (checked against `renderRun` in `render.ts`).
- [x] Frame time logged with a full crowd, a pack and a crate on screen.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T2
**Files:** `src/game/three/{scene3d,overlay,figures,world}.ts`
**Scope:** M

### Task T3b: Depth haze and flatter camera (owner feedback at H1)
**Owner, 2026-11-12:** "all objects are appearing too late, rather than 'fading in'. I think our angle is a bit too steep too." 3D also feels faster than 2D. Spec: `docs/specs/SPEC-3d-depth.md` (v1.4.1). Intent: `docs/intent/3d-depth.md`.

**Description:**
- Two horizons: solid objects (walls, panes, crates, saws, packs, squads) drawn up to `SHAPE_DISTANCE` (start at 2 × `VIEW_DISTANCE`); overlay text (prompts, labels, counts) still only inside `VIEW_DISTANCE`, fading in from 0 at `VIEW_DISTANCE` to 1 by 0.9 × `VIEW_DISTANCE`.
- Long distance haze instead of the 0.7–1.0 fog band: near-total at `SHAPE_DISTANCE`, about none by `VIEW_DISTANCE`, no contrast jump.
- Camera lower, flatter and closer: army centre at 66–76% from the top, track at `SHAPE_DISTANCE` at 5–15%, sky at most about 10%. At 390×844, both track edges and both outer openings with labels stay on screen. Fit narrow screens by distance back, height, pitch, then FOV; steeper is the last resort.

**Acceptance criteria:**
- [ ] Tested: haze near-total at `SHAPE_DISTANCE` and near-none at `VIEW_DISTANCE`; overlay alpha 0 at or beyond `VIEW_DISTANCE`, 1 inside 0.9 × `VIEW_DISTANCE`; `SHAPE_DISTANCE` below the minimum re-ask gap (the seeded re-ask "not visible" test extended to `SHAPE_DISTANCE`); aim bands at 390×844 and 1280×800; both track edges and a 3-answer wall's outer openings on screen at 390×844 at the army and at `VIEW_DISTANCE`.
- [ ] Browser check at 390×844 and 1280×800 with `?3d`: a row and a crate at about 1.8×, 1.2×, 1.0× and 0.8× `VIEW_DISTANCE`; a filmstrip of a wall approaching from `SHAPE_DISTANCE`, with no jump; a 3-answer wall near the army; crowds of 5, 40 and 200; 2D and 3D side by side at the same state. Screenshots in the scratchpad.
- [ ] Frame time logged with a full crowd and everything within `SHAPE_DISTANCE` drawn, compared with T3.
- [ ] Camera pitch at 390×844 before and after reported. If the both-sides rule forces it to stay about as steep as now, stop and ask.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T3
**Files:** `src/game/three/{world,view,scene3d,hazards,squads,overlay}.ts`, `src/game/render.ts`, `tests/game/world.test.ts`
**Scope:** M

### Checkpoint H1: the look (owner, on the phone, with `?3d`; moved after T3: hazards must be visible for a playable run; T3b from owner feedback)
- [ ] The camera, track, gates, hazards and crowd feel like a crowd runner; the crowd visibly grows and shrinks.
- [ ] Things appear in the distance and fade in; the camera is closer and less steep; 3D no longer feels faster than 2D (v1.4.1).
- [ ] Camera numbers OK, or the owner says what to change (higher, lower, closer, wider).

### Task T4: The boss at the end of the track
**Description:**
- `world.ts`: boss placement (past the last question, the distance covered in `CLASH_APPROACH_SECONDS` at the final speed), tested.
- The boss crowd (factory figures, larger) on the track, coming into view through the fog, its count above it (spec Open Question 1 default). Boss size computed once per run with `bossSize(plannedRows(run), charges, seed)`.
- During the `boss` scene: no clear and no "BOSS" title; the camera keeps moving until the fronts meet, then the clash removes figures per `clashAt` with sparks at the front; the result banner over the scene; then the end screen as now.

**Acceptance criteria:**
- [ ] Boss placement tested; boss size unchanged from the 2D version for the same seed (tested).
- [ ] Browser check at 390×844 with `?3d`: the last wall with the boss behind it, the run → boss switch (frames just before and after look continuous), mid-clash, each result banner. Screenshots in the scratchpad.
- [ ] Scenes, timings and records unchanged (existing scene tests pass unchanged).

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T3
**Files:** `src/game/three/{scene3d,world,overlay}.ts`, `src/game/render.ts`, `tests/game/world.test.ts`
**Scope:** M

### Task T5: 3D by default
**Description:** Make 3D the default for the run and boss; `?2d` forces the old renderer; fall back to 2D when WebGL fails. Fix rough edges from T1–T4 reviews. Final performance pass on a phone-sized viewport (DPR cap, no per-frame allocations).

**Acceptance criteria:**
- [ ] Default is 3D; `?2d` and a WebGL failure both give the old 2D run (browser check; the failure simulated).
- [ ] Start, end, study, pause, login and token screens unchanged (browser check).
- [ ] A full run from start to end screen in 3D at 390×844 (screenshots), frame time logged.
- [ ] Deploy green.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T4
**Files:** `src/main.ts`, `src/game/three/*`, `src/game/render.ts`
**Scope:** S

### Checkpoint H: v1.4 (owner, on the phone)
- [ ] A run looks and feels like a crowd runner: figures bob, the crowd swells and thins.
- [ ] The boss feels like the end of the run, not a separate screen.
- [ ] Smooth on the phone with a full crowd.
- [ ] Labels: readable enough, or the owner says what to tune.
