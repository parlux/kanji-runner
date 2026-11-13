# Tasks: 3D run (v1.4)

Spec: `docs/specs/done/SPEC-3d.md` (2026-11-12). Intent: `docs/intent/3d-run.md`. Idea: `docs/ideas/done/3d-run.md`. Starts after v1.3 (runs alongside the owner's Checkpoint G playtest).
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
**Owner, 2026-11-12:** "all objects are appearing too late, rather than 'fading in'. I think our angle is a bit too steep too." 3D also feels faster than 2D. Spec: `docs/specs/done/SPEC-3d-depth.md` (v1.4.1). Intent: `docs/intent/3d-depth.md`.

**Description:**
- Two horizons: solid objects (walls, panes, crates, saws, packs, squads) drawn up to `SHAPE_DISTANCE` (start at 2 × `VIEW_DISTANCE`); overlay text (prompts, labels, counts) still only inside `VIEW_DISTANCE`, fading in from 0 at `VIEW_DISTANCE` to 1 by 0.9 × `VIEW_DISTANCE`.
- Long distance haze instead of the 0.7–1.0 fog band: near-total at `SHAPE_DISTANCE`, about none by `VIEW_DISTANCE`, no contrast jump.
- Camera lower, flatter and closer: army centre at 66–76% from the top, track at `SHAPE_DISTANCE` at 5–15%, sky at most about 10%. At 390×844, both track edges and both outer openings with labels stay on screen. Fit narrow screens by distance back, height, pitch, then FOV; steeper is the last resort.

**Acceptance criteria:**
- [x] Tested: haze near-total at `SHAPE_DISTANCE` and near-none at `VIEW_DISTANCE`; overlay alpha 0 at or beyond `VIEW_DISTANCE`, 1 inside 0.9 × `VIEW_DISTANCE`; `SHAPE_DISTANCE` below the minimum re-ask gap (the seeded re-ask "not visible" test extended to `SHAPE_DISTANCE`); aim bands at 390×844 and 1280×800; both track edges and a 3-answer wall's outer openings on screen at 390×844 at the army and at `VIEW_DISTANCE`.
- [x] Browser check at 390×844 and 1280×800 with `?3d`: a row and a crate at about 1.8×, 1.2×, 1.0× and 0.8× `VIEW_DISTANCE`; a filmstrip of a wall approaching from `SHAPE_DISTANCE`, with no jump; a 3-answer wall near the army; crowds of 5, 40 and 200; 2D and 3D side by side at the same state. Screenshots in the scratchpad.
- [x] Frame time logged with a full crowd and everything within `SHAPE_DISTANCE` drawn, compared with T3.
  - Headless (software GL), 200 crowd, two 3-answer walls, three crates, a saw and two packs: CPU 0.70 → 0.95 ms per frame at 390×844 (T3 drew only what was within `VIEW_DISTANCE`), 0.92 → 1.0 ms at 1280×800; the T3 test scene alone is unchanged at 0.43 ms.
- [x] Camera pitch at 390×844 before and after reported. If the both-sides rule forces it to stay about as steep as now, stop and ask.
  - 390×844: pitch 40.7° → 28.7° (army seen 58.2° → 36.9° down); camera 19.4 up / 12 back → 20.9 up / 27.9 back, FOV 55.6° → 37.8°. 1280×800: 29.7° → 25.7°, 12 / 12 → 6 / 8, army about 1.6× wider. On a phone the army's width is pinned by the both-edges rule, so it is not bigger there.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T3
**Files:** `src/game/three/{world,view,scene3d,hazards,squads,overlay}.ts`, `src/game/render.ts`, `tests/game/world.test.ts`
**Scope:** M

### Task T3c: Text hazed in with its object (owner feedback, 2026-11-13)
**Owner:** "The gates show up visually at the right time, but without the text, then the text just 'appears'. Can we add the text as soon as the gate appears, even if it's too small/blurry to read?" Intent: `docs/intent/3d-depth.md` (amendment 2026-11-13). Drops SPEC-3d-depth's "no overlay text beyond `VIEW_DISTANCE`": 3D may be easier than 2D.

**Description:**
- All 3D overlay text (gate prompts and answer labels, crate hit points and `+N`, squad, pack and crowd counts) shows from `SHAPE_DISTANCE`, hazed exactly like its object: drawn opaque, fill and outline mixed toward the haze colour by `hazeAt` at the object's view depth (the same factor Three.js fog gives the object), instead of `textAlpha`'s fade over the last tenth before `VIEW_DISTANCE`. Remove `textAlpha`/`TEXT_FADE_END` if unused.
- A gate's prompt and its labels share one haze factor (they appear together).
- Size stays proportional to the object (painted-on). Crate text's 14 px minimum never makes far crate text larger than the crate (e.g. cap by the crate's projected height).
- Unchanged: `SHAPE_DISTANCE`, the haze curve, the camera, re-ask safety (rows never swapped within `SHAPE_DISTANCE`), passed walls' label fade-out, merge/shown fades of squads, 2D.

