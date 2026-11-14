# Tasks: v1 clean-up and release (v1.0.0)

Spec: `docs/specs/SPEC-v1.md` (2026-11-15, owner decisions). Baseline: `docs/metrics.md`. Started 2026-11-15 (owner go).
**No behaviour change:** the golden snapshot and balance numbers stay unchanged in every task.
Checks:
- Until V1 lands, use `npm test && npm run lint && npm run build`.
- After V1: `npm run check:fast` per slice and `npm run check` before ticking. Run `npm run test:slow` too when a task touches `core/` simulation or balance.

## Phase 0: Close the open rounds (orchestrator, no subagent)

### Task V0: Tick, archive, tidy
**Description:**
- Tick Checkpoints M (`todo-hordes.md`), E (`todo-summary.md`) and K (`todo-meaning-mode.md`) with "owner accepted as-is for v1, 2026-11-15".
- `git mv` those three task lists, their specs (`SPEC-hordes`, `SPEC-summary`, `SPEC-meaning-mode`) and ideas (`hordes`, `horde-sandbox`, `summary-screen`, `kanji-meaning-mode`) into `done/`, and fix the links.
- Update `AGENTS.md`: drop the per-round history from the workflow bullet.
- Check each branch and worktree (`camera`, `pause-show-last-prompt-and-answer`, `summary-screen`, `worktree-kana-words`, the `worktree/*` ones, `.herdr/worktrees/…`) with `git branch --merged main` and `git worktree list`. Delete the merged ones, local and remote. List the unmerged ones for the owner; don't delete them.

**Acceptance criteria:**
- [x] The top level of `tasks/` holds only `todo-v1.md` and `subagent-prompt.md`. The top level of `docs/specs/` holds only `SPEC-v1.md`.
- [x] No broken links to the moved files (`grep` for the old paths).
- [x] Only `main` and the reported unmerged branches remain.
  - Merged branches, local and remote, and the `summary-screen` worktree removed. `pause-show-last-prompt-and-answer` (unmerged) deleted at the owner's request, 2026-11-15. Only `main` is left.

**Scope:** S

## Phase 1: Fast checks

### Task V1: Test tiers and a fast check
**Description:**
- Add a test helper `forSeeds(n)`, or a `SWEEP` constant, read from `process.env.SLOW`. The fast tier uses about 20 seeds and sampled kanji. `SLOW=1` uses today's exact sweeps.
- Move the sweeps in `balance`, `sim-reask`, `distractors` and `reask` (and any other test over 2 s) onto it. Assertions and bounds stay the same; if a statistical bound needs the full sample, that test runs only in the slow tier.
- `package.json` scripts:
  - `test`: fast tier.
  - `test:slow`: `SLOW=1 vitest run`.
  - `typecheck`: `tsc --noEmit --incremental` (V2 moved it to `tsgo`), with the build-info file gitignored.
  - `lint`: `eslint --cache . && prettier --check --cache .`.
  - `check:fast`: `vitest related --run` on changed files, plus typecheck and cached lint.
  - `check`: test, typecheck, lint and `vite build`.
  - `build`: `vite build` only.
- `vite.config.ts` test: `maxWorkers: 3`. Benchmark `pool: 'threads'` against `forks` (3 runs each) and keep the faster one.
- `.github/workflows/deploy.yml` runs `npm run check` and `npm run test:slow`.

**Acceptance criteria:**
- [x] `npm test` takes ≤ 20 s and `npm run check` takes ≤ 40 s on the dev Mac (log both).
  - `npm test` 12.6-16.6 s; `npm run check` 25.8 s with warm caches (49 s on a cold first run). See `docs/metrics.md`.
- [x] `npm run test:slow` runs every case that runs today: same test count, same seed counts.
  - 780 of 780 tests, same seeds (the old sweeps are the slow tier).
- [x] 10 consecutive `npm test` runs pass, and 2 consecutive `test:slow` runs pass.
  - 10 of 10 and 2 of 2 passed.
- [x] CI is green.
  - Run 43646571947 (build with `check` and `test:slow`, deploy) passed.

