# Spec: Ask again (v1.2, WaniKani mode)

Extends `docs/specs/SPEC.md` (v1) and `docs/specs/SPEC-wanikani.md` (v1.1). Everything there still holds unless this spec says otherwise. Idea and interview: `docs/ideas/done/guessing-and-rust.md`.

## Objective
In WaniKani mode, a lucky guess should not move an item up. Weak or missed items come back later in the same run, and only move up when they are answered right twice.

### Why
The owner is coming back to WaniKani after a break. They know when they are guessing but commit early anyway (gate shooting rewards it). With 2 options a blind guess is right half the time, and every right answer moves the item up a box, so it is drawn less often and never actually learned.

### User stories
- As the player in WaniKani mode, when I miss a kanji, it comes back a few rows later, so I can use the answer I just saw.
- As the player, when I guess a weak kanji right, the game asks it again before it believes me.
- As the player, nothing new to learn or press: runs look, play and last the same.

## Rules

### When an item is asked again (a "re-ask")
- Only in **WaniKani mode**. Built-in mode is unchanged, and the same seed gives the same Built-in run as before.
- A **trigger** is an answered row, other than a re-ask row, where:
  - the answer was wrong, or
  - the answer was right and the item's box **at the start of the run** was ≤ `REASK_MAX_BOX` (2). The box is the selection box: its record's, else the seeded box from WaniKani, else 0.
- This covers every item in a WaniKani run: kanji meaning and reading gates, and kana.
- At most `REASK_MAX` (3) re-asks per run, given to triggers in the order they happen.
- A re-ask row never triggers another re-ask.

### Where it goes
- A re-ask replaces a planned row `REASK_GAP_MIN`–`REASK_GAP_MAX` (3–5) rows after the trigger, picked at random among the **eligible** rows in that window. The pick is seeded, so the same seed and the same answers give the same run.
- A row is eligible if it is not yet resolved, not a squad charge (questions 4, 8, 12), not already a re-ask, and not an ask of the same item (same key).
- If no row is eligible (near the end of the run), there is no re-ask for that trigger, and it doesn't use up one of the 3.
- The replaced row's item is simply not asked this run. It gets no record update.
- A run stays 14 questions. The track (hazards, crates, packs, boss, block hit points) is built at the start, as now, and is never changed by a re-ask.
- The substitution happens when the trigger is resolved. Rows are at least `CALM_DISTANCE + 2 × HAZARD_SPACING` (7.2) apart and only visible within `VIEW_DISTANCE` (3.0), so the replaced row is never on screen yet. A test pins this.

### What a re-ask row looks like
- Same item and gate type as the trigger. A reading gate shows the same reading as the first ask.
- Fresh distractors, drawn by the WaniKani rules (`similar` first, all validity rules hold).
- **Always 3 options**, whatever row it lands on. The wall's openings are rebuilt for 3 answers (the row is off screen).
- **The answer's opening is random**, not "never the same opening". See Changes from the interview.
- No marker or label. It looks like any wall gate and is scored like one (army, streak, reward by gate type).

### How the record moves
An item that was asked twice is updated once, from the pair. Its `seen`, `correct` and `wrong` counters still count both answers.

| First ask | Re-ask | Box after |
|---|---|---|
| right | right | box + 1 (max 5) |
| right | wrong | 0 |
| wrong | right | 0 |
| wrong | wrong | 0 |
| right, weak, no re-ask (cap, end of run, or the army died first) | — | unchanged |
| wrong, no re-ask | — | 0 |
| right, not weak (box > 2) | — | box + 1 (as now) |

- "Box" here is the selection box at the start of the run, so for a kanji with no record yet, the first written box comes from its seeded box (for example seeded 1, right twice → 2).
- `lastSeen` is the time of the run, as now.
- Items asked twice by the v1 "pool too small" repeat are not re-asks and keep the v1 rule (each answer updates in turn).

### Summary and study
- The summary lists every row as now, with a re-ask showing as its own question. A miss on either ask is listed.
- Study cards are unchanged: one card per missed item.

### Tuning (`tuning.ts`)
`REASK_MAX = 3`, `REASK_MAX_BOX = 2`, `REASK_GAP_MIN = 3`, `REASK_GAP_MAX = 5`.

