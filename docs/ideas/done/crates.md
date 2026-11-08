# Always-on fire and supply crates

Status: confirmed by owner, 2026-11-07, from Checkpoint A feedback. Input for spec revision 4.

## Problem Statement
How might we make the army look like it's always firing while range still decides what it can hit, and give blocks a reason to shoot them instead of dodging?

## Recommended Direction
**Always-on fire (visual only):** the army streams bullets straight ahead all the time. They fade where `FIRE_RANGE` ends and only hit what's inside it. The rules don't change. The visible range end is the buffer that keeps you from hitting things you didn't mean to, which matters once squads become fire targets in R5.

**Supply crates:** blocks become crates. Shattering one adds recruits to the army right away: `round(CRATE_REWARD_K × its hit points)`. Lining up to shoot puts you in the crate's path, so if it doesn't break in time you get clipped as before. Crates follow the expected army, so a player ahead of par breaks them and gets paid, and a player behind par should dodge. One rule, using the fire and clipping that already exist.

## Key Assumptions to Validate
- [ ] Crates are a real choice, not free soldiers despite late dodging. Test: owner playtest on the phone.
- [ ] Crate rewards don't snowball. Test: the balance bot (shooting crates) keeps 50% runs dying early, and the 100% bot's army growth stays reasonable.
- [ ] Always-on fire doesn't hurt prompt readability. Test: owner playtest; fire stays below the range end, which is far below the prompts.
- [ ] You can judge "can I break it?" at a glance from the hit points shown. Test: owner playtest.

## MVP Scope
In: a constant bullet stream to the range end (render only); a crate reward on shatter (rule, tuning `CRATE_REWARD_K`, start 0.3); a "+N" pop-up and recruits joining; crate visuals; tests (reward exactly once, only when shattered, never touches streak or results); the bot shoots crates.
Out: everything below.

## Not Doing (and Why)
- **Growing bonus gates:** held for later; a new kind of object, try crates first.
- **Blocks as cover from packs:** too many interactions to read at a glance.
- **Blocks in front of wall openings:** adds pressure to the calm stretch used for reading.
- **Combo multipliers:** a second curve to balance.
- **Collecting the drop by walking through it:** an instant reward is simpler; revisit if crates feel too easy.

## Open Questions
- ~~Show the reward on the crate (e.g. "+6"), or only its hit points?~~ Resolved at Checkpoint A (2026-11-07): show both, so the owner can tell whether a crate is worth attacking.