**Acceptance criteria:**
- [x] Tested: overlay text haze equals the object's haze at the same point (near `SHAPE_DISTANCE`, at `VIEW_DISTANCE`, near the army); text is drawn (not culled) between `VIEW_DISTANCE` and `SHAPE_DISTANCE`.
- [x] A gate's prompt and labels use one haze factor (tested or evident in code).
- [x] Browser check at 390×844 with `?3d`: a filmstrip of a gate and a crate approaching from `SHAPE_DISTANCE` (about 1.9×, 1.5×, 1.2×, 1.0×, 0.8× `VIEW_DISTANCE`): whenever the object is visible its text is too, hazy far off, with no frame where text jumps in. Screenshots in the scratchpad.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T3b
**Files:** `src/game/three/{overlay,world}.ts`, `src/game/labels.ts`, `tests/game/world.test.ts`, `docs/specs/done/SPEC-3d-depth.md`
**Scope:** S

### Task T3d: Wider crowd that squeezes, army lower (owner feedback at H1, 2026-11-13)
**Owner:** "The army sits a bit too far up the screen. If that's a limitation fine." / "The army only grows in size within a 'lane' rather than spreading across the road when big … mostly centered but taking up closer to 2/3s of the entire road." Intent: `docs/intent/3d-depth.md` (amendment 2). Look-only: the sim's `crowdWidth` (≤ 0.3) stays the collision width.

**Description:**
- **Spread:** on open road the drawn crowd is wider than `crowdWidth`: a pure `spreadWidth(army)` in `world.ts`, same √ shape, about 0.10 of the track for a handful, ~0.35 at 40, ~0.55 at 150–200 (`MAX_DRAWN_SOLDIERS`), centred on `run.x`, kept on the track (figures never past the edges).
- **Squeeze:** as anything that can clip the army comes near (a wall row, saw, crate, pack, squad charge), the drawn width eases smoothly to `crowdWidth(army)` so that at contact the crowd seen is exactly the crowd the sim clips; it eases back out once clear. Pure and tested (e.g. `drawnWidth(army, nearestObstacleAhead/behind)`), no popping: width is continuous in distance.
- **Army lower:** army centre at about 80% of the screen height (`AIM.armyY`), **without changing the camera pitch** at 390×844 or 1280×800 (move the camera closer/lower or change FOV only). The hard rule stays: at 390×844 both track edges and a 3-answer wall's outer openings with labels stay on screen. If the rule stops it short of 80%, go as low as it allows and report the number.
- Unchanged: `src/core`, `crowdWidth`, clipping, balance, golden run, haze, `SHAPE_DISTANCE`, text (T3c), 2D.

**Acceptance criteria:**
- [x] Tested: `spreadWidth` at 5, 40, 200; drawn width equals `crowdWidth` at contact with each obstacle kind and is continuous as an obstacle approaches and passes; layout footprint within the drawn width and on the track.
- [x] Tested: pitch at 390×844 and 1280×800 unchanged from T3b (28.7°, 25.7°); army centre ≈ 80% (or the lowest the hard rule allows, reported); hard rule still holds.
- [x] Browser check at 390×844 with `?3d`: crowds of 5, 40 and 200 on open road; a 200 crowd squeezing through a gate (filmstrip) and past a saw and a crate; the army's screen position before and after. Screenshots in the scratchpad.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T3c
**Files:** `src/game/three/{world,view,squads,scene3d}.ts` (crowd code), `tests/game/world.test.ts`
**Scope:** M

### Task T3e: Steady crowd width, straight fire at gates (owner feedback at H1, 2026-11-13)
**Owner:** "the army width 'pulses' even without an obstacle. It should stay 'wide' until it approaches an obstacle that requires narrowing." / "get rid of the strange shooting at gates where the bullets hit the edge of the gates rather than shooting straight ahead."

**Cause:** `clipGaps` (`world.ts`) counts every wall and hazard on the track, including crates/saws/packs in another lane and ones already shot down, so with hazards every 3.0 the crowd is fully spread only ~1.3 of each gap. In `squads.ts` the fire at a gate splits onto the opening's two edges; 2D fires straight ahead and stops at the wall.

