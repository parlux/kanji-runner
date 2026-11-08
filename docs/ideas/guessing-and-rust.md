# Lucky guesses and coming back rusty

Status: confirmed by owner, 2026-11-08, after an interview. Idea 1 goes ahead in WaniKani mode only: spec `docs/specs/SPEC-reask.md`. Ideas 2 and 3 are parked.

## Decisions (owner, 2026-11-08)
1. **The problem is the game's record, not in-the-moment feedback.** A lucky guess moves a kanji up a box, so it is shown less and never learned.
2. **Idea 2 (steering confidence) is out.** The owner knows when they're guessing but commits early anyway, so steering would not tell guesses apart.
3. **Catch guesses automatically (idea 1).** No "?" opening or any other input from the player.
4. **Idea 3 (rust) is dropped for now.** The owner plays WaniKani mode, where WaniKani's due list already marks what was forgotten.
5. **Idea 1, as agreed:** any miss, plus any right answer on an item at box ≤ 2 (seeded boxes count), comes back 3–5 rows later; at most about 3 per run; each replaces a later planned row, so a run stays 14 questions. Right twice → up one box; right then wrong → box 0; wrong then right → stays weak.
6. **WaniKani mode only.** Built-in mode is unchanged.

## Feedback
- "It's quite hard at the moment as I'm coming back, and sometimes I'm lucky and just blind guess the right answer, so I'm not actually learning."

## Why it happens
- Rows 1–7 have 2 options (`TWO_OPTION_ROWS`), so a blind guess is right half the time. Later rows have 3.
- Any correct answer moves the item up one box (`review` in `srs.ts`), and a higher box is drawn less often. A lucky guess therefore makes the game show that kanji *less*, which is the opposite of what a rusty player needs.
- Boxes never decay. After a break, the game still thinks you know everything you knew before. In WaniKani mode the seeded box (from WaniKani's SRS stage) may also overstate what is remembered.

## Idea 1: Ask it again later in the run
- A kanji that was missed, or answered right while still in a low box (say box ≤ 2), comes back 3–5 rows later in the same run.
- It only moves up a box if it is answered right both times. Two lucky guesses in a row are 25% at 2 options and about 11% at 3, instead of 50% or 33% for one.
- A miss followed by a right answer on the re-ask teaches inside the run: you see the answer, then use it.
- Touches: run planning (`run.ts` picks 14 prompts without repeats up front; a re-ask either takes a reserved slot or replaces a later row), `recordRun` (the item's update depends on both answers, not each one in turn), the end summary and study screen (show both attempts?).
- Open questions: how many re-ask slots per run; whether re-asks avoid squad charges and warm-ups; whether a re-ask uses fresh distractors or swaps the answer's position so you can't just steer to the same side.

## Idea 2: Use how you steered as a confidence signal
- The game already knows where the crowd is all the way up to every wall. A player who lined up with one opening early and stayed there knew the answer. A player who switched openings late, or swung between them, probably didn't.
- **Confident** (committed early, never switched): the normal Leitner update.
- **Unsure** (switched to the final opening late): right → the box stays where it is; wrong → box 0 as usual.
- No new controls, and it fits gate shooting, which already rewards committing early.
- Touches: `sim.ts` records, per question, which opening the crowd was nearest to over the approach and when that last changed; the `results` passed to `recordRun` carry a confidence flag next to `correct`.
- Risks: dodging a hazard right before the wall looks like hesitation. Measure only the last stretch, which is hazard-free (or discount changes forced by a hazard), and tune the window with the bot and owner playtests. The player should never feel punished for dodging.
- Optional: show the flag in the summary ("right, but unsure"), and put unsure answers on the study screen next to misses.

## Idea 3: Rust over time
- An item's box drops the longer it goes unseen, using the `lastSeen` already stored per item. For example, each box has an expected interval (box 1 ≈ 1 day … box 5 ≈ a few weeks), and selection uses an *effective box* that falls one step per interval overdue, down to a floor.
- After a break, weaker and older items are drawn more and new items can wait, without the player doing anything.
- In WaniKani mode, combine with WaniKani's own `due` flag (already boosted by `WK_DUE_BOOST`), so we don't punish the same thing twice. The seeded box could also rust from the assignment's last review date.
- Decide: is the effective box only used to pick items (stored boxes unchanged, merge and sync untouched), or is the drop written to the stored box? Picking only is simpler and keeps `merge.ts` and sync as they are.
- Optional: when the gap is long (say 2+ weeks), also turn off new items for the next run or two.

## How they fit together
- Idea 3 makes the game *pick* rusty items more often. Ideas 1 and 2 stop lucky guesses from *hiding* them again. Ideas 1 and 2 can ship separately; 2 needs the most tuning.
- Quick experiment that can go first: `TWO_OPTION_ROWS = 0` (3 options on every row) to see how much guessing alone accounts for.