**Files:** `package.json`, `vite.config.ts`, `.gitignore`, `.github/workflows/deploy.yml`, `tests/core/*` (sweeps), a new `tests/sweep.ts`.
**Scope:** M

### Task V2: Agent loop: hooks, prompt, tool trial
**Description:**
- `.claude/settings.json`: a PostToolUse hook on Edit and Write for `*.ts`. It runs cached eslint on the file and `vitest related --run <file>`, and prints a short pass or fail (failures show the first lines). A Stop hook isn't needed.
- `tasks/subagent-prompt.md`: `check:fast` per slice, `check` before ticking, `test:slow` only for `core/` simulation or balance tasks. Keep the template short.
- Trial `tsgo` (`@typescript/native-preview`) for the typecheck and `oxlint` in front of ESLint. Adopt one only if it is at least 2× faster with the same errors on the current code. Log the numbers in `docs/metrics.md` either way.

**Acceptance criteria:**
- [x] The hook gives feedback in ≤ 10 s on a typical one-file edit (log it).
  - 3.1-3.8 s on a typical file; 10.8 s on `core/sim.ts`, which most tests depend on.
- [x] `check:fast` takes ≤ 15 s on a one-file change (log it).
  - 5.3 s on `render.ts`, 14.8 s on `core/sim.ts` (worst case). Was 18 s.
- [x] The trial results are logged, with a keep or drop for each tool.
  - `tsgo` kept (0.9 s vs 3.0 s incremental, same errors). `oxlint` dropped (missed an ESLint error; about 1 s gain).

**Scope:** S

## Phase 2: Strip

### Task V3: Remove the dev tools and URL flags
**Description:**
- Delete:
  - `src/game/sandbox/*`, `scripts/gauntlet-results.ts`, `tests/game/gauntlet.test.ts`.
  - The sandbox branch in `src/boot.ts`, `GAUNTLET_SEARCH` and the sandbox button.
  - `src/game/hordesettings.ts`, `src/game/camerasettings.ts`, the gear button, `storage/camera.ts` and `storage/horde.ts`, as far as they only hold overrides. The game reads `DEFAULT_CAMERA` and the horde defaults directly.
- On load, remove the old saved camera, gear and horde keys from localStorage.
- Remove the URL flags:
  - `?fps`: `three/fps.ts` and the `#fps` element.
  - `?level=`: `devLevel`. Also remove the session path that doesn't save, if nothing else uses it.
  - `?scenery=`: `sceneryParam`. The scenery still picks its look as in normal play.
  - `?2d` and `?3d` are V4's.

**Acceptance criteria:**
- [x] Golden snapshot unchanged. A phone with saved horde or camera values plays with the code defaults (tested).
- [x] Apart from the `?2d` check left for V4, nothing in `src` reads `location.search`. No mention of the sandbox, the gauntlet, the panels or the removed flags is left in `src`, `tests`, `README.md` or `AGENTS.md`.
- [x] Lines removed are logged (about −1,500 expected).

**Scope:** M

### Task V4: Remove the 2D renderer
**Description:**
- Delete the 2D run and boss drawing in `src/game/render.ts`: `renderRun`, `renderBoss`, `renderBossBanner` if only 2D uses it, crates, saws, squads, fire, army dots, kills and pop-ups that only the 2D path uses. Also delete the `?2d` check in `main.ts`.
- If WebGL fails (`createView3d` returns null or throws), the start screen shows "This device can't run the 3D game", and Play does nothing. Menus, the end screen, the HUD and the overlay stay on the 2D canvas.
- Delete or rewrite the tests that cover only 2D drawing.

**Acceptance criteria:**
- [x] Screenshots at 390×844 (run, boss, end screen) match the ones taken before the change.
- [x] With WebGL off, the message shows and nothing throws (tested and screenshot).
- [x] Nothing in `src` reads `location.search`. Lines removed are logged.

**Scope:** M

### Task V5: Dead code with knip, enforced in CI
**Description:**
- Add `knip` (dev dependency) and `knip.json`. Entries: `index.html` → `src/boot.ts` and `scripts/build-data.ts`. Project: `src`, `scripts`, `tests`.
- Remove what it reports: unused files, exports, types and dependencies. Anything kept on purpose gets an ignore entry with a one-line reason.
- Add `knip` to `npm run check` (CI runs it through `check`).

