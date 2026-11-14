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

## Task V1: test tiers and a fast check (2026-11-15)

| Metric | Before | After |
|---|---|---|
| `npm test` (fast tier) | 78-98 s | 12.6-16.6 s (10 runs, all pass; 777 run + 3 slow-only skipped = 780) |
| `npm run test:slow` (`SLOW=1`) | 78-98 s | 53 s, 780 of 780 tests (2 runs, all pass), same seed counts as before |
| `npm run check` (test, typecheck, lint, build) | ~130 s | 25.8 s warm caches, 49 s cold (first run, no tsc or eslint cache) |
| `npm run check:fast` (one-file change) | n/a | 18 s |

Pool benchmark (`vitest run`, 3 workers, 3 runs each):

| Setup | Wall time per run |
|---|---|
| threads, isolated files | 38.2, 40.8, 40.8 s |
| forks, isolated files | 42.2, 44.2, 44.8 s |
| threads, `isolate: false` (kept) | 13.1, 13.5, 13.2 s |
| forks, `isolate: false` | 13.4, 22.3, 1 failure (horde timeout under load) |

Most of the gain is `isolate: false` (the modules, incl. 494 KB `kanji.json`, load once per worker, not once per file). Threads was faster or equal in both settings, so it stays.

Slow-tier-only tests (statistical bounds that need the full sample): balance "50% accuracy wins less than 10%" and "80% accuracy wins 40-70%", reask "independent of where the first ask put the answer".

## Task V2: agent loop and tool trial (2026-11-15)

| Metric | Value |
|---|---|
| Edit hook (`scripts/hooks/post-edit.sh`: cached eslint + `vitest related --run`) | 3.1-3.8 s on a typical file (`labels.ts`, `drag.ts`, `render.ts`); 10.8 s on `core/sim.ts` (most tests depend on it); non-.ts files exit in 0.01 s |
| `check:fast`, one-file change (`scripts/check-fast.sh`: related tests, typecheck and lint in parallel) | 18 s before; 5.3 s on `render.ts`, 14.8 s on `core/sim.ts` (worst case, bound by its related tests) |

Tool trial (dev Mac, warm caches unless noted, lines = whole repo):

| Tool | Time | Verdict |
|---|---|---|
| `tsc --noEmit` | 9.5 s cold, 2.9-3.1 s incremental (warm, also after a one-file change) | replaced |
| `tsgo --noEmit` (`@typescript/native-preview` 7.0.0-dev.20260707.2) | 2.5 s no cache, 0.9-1.0 s incremental (3.2x faster than `tsc` incremental, 3.8x cold) | **keep**, pinned exact |
| `eslint --cache .` | 1.3-1.8 s warm, 5.2 s cold | stays |
| `oxlint .` | 0.56 s | **drop** |

- `tsgo`: zero errors on the current code like `tsc`. A deliberate `string`-to-`number` assignment, an unused local and a `noUncheckedIndexedAccess` read gave the same three errors, same positions and codes, on every incremental run. It is a dev preview, so the version is pinned; `typescript` stays for typescript-eslint.
- `oxlint`: also zero errors on the current code, but with its default rules it missed `no-explicit-any` that ESLint (typescript-eslint strict) reports, so the errors differ. In front of a warm ESLint cache it would save about 1 s. Dropped and uninstalled.

## Task V3: dev tools and URL flags removed (2026-11-15)

Lines removed (`git diff --numstat 9567240 HEAD`, before V3 = V2's last commit):

| Area | Added | Removed |
|---|---|---|
| `src` (sandbox 1,061, panels and storage 536, `fps.ts`, sync `saveTuning`, flags) | 74 | 1,839 |
| `tests` (gauntlet, results, camera, horde, fps tests; `wave.ts` helper and `legacy` test added) | 213 | 1,155 |
| `scripts` (`gauntlet-results.ts`) | 0 | 178 |
| `supabase/schema.sql` (`tuning_results`) | 0 | 19 |
| Total | 287 | 3,191 (net -2,904) |

Expected was about -1,500; the gauntlet's tests and the results script were larger than assumed. `src` alone: net -1,765.

- Tests: 726 pass in the slow tier. `npm run check` 28 s.
- Left for V4 (done): the `?2d` check in `main.ts`.
- The `tuning_results` table was never live (the schema block said so); nothing to drop if it was never run. If the owner did run it, it can be dropped.

## After v1 (Task V11)

| Metric | Value |
|---|---|
| (filled in by V11) | |

## Task V4: 2D renderer removed (2026-11-15)

`src/game/render.ts` 1,817 -> 1,089 lines (+29/-757); `src/main.ts` +20/-13 (the `?2d` check gone, WebGL state added). Total `git diff --numstat 4bb5994 HEAD` is in the commit. No test covered only 2D drawing, so none was removed; 726 tests pass.

- Screenshots at 390x844 (run, paused run, boss mid-clash, boss banner, end, start) before and after: pause, end and start are byte-identical. Run and boss differ only in the crowd and crate area, which animate in real time (two shots of the same code differ by the same pixel count and box).
- With WebGL off (`--disable-webgl`), the start screen shows "This device can't run the 3D game" above Play, and tapping Play or pressing Enter does nothing. No exception; three.js logs its own console errors.
- Nothing in `src` reads `location.search`.
