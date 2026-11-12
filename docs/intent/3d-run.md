# Intent: 3D run

Status: confirmed by the owner, 2026-11-12, after an interview. Extends `docs/intent/kanji-runner.md`. Spec: `docs/specs/SPEC-3d.md`, tasks: `tasks/todo-3d.md`.

## Statement of intent
- **Outcome:** the run becomes one continuous 3D scene: a low, dramatic camera behind a crowd of low-poly figures running down a track. Gates, crates, enemies and saws are 3D. The boss stands at the end of the track and the army runs straight into it; no separate boss scene.
- **User:** the owner, laptop first, phone second.
- **Why:** the flat dots-on-dark look feels fake. The snowball rush comes from seeing a real crowd grow.
- **Success:** a run looks and feels like a crowd runner: figures bob as they run, the crowd visibly swells and shrinks, and the boss clash reads as the climax of the run.
- **Constraint:** gameplay rules in `src/core` stay unchanged; only rendering changes. Figures are built in code, behind one factory, so downloaded models can replace them later. Genre-inspired only: no copying of any existing game's art or name.
- **Out of scope (this round):** 3D for the start, end and study screens (they stay 2D). Downloaded or animated models. Label readability tuning, unless playtesting shows a problem.

## Decisions (and why)
| Decision | Reason |
|---|---|
| 3D back in scope | Owner, 2026-11-12: the look is the point of this round. |
| Run and boss in 3D, menus stay 2D | Menus are text; 3D adds nothing there. |
| Boss is the end of the track | Owner: the clash should feel like the end of the run, not a separate thing. |
| Low-poly figures built in code first | No asset pipeline; figures are tiny on screen; no licensing or likeness risk. Better art is a later round. |
| Low dramatic camera; look beats readability | Owner chose it. Labels shrink with distance like real 3D; readability is adjusted later if it becomes a problem. |
