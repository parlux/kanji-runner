# Tasks: hordes (v1.10)

Spec: `docs/specs/SPEC-hordes.md` (2026-11-13). Idea and confirmed intent: `docs/ideas/hordes.md`. Started 2026-11-13.
Every task: `npm test && npm run lint && npm run build` pass before it is checked off.

## Plan
- **Numbers, then bodies, then spectacle.** H1 changes the core so a pack is a horde with today's danger. H2 draws every enemy and adds `?fps`. The owner plays it on the Pixel 7 at Checkpoint M1 before the effects are built on top.
- **Effects in the view, not the core.** Kills are found by comparing survivors between frames. The core stays pure and deterministic.
- **Performance first.** Every 3D task logs frame time. On a miss, cheaper effects come before a lower count.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Pixel 7 frame rate drops with 200 enemies plus effects | High | Instancing, pooled effects, LOD, ≤ 1.3× frame-time limit, `?fps` checked by the owner at M1 and M. |
| Hordes change balance (packs too easy or too deadly) | Med | Total HP and contact loss tied to today's values; bot balance logged before and after. |
| 200 dense figures read as a blob | Med | Smaller figures with a stride, screenshots, owner check at M1. |
| Kill effects hide gates or labels | Med | Effects stay at pack height and fade fast; screenshots with a gate behind a dying pack. |

## Phase 15: Hordes

### Task H1: Horde numbers in the core
**Description:** `HORDE_K`, `PACK_MAX`, `HORDE_THREAT` in `tuning.ts`; `packCount` in `fire.ts`; per-enemy HP, `packSurvivors`, `packSpan` (by remaining HP) and `contactLoss` in `sim.ts`, as in the spec. 2D shows the new counts with its current look.
**Acceptance criteria:**
- [ ] Tested: `packCount` scales and clamps; pack HP equals today's; survivors drop one per per-enemy HP; the span at full HP equals today's; contact loss matches the formula; time to die under steady fire is unchanged.
- [ ] Balance bands hold; final army before and after logged here.
- [ ] Golden snapshot updated only for pack-contact changes, with the reason in the commit.
**Verification:** `npm test && npm run lint && npm run build`. **Dependencies:** none. **Files:** `src/core/{tuning,fire,sim}.ts`, `src/game/render.ts` (only if the count display needs it), `tests/core/*`. **Scope:** S (highest risk: balance; use opus)

### Task H2: Draw the whole horde, `?fps`
**Description:** `hazards.ts` draws every live enemy up to `PACK_MAX` per pack (cap covers two full packs), smaller (about 0.7×), denser and deeper, so 200 fit today's width. A dead figure shrinks out over a short time rather than popping. Add the `?fps` readout.
**Acceptance criteria:**
- [ ] Tested: horde layout keeps every figure within the pack's span; caps hold.
- [ ] Browser at 390×844: a 200 pack approaching, half shot, and dying, with a 200 army, in Countryside and Race day; gates and labels read as before. Screenshots in the scratchpad.
- [ ] Frame time and draw calls logged before and after (≤ 1.3×, ≤ 4 extra draw calls). `?fps` shows and is absent without the flag.
- [ ] Deploy green (checkpoint follows).
**Verification:** as H1, plus the browser check. **Dependencies:** H1. **Files:** `src/game/three/{hazards,world,scene3d,view}.ts`, tests. **Scope:** M

### Checkpoint M1: horde on the Pixel 7 (owner)
- [ ] Packs feel like a horde to mow down; still a small threat when misaligned.
- [ ] `?fps` stays smooth while a big pack dies.
- [ ] Note the count (`PACK_MAX`) and look before the kill effects are built.

### Task H3: Spectacular kills
**Description:** `kills.ts`: a pooled kill-effect ring. Each kill knocks the figure back or topples it with a spark burst in the enemy colour. Kills are found by comparing survivors between frames. The final burst of a pack is bigger than today's. Fewer pieces beyond about half the shape distance. Effects freeze when paused.
**Acceptance criteria:**
- [ ] Tested: the pool never grows; kill detection counts drops correctly, including across pause and a new run; LOD piece counts.
- [ ] Browser as in H2, plus a gate behind a dying pack (labels stay readable). Screenshots in the scratchpad.
- [ ] Frame time logged against H2 and against today's pack scene (≤ 1.3× today's). On a miss: shrink the effects first, then `PACK_MAX`, and log what changed.
- [ ] Deploy green.
**Verification:** as H2. **Dependencies:** H2. **Files:** `src/game/three/{kills,hazards,fx}.ts`, tests. **Scope:** M

### Checkpoint M: v1.10 (owner, on the Pixel 7)
- [ ] Mowing down a pack looks spectacular.
- [ ] Smooth with `?fps` while big packs die, in several looks.
- [ ] Packs still feel fair: a light bite when misaligned.
