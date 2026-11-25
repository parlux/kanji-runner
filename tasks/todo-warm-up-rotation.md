# Tasks: rotate the warm-ups (v1.6.26)

Spec: `docs/specs/SPEC-warm-up-rotation.md` (2026-11-25). Intent: `docs/intent/warm-up-rotation.md`. Started 2026-11-25. The owner waived spec approval: straight to the checkpoint. Version is a patch (1.6.26; 1.6.25 went to own stories), not a minor: v1.7.0 is reserved for the open own-stories round.
Checkpoint W: https://claude.ai/artifact/3UXKQGtki6vtAoqVyqMKpW
Every task: `npm run check` passes before it is checked off.

### Task W1: Warm-ups rotate through strong items (sonnet)
`Selection.lastSeen`, `WARM_UP_MIN_BOX`, the new warm-up rule in `select`, tests per the spec. Bump to 1.6.26 with a changelog line.
- [x] Tests from the spec's "Tests" section pass; existing warm-up tests updated.
- [x] `npm run test:slow` passes (core selection change).
- [x] `package.json` 1.6.26; `CHANGELOG.md` has `## 1.6.26 (2026-11-25)` with one line.
- [x] `npm run check` passes.

### Checkpoint W: owner plays a few Kanji 5 runs
- [ ] The first 3 questions change from run to run and are still easy; owner ticks to close.
