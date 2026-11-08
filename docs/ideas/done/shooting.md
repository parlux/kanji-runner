# Shooting

Status: confirmed by owner, 2026-11-07. Input for spec revision 3.

## Problem Statement
How might we make right answers feel like power, with an army that auto-fires and blasts through obstacles and incoming enemies, so a strong run feels unstoppable and a weak one gets overrun early, without making the prompts harder to read?

## Recommended Direction
The army fires straight ahead all the time; you only steer. Firepower grows with army size, and correct answers are what grow the army, so knowing your kanji is your weapon. No new power-up system.

Two threats can be shot: **breakable blocks** (existing blocks gain hit points; shattered blocks no longer clip) and **enemy packs** (a counted group running at you; your fire thins it, and survivors that reach you cost soldiers one for one). Threat hit points rise along the track, following the army size an 80%-accuracy player is expected to have, so strong players stay challenged and weak players fall behind. Walls and saws can't be shot: questions stay questions, and dodging still matters.

Squad charges (R5) later become short firefights on the same system: the correct squad stops fighting and joins you; a wrong one fires back.

## Key Assumptions to Validate
- [ ] Fire and explosions don't hurt prompt readability on the phone. Test: owner playtest; if it fails, effects get quieter as each question approaches.
- [ ] One threat curve makes 80%-accuracy runs feel strong and 50% runs lose early. Test: a balance-bot sweep over accuracy, driving the real game simulation (as planned for T9).
- [ ] Blocks + enemies + saws + walls isn't too much in about 80 s. Test: owner playtest, and thin out the hazard count if it is.
- [ ] Auto-fire is satisfying with steering as the only input. Test: owner playtest.

## MVP Scope
In: auto-fire with firepower set by army size; block hit points; one enemy pack type; threat hit points rising along the track; simple bullet, hit and shatter visuals; tests for the damage and loss rules.
Out: everything below.

## Not Doing (and Why)
- **Streak bonus to firepower:** a second curve to balance; correctness already drives army size.
- **Player-triggered fire or ammo:** competes with drag steering on the phone.
- **Breakable walls or saws:** would bypass the question, or remove the need to dodge.
- **Shooting answers or answer panels:** risks giving the answer away.
- **Cosmetic-only trial:** the direction is already chosen.
- **Boss shootout:** comes with T9, not now.
- **Multiple enemy types, upgrades, pickups:** one of each is enough to test the bet.

## Open Questions (resolved in spec revision 3)
- ~~Where it goes in the plan~~: before R5, as tasks S1 (fire + breakable blocks) and S2 (enemy packs). Checkpoint A moves after S2 so the feel test covers shooting.
- ~~Does the 80 s run need more beats?~~ No: enemy packs take some of the existing hazard beats. Revisit at Checkpoint A.
- ~~Enemy pack damage~~: one soldier per surviving enemy, as a starting value in `tuning.ts`.
