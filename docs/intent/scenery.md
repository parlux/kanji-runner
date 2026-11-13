# Intent: scenery

Status: confirmed by the owner in chat, 2026-11-13, after seeing the mockups (no interview). Extends `docs/intent/3d-run.md`. Idea: `docs/ideas/done/scenery.md`. Spec: `docs/specs/done/SPEC-scenery.md`.

## Statement of intent
- **Outcome:** the 3D run has a world around it: a gradient sky with things in it, and props beside the road that stream past. There are five looks (Countryside, Spring village, Race day, Cloud road, Block city), and each run picks one at random.
- **User:** the owner, laptop and phone.
- **Why:** the run looks empty (flat sky, bare grass), and nothing passes by to show speed.
- **Success:** each look matches its mockup closely, and runs feel varied. The phone keeps a smooth frame rate.
- **Constraint:** look only. `src/core`, gameplay, timings, the camera and the overlay text don't change, and neither does 2D (`?2d`). Everything is built in code from simple shapes (no downloaded art) and is original, genre-inspired only.
- **Out of scope:** choosing a look in settings, tying looks to levels or stories, scenery reacting to play (cheering, banners), sound, and 2D scenery.

## Decisions (and why)
| Decision | Reason |
|---|---|
| All five looks | Owner: cheap enough, so build them all. |
| Random per run | Owner's choice. Derived from the run's seed, so a run keeps its look through pause and the boss. |
| Shared module first, plus one look, checked on the phone | Proves the frame rate and the look before the other four are built on it. |
