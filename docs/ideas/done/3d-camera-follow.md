# Idea: flatter 3D camera that follows the army sideways

Owner, 2026-11-13, at Checkpoint H1: "I think we can lower the camera angle a bit more, even if it cuts things off." Deferred until the 3D round (incl. the boss, T4) is done.

## The constraint today
SPEC-3d-depth hard rule: at 390×844 both track edges at the army, and a 3-answer gate's outer openings with labels, stay on screen until the gate reaches the army. The camera is centred and does not follow steering. Army at 80%, far line at 10%.

## Numbers at 390×844 (computed 2026-11-13, camera slope from the army)
| Pitch | Keep the rule (camera moves back, zooms) | Drop it (camera stays close) |
|---|---|---|
| 28.7° (now) | FOV 33°, 32 back | ~60% of the road visible at the army; outer openings leave the screen 1.3 track (~0.8 s) before the gate |
| ~24° | FOV 20°, 56 back (telephoto, flattened depth) | outer openings leave 2.2 before (~1.4 s) |
| ~21° | FOV 13°, 89 back | outer openings never on screen near the army |

## Direction
Drop the rule for a flatter, closer camera, and have the camera follow the army sideways (genre norm) so the opening you steer into stays in view while the far side is cut off. Needs an interview first: how far it follows, how flat, what happens to the far answers.

## Interview, 2026-11-13
Done: `docs/intent/3d-camera-follow.md`. Tasks C1, H2, C2 in `tasks/done/todo-3d.md` (Phase 11). Test-first: an in-game camera settings screen with sliders (incl. follow), tuned on the phone.