## Changes from the interview
- **The answer's position on a re-ask is random**, not "never the same opening". With 2 options, "never the same" means the answer is always on the other side, and with 3 it rules one out. Either way, remembering the first pick would give away part of the answer. Re-asks are also always 3 options, so a guess is 1 in 3. Steering to the same side is right only 1 time in 3, so it is no shortcut.
- **A weak right answer with no re-ask leaves the box unchanged**, rather than moving it up. This is what makes "a blind guess no longer moves an item up" true at the end of a run and past the cap. Open question 1.

## Project Structure (additions)
```
src/core/
  reask.ts   → pure: triggers, target row choice, re-ask row building, pair-aware record update
```
Touches `sim.ts` (rows and openings can be replaced ahead of the crowd; the run state records which rows are re-asks and of which row), `srs.ts` (`recordRun` takes the re-ask pairs and the start-of-run boxes), `run.ts` (row building shared with re-asks), `scenes.ts` (WaniKani runs turn re-asks on; Built-in runs don't), `tuning.ts`.

## Commands
Unchanged: `npm test`, `npm run lint`, `npm run build`, `npx vite --port 8765`.

## Code Style
As `docs/specs/SPEC.md`: strict TS, pure functions in `src/core`, constants in `tuning.ts`, short doc comments that state the rule.

## Testing Strategy
- **Triggers:** wrong → trigger; right at box ≤ 2 (real or seeded) → trigger; right at box 3+ → none; a re-ask row never triggers.
- **Placement:** target in the 3–5 window, never a squad charge, an already-resolved row, another re-ask, or the same item; no target → no re-ask and the cap is not used; at most 3 per run; same seed and answers → same run (property over many seeds).
- **Re-ask row:** same item, type and shown reading; 3 options; distractor validity property holds; over many seeds the answer's opening is spread evenly and independent of the first ask's choice.
- **Not visible:** for every row, the distance from a trigger's wall to any row it can replace is greater than `VIEW_DISTANCE` (over many seeded tracks).
- **Records:** every row of the pair table, the seeded-box start, counters counting both answers, the army dying between the two asks, and the v1 repeat rule unchanged.
- **Built-in mode:** every existing test passes unchanged; the golden run snapshot is identical; the bot balance thresholds still hold.
- **Bot in WaniKani mode:** over 200 seeded runs on a synthetic WaniKani list, 100% accuracy never dies early and 50% dies early in at least half the runs (re-asks don't break the balance).
- **Browser checks** at 390×844: a WaniKani run where a miss comes back 3–5 rows later as a 3-answer wall, with no flicker or pop-in of the replaced row.

## Boundaries
- **Always:** keep re-asks out of Built-in mode; keep the track fixed after the run starts; keep all v1.1 WaniKani content rules (no WaniKani content in fixtures, screenshots in the repo, or anywhere committed).
- **Ask first:** any visible marker on re-ask gates; changing the number of options outside re-asks; changing the run length; re-asks on squad charges.
- **Never:** let a re-ask change the record of the item it displaced; let a re-ask row appear inside `VIEW_DISTANCE`.

## Success Criteria
1. In WaniKani mode, a weak item answered right once is not moved up unless it is answered right again on a re-ask (tested).
2. A miss comes back 3–5 rows later in the same run when there is room and the cap allows (tested, and seen in a browser run).
3. Runs stay 14 questions, and the track is identical to a run without re-asks (tested).
4. Built-in mode is byte-for-byte the same: golden run, all v1 and v1.1 tests, bot balance (tested).
5. **Owner checkpoint:** on the phone, weak kanji keep coming back until they're known, lucky guesses no longer feel like they "count", and runs don't feel repetitive.

## Out of Scope (v1.2)
Re-asks in Built-in mode; the steering-confidence signal; rust over time; a "?" or "don't know" opening; showing the answer after every gate; changing the 2-option rows outside re-asks; a visible marker on re-ask gates.

## Open Questions
1. **A weak right answer with no room for a re-ask:** leave the box unchanged (this spec), or move it up as now? Unchanged is stricter, but with only 3 re-asks per run, weak items may climb slowly. If they feel stuck, raise `REASK_MAX` before relaxing this rule.
2. **Wrong then right:** box 0 (this spec), or 1? 0 keeps "a miss always resets" simple.
3. **`REASK_MAX` = 3** is a starting guess. Tune it from the owner's playtest.
