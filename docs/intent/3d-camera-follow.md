# Intent: flatter 3D camera that follows the army

Status: confirmed by the owner, 2026-11-13, after an interview. Idea: `docs/ideas/3d-camera-follow.md`. Extends `docs/intent/3d-depth.md`. Spec: `docs/specs/SPEC-3d-depth.md` (amendment v1.4.3).

## Statement of intent
- **Outcome:** a dev settings screen (gear on the start screen, saved on the device) with live sliders for the 3D camera: pitch, distance, FOV, sideways follow (0 = off, centred) and follow smoothing. The owner uses it to find a flatter, closer camera that feels like running with the crowd.
- **User:** the owner, tuning on the phone during real runs.
- **Why now:** at H1 the 28.7° camera still felt like "watching from above". Feel beats seeing every answer, but only testing will tell.
- **Success:** the owner finds settings that feel right on the phone; they become the new 3D defaults.
- **Constraint:** the "both track edges and outer openings stay on screen" rule is dropped for tuned settings. Today's camera stays the default until the owner picks. 2D and `src/core` untouched.
- **Out of scope (for now):** a polished player-facing settings page; fixes for answers that end up off screen (decided after testing); the boss-fight camera; other settings.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Test on the phone, not pick numbers on paper | Owner: "the only way to know is to test". |
| In-game settings screen, not URL params | Owner: URL params are annoying on the phone. |
| Dev tool first, player preset maybe later | Owner accepted; no polished settings page yet. |
| Follow built in from the start, as a slider (0 = off) | Angle and follow interact: a flatter angle without follow loses the outer openings ~1.4 s before the gate, so judging the angle alone would be unfair. Partial follow (~0.5–0.7) keeps steering visible on screen. |
