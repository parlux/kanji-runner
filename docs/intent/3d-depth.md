# Intent: 3D depth and camera

Status: confirmed by the owner, 2026-11-12, after an interview at Checkpoint H1. Extends `docs/intent/3d-run.md`. Spec: `docs/specs/SPEC-3d-depth.md`.

## Statement of intent
- **Outcome:** the 3D run looks like the reference crowd runner. You see a long way down the track, and gates, barrels and crowds start as faint far-off shapes that fade in slowly instead of popping in.
- **User:** the owner, playing 3D on the phone.
- **Why now:** 3D feels faster than 2D because the short fog band hides things until about 70% of the view distance, and the steep ~45° camera shows mostly ground instead of distance.
- **Success:** next to 2D, the 3D version no longer feels faster. Shapes can be seen well before they matter, and the kanji becomes readable at the same distance as in 2D. The army looks closer and bigger, with a flatter camera that shows the track running toward the horizon.
- **Constraint:** difficulty doesn't change: the kanji becomes readable at the same distance as in 2D. Both gate sides stay fully on screen on narrow phones, and that rule decides how low the camera can go.
- **Out of scope:** changes to 2D, gameplay or tuning, new art or models, and making 3D easier.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Shapes far, kanji at the 2D distance | Owner: mostly about the look; difficulty stays tied to 2D. |
| Camera closer and bigger, not just tilted | Owner chose it, matching the reference. |
| Both gate sides always visible | Owner: hard rule; it limits how low the camera goes. |