**Description:**
- **Squeeze only for what would hit:** walls and squad charges always count. Crates, saws and packs count only while still standing and while their span (at their position when the crowd reaches them, e.g. a saw's sweep) overlaps the crowd's spread span. Otherwise the crowd stays wide.
- **No snaps:** the spread share eases over time (or is otherwise continuous), so a crate shattering, a pack dying or the player steering away/into a hazard never jumps the width. At contact with anything that clips, the drawn width is still exactly `crowdWidth`.
- **Straight fire at gates:** while shooting a gate, tracers go straight ahead from the crowd's lanes and stop at the wall's face, like 2D. Keep the opening's glowing edges (they show the widening). Crate/pack/squad fire unchanged.
- Unchanged: `src/core`, the width curve, the camera, text.

**Acceptance criteria:**
- [x] Tested: a crate, saw and pack in another lane, or shot down, don't squeeze the crowd; one in its path does; walls always do; width stays continuous when a hazard is destroyed mid-squeeze and when steering across one.
- [x] Browser check at 390×844 with `?3d`: a 200 crowd running past an off-lane crate and saw stays wide (filmstrip); fire at a gate goes straight ahead and stops at the wall. Screenshots in the scratchpad.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T3d
**Files:** `src/game/three/{world,scene3d,squads}.ts`, `tests/game/world.test.ts`
**Scope:** S

### Checkpoint H1: the look (owner, on the phone, with `?3d`; moved after T3: hazards must be visible for a playable run; T3b–T3e from owner feedback)
- [x] The camera, track, gates, hazards and crowd feel like a crowd runner; the crowd visibly grows and shrinks.
- [x] Things appear in the distance and fade in; the camera is closer and less steep; 3D no longer feels faster than 2D (v1.4.1).
- [x] Gate and crate text comes out of the haze with its object, never popping in (T3c).
- [x] A big army spreads across most of the road and squeezes through gates and past hazards; the army sits lower on the screen (T3d).
- [x] The crowd stays wide on open road, no pulsing; fire at gates goes straight ahead (T3e).
- [x] Camera numbers OK, or the owner says what to change (higher, lower, closer, wider).
  - Owner, 2026-11-13: OK for now; a flatter camera that follows the army comes after the boss (`docs/ideas/done/3d-camera-follow.md`).

### Task T4: A giant boss at the end of the track
**Owner, 2026-11-13:** "Can we turn the boss crowd into a big single boss with more hitpoints (matching crowd size I suppose). Like a big scary boss." Confirmed intent: `docs/intent/3d-run.md` (amendment 2026-11-13); spec: SPEC-3d "Boss at the end of the track" (amended).

**Description:**
- `world.ts`: boss placement (past the last question, the distance covered in `CLASH_APPROACH_SECONDS` at the final speed), tested; the army's firing stop distance in front of it.
- **One giant boss** from the figure factory (`figures.ts`): the enemy figure in the same low-poly, flat-shaded style and enemy red, about 5–6× a soldier's height, with a big gun / arm cannon. Fixed size (not scaled by HP). It stands on the track and comes into view through the haze like anything else.
- **HP** = `bossSize(plannedRows(run), charges, seed)`, computed once per run (value unchanged). Shown above its head as a big number plus a draining bar (overlay, hazed like its object).
- **Gunfight, no charge:** during the `boss` scene (no clear, no "BOSS" title in 3D) the camera and army keep moving until the army reaches firing range, then stop. The crowd fires at the boss; the boss fires back into the crowd. Per `clashAt`, each soldier lost takes 1 HP, over `CLASH_SECONDS`: soldiers drop out of the crowd, sparks/hits on the boss, the bar and number drain.
- **Ending:** Victory → the boss topples; Defeated → it stomps forward over where the army stood; Tie → it stays standing. Then the result banner over the scene and the end screen as now.
- Unchanged: `src/core` (`bossSize`, `clashAt`, timings), results, records, the golden run, the camera, the 2D boss (still a crowd). Boss swings/attacks are later.

**Acceptance criteria:**
- [x] Tested: boss placement and the firing stop; HP equals the 2D boss size for the same seed; HP and army shown per `clashAt` through the fight.
- [x] Browser check at 390×844 with `?3d`: the last wall with the boss behind it in the haze; the run → boss switch (frames just before and after look continuous); the gunfight start and mid-fight; each ending (topple, stomp, standing) with its banner. Screenshots in the scratchpad. Frame time logged mid-fight with a full crowd.
- [x] Scenes, timings and records unchanged (existing scene tests pass unchanged).

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T3e
**Files:** `src/game/three/{scene3d,world,figures,overlay,fx}.ts` (a new `boss.ts` if cleaner), `src/game/render.ts`, `tests/game/world.test.ts`
**Scope:** M

### Task T5: 3D by default
**Description:** Make 3D the default for the run and boss; `?2d` forces the old renderer; fall back to 2D when WebGL fails. Fix rough edges from T1–T4 reviews. Final performance pass on a phone-sized viewport (DPR cap, no per-frame allocations).

**Acceptance criteria:**
- [x] Default is 3D; `?2d` and a WebGL failure both give the old 2D run (browser check; the failure simulated).
- [x] Start, end, study, pause, login and token screens unchanged (browser check).
- [x] A full run from start to end screen in 3D at 390×844 (screenshots), frame time logged.
- [x] Deploy green.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T4
**Files:** `src/main.ts`, `src/game/three/*`, `src/game/render.ts`
**Scope:** S

### Task T5b: Steer during the boss fight (owner feedback at H, 2026-11-13)
**Owner:** "Should still be able to move when fighting the boss (even though it doesn't do anything)."

**Description:**
- During the `boss` scene, steering (keys, drag) moves the army left and right exactly as in the run (same speed, easing and track clamp), from the approach through the fight and the ending hold. Today input is ignored there (`main.ts` returns early for `boss`; `stepBoss` in `scenes.ts` never moves `run.x`).
- Look-only: no effect on the clash result, `clashAt`, timings, records or `src/core`. A tap during the boss still does nothing (no pause), as now.
- 3D: the crowd, its count and its fire follow the army; the boss's cannon fire aims at where the crowd is now. 2D (`?2d`): the army moves too if the 2D boss scene draws it at `run.x`; otherwise leave 2D as is and say so.

**Acceptance criteria:**
- [x] Tested: in the boss scene, steering moves `run.x` as in the run (and is clamped); the clash result and timings are unchanged for the same inputs.
- [x] Browser check at 390×844: the army steered to the left and to the right mid-fight, the boss's fire following it. Screenshots in the scratchpad.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T5
**Files:** `src/main.ts`, `src/game/scenes.ts`, `src/game/three/{boss,scene3d}.ts`, tests
**Scope:** S

### Checkpoint H: v1.4 (owner, on the phone)
- [x] A run looks and feels like a crowd runner: figures bob, the crowd swells and thins.
- [x] The boss feels like the end of the run, not a separate screen; the giant boss looks big and scary.
- [x] Smooth on the phone with a full crowd.
- [x] Labels: readable enough, or the owner says what to tune.
  - Owner, 2026-11-13: very readable with the camera changes; camera still being finalised (`docs/ideas/done/3d-camera-follow.md`).
- [x] The army can steer during the boss fight (T5b).

## Phase 11: camera tuning (independent of T4; worktree `camera`)
Intent: `docs/intent/3d-camera-follow.md`. Spec: SPEC-3d-depth amendment v1.4.3, "Camera tuning". Idea: `docs/ideas/done/3d-camera-follow.md`. Runs alongside T4; both touch `view.ts`/`scene3d.ts`, so merge main before starting and before the checkpoint.

### Task C1: Camera settings screen with live sliders and sideways follow
**Description:**
- **Settings (pure):** a `CameraSettings` type (pitch, distance, FOV, follow, smoothing) and a pose built from it around the army in `world.ts`/`view.ts`. No saved settings → today's fitted pose, unchanged. A function that expresses today's pose for an aspect as settings (the screen's starting values).
- **Follow (pure):** target x = `follow × worldX(run.x)`; an easing step `(current, target, dt, smoothing)` that is continuous and framerate-independent. Camera and look point shift together. Run scene only; eases back to centre in the boss scene. The overlay projects with the same camera.
- **Storage:** load/save in `localStorage` with validation (out-of-range or bad data → defaults), like `loadSpeed`/`saveSpeed`.
- **Screen:** a DOM panel styled like the pause card: sliders for pitch, distance, FOV, follow and smoothing with their values; Reset; Close. Opens from a gear on the start screen (clear of the speed pill) and from the pause card. Changes apply live (visible behind the panel mid-run) and are saved.
- Unchanged: `src/core`, golden run, haze, `SHAPE_DISTANCE`, text rules, 2D.

**Acceptance criteria:**
- [x] Tested: no saved settings → pose identical to today's at 390×844 and 1280×800 (existing aim/hard-rule tests pass unchanged); today's pose → settings → pose round trip; follow 0 keeps x = 0; follow 1 settles on the army's x; the easing is continuous and the same at 30 and 60 fps; storage round trip and bad-data fallback.
- [x] Browser check at 390×844 with `?3d`: the gear on the start screen and the pause card opens the panel; a run at today's camera, at pitch ~20° with follow 0, and at pitch ~20° with follow 0.6 while steering to an outer opening (filmstrips); labels stay on their gates with follow on; Reset restores today's camera; settings survive a reload. Screenshots in the scratchpad.
- [x] Frame time unchanged (logged with a 200 crowd).

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green.
**Dependencies:** T3e
**Files:** `src/game/three/{world,view,scene3d}.ts`, a new `src/game/camerasettings.ts` (panel + storage), `src/game/{start,pausecard}.ts`, `src/main.ts`, `tests/game/world.test.ts` (+ a storage test)
**Scope:** M

### Checkpoint H2: the camera (owner, on the phone, with `?3d`)
- [x] The settings screen works mid-run and settings stick.
- [x] The owner picks values that feel right (reports pitch, distance, FOV, follow, smoothing) and says what to do about answers that leave the screen, if anything.
  - Owner, 2026-11-13: pitch 8°, distance 15, FOV 34°, follow 0.4, smoothing 1 s; fog too thick; off-screen answers fine; keep the gear hidden. (Becomes C2.)
  - Owner, 2026-11-13, after C2 on the phone: "All looks good." Phase 11 done.

### Task C2: Bake in the chosen camera, longer haze, hidden gear
**Owner, 2026-11-13, at H2:** best feel with pitch 8°, distance 15, FOV 34°, follow 0.4, smoothing 1 s. "The fog feels too 'thick' like this." Keep the gear hidden; off-screen answers are fine.
**Cause of the thick fog:** at pitch 8° the haze band (3 → 6 ahead) is squeezed into 7% of the screen (45% → 38% from the top), and the track beyond 6 is solid haze up to the horizon at 27%.

**Description:**
- **Defaults:** the owner's values are the 3D camera at every aspect (no saved settings → `poseFromSettings` of them, army at `AIM.armyY`). The old fitted camera (`fitCameraTo`, `CAMERA_BACK`, `CAMERA_MIN_HEIGHT`, `EDGE_MARGIN`) goes if nothing else needs it; the hard rule and aim-band tests are replaced (spec below). Reset returns to the owner's values.
- **Wider ranges:** pitch from 3°, smoothing up to 2 s; distance slider in absolute units around the new default (about 6–60).
- **Longer haze:** `SHAPE_DISTANCE` raised to about 4 × `VIEW_DISTANCE` (12) as the default, kept below the re-ask gap (the existing test still pins it). Haze clear up to `VIEW_DISTANCE`, total at `SHAPE_DISTANCE`, as now. Check the culling, text haze and squads still follow `SHAPE_DISTANCE`, and the frame time with more drawn.
- **Haze slider:** a sixth setting, "haze" = the shape horizon in track distance (range `VIEW_DISTANCE` + 1 to the re-ask safe maximum), saved and reset with the others. If making it live is invasive (objects culled by a constant), stop and report instead.
- **Hidden gear:** the gear is not shown by default. Tapping the build stamp at the bottom of the start screen 5 times within 3 s toggles it on/off, remembered on the device. When shown, it works as in C1.
- Unchanged: `src/core`, golden run, 2D, text rules, follow maths.

**Acceptance criteria:**
- [x] Tested: default pose = the owner's settings at 390×844 and 1280×800 (army at 80%); `SHAPE_DISTANCE` default below the re-ask gap and the haze slider's maximum too; haze total at the horizon in use and none at `VIEW_DISTANCE`; storage accepts the wider ranges and the haze setting, old saved data without it still loads; gear toggle remembered.
- [x] Browser check at 390×844 (3D default): a run with the defaults (filmstrip of a gate approaching from far off, showing a gradual haze, no thick band); steering to an outer opening with follow; the gear hidden, then shown after 5 taps; the haze slider at its ends. Screenshots in the scratchpad.
- [x] Frame time logged with a 200 crowd and everything within the new `SHAPE_DISTANCE` drawn, compared with C1.

**Verification:** `npm test && npm run lint && npm run build`; browser check; deploy green (merge into `main`).
**Dependencies:** C1, H2
**Files:** `src/game/three/{world,view,scene3d,walls,hazards,squads,overlay}.ts`, `src/game/camerasettings.ts`, `src/storage/camera.ts`, `src/game/start.ts`, `src/main.ts`, tests
**Scope:** M
