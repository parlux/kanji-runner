# Crowd Runner Rework

## Problem Statement
How might we make each kana/kanji answer a move in a physical crowd-runner, with steering, risk and a swelling army, instead of a timed quiz, while keeping guessing worse than knowing?

## Recommended Direction
**Hybrid track (Direction C).** The run is a continuous obstacle course. The army has an `x` position and a width that grows with its size, so a bigger army is harder to steer through gaps (the self-balancing snowball). Between question beats, hazards cut off whatever part of the crowd overlaps them. Most questions are **wall gates**: openings in a wall, where the solid wall kills the soldiers that hit it.

Every few beats, a question is a **squad charge** instead. Identical-looking enemy squads stand under the answer banners. Crossing the charge line locks steering. The correct squad defects and joins you; a wrong one fights you at full strength. The boss stays at the end.

This fixes "flash cards with a timer" by making most of each run about steering and survival, with time pressure coming from the track rather than a countdown. It's staged so that the wall-gate runner is complete on its own if squads don't work out.

### Honesty rules for squad charges
- Squads look identical until contact: same size, same shown count, same formation.
- Steering locks at the charge line, so there's no touch-and-retry.
- Squad positions are shuffled every encounter.
- A wrong charge costs more than a wrong gate, so guessing loses over a run.

## Key Assumptions to Validate
- [ ] **One-thumb drag steering feels good on a phone.** Test: the first slice is steering + crowd width + one hazard, played on the phone before anything else.
- [ ] **You can read a kana prompt while steering around hazards.** Test: playtest with a hazard just before a gate row. If reading suffers, add a calm stretch before each question.
- [ ] **It's fun even when you know the answers.** Test: play a run of only strong (known) kana and see whether you still want another run.
- [ ] **Squad charges don't leak the answer.** Test: someone who doesn't know kana should be right only about as often as random chance (1 in 2 or 1 in 3) over 20+ charges.
- [ ] **Two question shapes beat one.** Test: compare runs with and without squads, using the "one more run" feeling as the measure.

## MVP Scope
**In:**
- Continuous `x` steering: keyboard hold on the laptop, relative drag on the phone.
- Crowd width that scales with army size; losses proportional to how much of the crowd overlaps a hazard or the wall.
- 2 hazard types: a static block and a moving saw.
- Wall gates for most questions.
- A squad charge every ~4th question, with the charge-line lock.
- The existing boss clash.
- Kana only, using the existing `run.ts` builder and `scoring.ts` rewards.
- Gate and squad positions shuffled per beat (already done by `run.ts`).

**Out:** everything in Not Doing.

## Not Doing (and Why)
- **Split crowd** — adds a hedging edge case to balance. Seasoning for later, once the gates feel right.
- **Stage chains / long-session spine** — structure for later. Not needed to prove moment-to-moment fun.
- **Kanji, spaced repetition and placement changes** — the learning layer slots in unchanged later. Don't redesign it until the core is fun.
- **Art, sound, juice beyond simple feedback** — shapes and counts are enough to judge feel. Polish would hide whether the mechanics work.
- **Tap-left/right touch controls** — would bring back the lane-snapping feel. Drag only.
- **More hazard types or enemy variety** — two hazards and one squad type are enough to test the bets.

## Decisions (formerly open questions)
- **Crowd model: a blob with a width, not individual soldiers.** Width grows with army size (e.g. with the square root of the count). It's far simpler, and enough to test feel. Soldiers can still be drawn as dots inside the blob.
- **Speed ramp: lower `MAX_SPEED_MUL` from 1.6 to 1.3.** Hazards now provide the pressure. Tune it in playtest.
- **Wrong squad charge: lose 50% of the army (min 8)**, against 30% (min 5) for a wrong gate. A correct charge uses the normal streak reward plus the defecting squad's soldiers.
- **Question beats per run: 14** (down from `ROWS_PER_RUN = 20`), with 1–2 hazard beats between questions. That keeps run length about the same.
- **Boss: unchanged from the current spec for the MVP.** Revisit it as a big squad charge once squads prove fun.
