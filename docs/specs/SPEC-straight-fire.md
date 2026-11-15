# Spec: straight fire (v1.1.0)

Extends `docs/specs/done/SPEC-v1.md`, the shooting rules (`docs/ideas/done/shooting.md`, `docs/ideas/done/crates.md`) and `docs/specs/done/SPEC-hordes.md`. Everything there still holds unless this spec says otherwise. Idea and confirmed intent: `docs/ideas/straight-fire.md`.

## Objective
The army's fire goes straight ahead, lane by lane, with one range. Crates block what's behind them. The game feels as hard as today.

### User stories
- As the owner, when a crate sits between me and a pack, the lanes behind the crate hit the crate, not the pack.
- As the owner, the lanes beside the crate keep hitting the pack (or the wall) beyond it.
- As the owner, every tracer goes straight ahead; none bends towards a crate.
- As the owner, crates and gates still take about as much shooting as they do now.

## Rules

### One range (core)
- `FIRE_RANGE` = `PACK_WAKE` (12 track units) for everything: crates, packs and wall openings. Packs no longer carry their own range (`Threat.range` goes).
- Fire still never passes the next unanswered wall (`fireLimit`).

### Fire by lane (core)
- The army's span (`x ± crowdWidth(army)/2`) is split by what's ahead of each part of it. For each part, the **nearest** shootable threat (intact crate, pack with enemies left) within range that overlaps it takes that part's fire.
- A threat's share of the fire = the width of army span it is nearest in / the army's width. Damage = `firepower(army) × dt × share`, capped at its HP, as today. A pack's share is therefore at most today's `packFireShare` and less when a nearer crate covers some of its lanes.
- The part of the army span with no threat ahead fires at the next wall (if within range): the opening nearest the crowd's centre grows as today, but by `GATE_GROW_PER_DAMAGE × damage` with damage = firepower × dt × that free share.
- Several threats (and the wall) can take fire in the same step. A crate pays out once, on the step it shatters, as today; two crates shattering in one step both pay.
- Run state exposes all of this step's targets with their shares (replacing the single `target`; keep whatever the view, 2D, sim and bot need working). Deterministic and pure as before.

### Retune (core)
- `BLOCK_HP_K` about 4× (start 4.0); crate reward unchanged in soldiers: `CRATE_REWARD_K` divided by the same factor (start 0.075), or the reward written from the expected army directly; pick one and test that rewards match today's.
- `GATE_GROW_PER_DAMAGE` about ¼ (start 0.00025).
- Tune so, for the 80% bot over 200 seeds: crates shatter at about the same distance ahead of the army as today (mean within ±25%), the share of crates shattered is about today's (±5 points), and mean gate widening per row is about today's (±20%). Log before and after.
- Balance bands hold: `botBossRun` mean final army and win rate at 100%, 80%, 50% and 100% at skill 0.5 logged before and after, each within ±10% (win rate within ±0.05).
- Packs, saws, melee, the boss and squad charges are unchanged.

### Drawing (3D and 2D)
- Every lane's tracer goes straight ahead from its lane. It stops at the first thing that lane hits (crate, pack or wall); otherwise it fades at the range end (12) or stops at the next wall, as today.
- No aiming at the overlap; the crate hit flash sits where its lanes hit it.
- 2D (`?2d`) shows the same rule with its current look.

### Version
- `package.json` 1.1.0; the pause screen shows `v1.1.0 · <hash> · <time>`; `CHANGELOG.md` gets a 1.1.0 entry (straight fire, crates block, one range, retuned crates and gates).
