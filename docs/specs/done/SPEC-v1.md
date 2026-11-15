# SPEC: v1 clean-up and release

Owner decisions, 2026-11-15. Tasks: `tasks/done/todo-v1.md`. Baseline: `docs/metrics.md`.

## Goal
Make what exists today v1.0.0 with less code and much faster checks, so later rounds are quicker. **The game plays exactly as it does today.**

## Why
Each round got slower. Measured causes (2026-11-15, 4-core 2015 i5):
- The full check (`npm test && npm run lint && npm run build`) takes about 130 s and runs on every slice, about 13 min per task. `build` runs `tsc` a second time.
- 4 of 59 test files (`balance`, `sim-reask`, `distractors`, `reask`) take 140 s of the 230 s total test time. They are seed sweeps and balance bots.
- 1 of 2 full runs failed on a `vitest-worker` RPC timeout (CPU starvation).
- A cold subagent reads about 12k words of task list and spec before starting.
- Four files are over 600 lines: `game/render.ts` 1,818, `three/world.ts` 1,015, `core/sim.ts` 1,013, `three/scenery.ts` 821.

## Owner decisions
- **Open rounds:** accept Checkpoints M (hordes v1.10), E (summary v1.9) and K (meaning mode v1.7) as they are, and archive them. Play-test feedback becomes v1.1 ideas in `docs/ideas/`.
- **2D renderer:** remove it. 3D only. When WebGL fails, show a clear message on the start screen. Menus and the end screen stay on the 2D canvas.
- **Dev tools:** remove the horde sandbox (`?sandbox=horde`, `game/sandbox/*`, `scripts/gauntlet-results.ts`) and both slider panels (`hordesettings.ts`, `camerasettings.ts`, the gear button and their saved overrides). The defaults in code are the final values. Values saved on phones are dropped.
- **URL flags:** remove all of them (`?2d`, `?3d`, `?sandbox`, `?fps`, `?level=`, `?scenery=`). None affects gameplay. Nothing in `src` reads `location.search`.
- **Extras:**
  - knip and dependency-cruiser in CI.
  - Claude Code edit hooks.
  - A trial of `tsgo` and `oxlint`, adopted only if at least 2× faster with the same results.
  - Delete merged branches and worktrees. Unmerged ones are listed for the owner, not deleted.

## Rules for every task
- No behaviour change. The golden snapshot and the balance numbers stay unchanged. A task that changes either has gone out of scope.
- From V1 on: `npm run check:fast` per slice, `npm run check` before the task is ticked, `npm run test:slow` only on tasks that touch `core/` simulation or balance.
- Each tick line logs the task's numbers (times, lines removed or remaining).

## Layers (enforced from V6)
- `core/`: pure game logic and data. It imports only `core/` and `data/`.
- `storage/`, `sync/`, `wanikani/`: persistence and network. They may import `core/` types.
- `game/` (canvas, DOM UI, input) and `game/three/` (WebGL): presentation. Nothing in `core/` or `storage/` imports them.
- No import cycles.

## Targets
| Metric | Baseline | Target |
|---|---|---|
| `npm test` (fast tier) | 98 s | ≤ 20 s |
| `npm run check` (full) | ~130 s | ≤ 40 s |
| `check:fast` per slice | ~130 s | ≤ 15 s |
| Flaky runs | 1 of 2 | 0 of 10 |
| `tsc` | 14 s | ≤ 7 s |
| `eslint` | 8 s | ≤ 2 s cached |
| Source lines (`src/**/*.ts`) | 16.2k | ~13k |
| Files over 600 lines | 4 | 0 |
| knip issues / layer violations | not checked | 0, in CI |
| Words a subagent reads first | ~12k | ≤ 4k |
| Release | untagged, 0.0.0 | v1.0.0 |

## Out of scope
New features, balance changes, visual changes, and the play-test feedback on M, E and K (that goes to v1.1).