**Acceptance criteria:**
- [ ] `npx knip` reports 0 issues. Golden snapshot unchanged.
- [ ] Source lines are logged (target about 13k after V3–V5).

**Scope:** S

## Phase 3: Architecture

### Task V6: Layer rules with dependency-cruiser
**Description:**
- Add `dependency-cruiser` and a `.dependency-cruiser.cjs` with the layer rules in the spec: no cycles; `core` imports only `core` and `data`; `storage`, `sync` and `wanikani` don't import `game`; nothing outside `game` imports `game/three`.
- Add it to `npm run check`. Fix any violation without changing behaviour.
- Add the layer map to `AGENTS.md`, under 10 lines.

**Acceptance criteria:**
- [ ] 0 violations. A deliberate `core` → `game` import fails `check` (tried, not committed).

**Scope:** S

### Task V7: Split `render.ts`
**Description:**
- `src/game/render.ts` keeps only the `render()` dispatch. It is split into:
  - `hud.ts`: run and boss overlay, HUD.
  - `screens/start.ts`, `screens/end.ts`, `screens/levelcard.ts`.
  - `draw.ts`: shared helpers (`text`, `panel`, `button`, colours).
- Split `tests/game/scenes.test.ts` along the same lines if it mirrors them.

**Acceptance criteria:**
- [ ] No file in `src/game/` (outside `three/`) is over 600 lines. Screenshots match the ones taken before the split.

**Scope:** M

### Task V8: Split `core/sim.ts` (model: opus, core logic)
**Description:**
- Move fire, packs and the horde, gates, and the re-ask hooks out of `src/core/sim.ts` into their own `core/` modules, along today's seams. `sim.ts` keeps `RunState`, `step()` and the public `viewOf` and friends, re-exported so imports elsewhere don't change (or are updated).
- Split `tests/core/sim.test.ts` (1,517 lines) to match.

**Acceptance criteria:**
- [ ] Golden snapshot, `npm run check` and `npm run test:slow` pass unchanged.
- [ ] Every `core/` file is ≤ 600 lines.

**Scope:** M

### Task V9: Split `world.ts` and `scenery.ts`
**Description:**
- In `src/game/three/world.ts` and `scenery.ts`, separate the pure layout, projection and placement maths (tested without WebGL) from the code that builds meshes.
- Split `tests/game/world.test.ts` to match.

**Acceptance criteria:**
- [ ] No file in `src/game/three/` is over 600 lines. Screenshots match.
- [ ] Frame times are unchanged: a browser performance trace before and after (`browser-test` skill), with the numbers logged.

**Scope:** M

### Task V10: Slim `main.ts`
**Description:**
- Move the DOM panels (settings, WaniKani token, study, login, pause card) and their open/close wiring from `src/main.ts` into a `src/game/ui/` module with a small interface (`openX`, `anyPanelOpen`, `sync`).
- `main.ts` keeps boot, the loop, input and the scene changes.

**Acceptance criteria:**
- [ ] `main.ts` ≤ 200 lines.
- [ ] Every panel opens and closes as before, checked in the browser at 390×844.

**Scope:** M

## Phase 4: Measure and release

### Task V11: Re-measure, changelog, version
**Description:**
- Re-run the baseline measurements and fill in "After v1" in `docs/metrics.md`.
- `CHANGELOG.md`: what v1.0.0 contains, a short list built from the archived rounds in `tasks/done/`.
- `package.json` version `1.0.0`. The pause screen's build label shows `v1.0.0 · <hash> · <time>`.

**Acceptance criteria:**
- [ ] Every target in the spec is met, or the gap is explained in `docs/metrics.md`.
- [ ] The deploy is green.

**Scope:** S

### Checkpoint V1: v1.0.0 (owner, on the Pixel 7)
- [ ] A run, the boss and the end screen play and look as before the clean-up.
- [ ] Meaning mode, WaniKani and saved progress still work.
- [ ] The pause screen shows v1.0.0.

When the owner ticks it, tag `v1.0.0` on that commit and push the tag. Then move this list and `SPEC-v1.md` to `done/`.
