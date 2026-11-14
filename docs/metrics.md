# Metrics

Check and code-size numbers, measured on the dev Mac (4-core Intel i5-5257U, 2015). Re-measure after a round that targets speed or size. Commands: `time` on each step, plus `npx vitest run --reporter=json --outputFile=…` for the time per file.

## Baseline: 2026-11-15, main @ b2a9272 (before v1 clean-up)

| Metric | Value |
|---|---|
| `npm test` wall time | 98 s (summed test time 230 s; 59 files, 780 tests) |
| Flaky | 1 of 2 runs failed: `vitest-worker` timeout calling `onTaskUpdate` |
| `tsc --noEmit` | 14 s |
| `eslint .` (no cache) | 8 s |
| `vite build` | 7.5 s |
| Full check (`test && lint && build`; `build` runs tsc again) | ~130 s |
| Source / tests | 16,153 / 12,829 lines |
| Files over 600 lines | `game/render.ts` 1,818 · `three/world.ts` 1,015 · `core/sim.ts` 1,013 · `three/scenery.ts` 821 |
| Active task list | `tasks/done/todo-hordes.md` 8,345 words |
| Bundle | `render` chunk 620 KB (incl. 494 KB `kanji.json`), `scene3d` 600 KB |

Slowest test files: `core/balance` 67.5 s · `core/sim-reask` 31.5 s · `core/distractors` 28.4 s · `core/reask` 12.3 s · `game/horde` 6.2 s · `core/gates` 5.9 s · `core/squad` 4.8 s.

Slowest tests:
- `sim-reask` "a miss at question q is asked again 3–5 rows later": 17.3 s
- `distractors` gloss property: 13.3 s
- `balance` "skill 0.5 wins at least half": 12.5 s
- `distractors` reading property: 12.3 s

## After v1 (Task V11)

| Metric | Value |
|---|---|
| (filled in by V11) | |
