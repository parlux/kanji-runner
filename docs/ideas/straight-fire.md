# Straight fire, crates block

Status: confirmed by owner, 2026-11-15 (interview). Input for `docs/specs/SPEC-straight-fire.md`.

## Problem
Firing at enemy packs feels good, but the army shoots through crates, and the different firing ranges (2.8 for crates and walls, 12 for packs) feel weird. Fire at a crate is aimed at it at an angle instead of going straight ahead.

## Confirmed intent
- **Outcome:** every lane fires straight ahead with one range (the long pack range, 12). The first crate, pack or wall in a lane takes that lane's fire; nothing is hit through a crate.
- **Visuals:** all tracers straight ahead; no aiming at crates.
- **Balance:** crates about 4× HP with the same soldier reward; gate growth per damage cut about 4×. Crates, gates and runs feel as hard as today.
- **Success:** no hits through crates; crates break and gates widen at about the same point in the approach as now.
- **Version:** 1.0.0 → 1.1.0, CHANGELOG entry.
- **Out of scope:** saws, boss, melee, pack tuning, any other rebalance.
