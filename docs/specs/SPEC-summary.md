# Spec: summary screen (v1.8)

Extends `docs/specs/done/SPEC.md` (v1) through `docs/specs/SPEC-meaning-mode.md` (v1.7). Everything there still holds unless this spec says otherwise. Idea and mockup: `docs/ideas/summary-screen.md`.

## Objective
The end-of-run screen shows, at a glance, how the run went and how far it moved you toward the next level, then offers clear buttons for what to do next.

### User stories
- After a run, I see whether I beat the boss, how close I am to unlocking the next level, and how much this run added.
- I see what I missed with the answers, and a one-line reminder of this session's fixed and still-missing items.
- I tap **Play again**, **Study** or **Home** instead of tapping anywhere.

## Layout (390×844, top to bottom; the mockup's "A + C" boards)
1. **Result.** Title as today: "Boss defeated!" (good colour), "Boss wins" or "Army wiped out" (bad colour). Under it:
   - won or lost to the boss: "Army 148 vs boss 96";
   - a tie: "Army 96 vs boss 96 · a tie is a loss";
   - wiped out: "The boss was never reached · gate 9 of 14" (the gate the army died at, of the run's planned rows).
2. **Level card** (panel, rounded). The level after the run (`levelName`), "`learned` of `total` learned" on the right. A bar: learned before the run in solid good colour, learned this run in the same colour at lower opacity, and the unlock mark at `UNLOCK_SHARE`. Under it: "+N this run" on the left (hidden when N ≤ 0) and "M more to unlock <next level>" on the right.
   - The run unlocked a level: the card shows the new level (its own bar, nothing gained yet), and the left line reads "<level> unlocked!" in good colour instead of "+N". This replaces today's `unlockedNote` line.
   - Last level: the right line reads "Last level", no unlock mark.
   - Same counting as the start screen's level bar (`levelProgress`, learned = box ≥ `LEARNED_BOX`); meaning mode uses its own progress and kanji meaning keys, as it does today.
3. **Stat tiles**, three in a row: Accuracy (`86%`), Gates right (`12/14`, answered of answered), Best streak (the run's longest run of correct answers, soldier colour).
4. **Missed (N)**: one row per miss as today (gate number, prompt, answers, "charge" tag), drawn as rounded rows. Rows shrink to fit the space left, as today; at 390×667 with many misses they may get tight but never overlap the buttons. "No misses!" when none.
5. **Session line**: "Session · run 3 · fixed 左 玉 · still missing 右 石", wrapping to at most 2 lines with a "+N" overflow, fixed items from this run in good colour as today. Hidden when there's no session log (dev sandbox). "No misses this session" when both lists are empty.
6. **Buttons** at the bottom: **Play again** (full width, filled good colour, 52 px tall), then **Study** and **Home** side by side (outlined, 48 px). When Study isn't offered (meaning mode, or `canStudy` false), Home takes the full width.

Removed: the seed, "Tap or Enter to continue", the stand-alone "No misses this session" panel heading layout.

## Controls
- **Play again**: tap the button, or Enter/Space. Starts a new run straight away (what confirming twice does today).
- **Study**: tap the button, or S. Opens the study screen as today; its own "Play again" works as today.
- **Home**: tap the button, or Escape. Goes to the start screen.
- A tap anywhere else on the end screen does nothing (today it continues).

## Data
- `RunState` gains the run's best streak (updated where the streak is updated in `src/core/sim.ts`). The golden run's other values stay unchanged.
- The end screen needs the level card before the run: `afterStep` keeps, beside `unlocked`, what's needed to draw "+N this run" (e.g. the learned count of the level before the run). Pure and tested.
- Wiped out: the gate the army died at is `results.length` (or the sim's own row counter) out of `plannedRows(run)`.

## Testing
- **Unit:** best streak (0 with no correct answers; longest run, not the last; across re-asks); the level-card numbers: +N from a run, no gain, a run that unlocks a level, last level, meaning mode; end-screen hit rects for the three buttons at 390×844 and 390×667 (and two-button layout without Study).
- **Unchanged:** golden run and existing tests apart from end-screen expectations this spec changes.
- **Browser:** 390×844 and 390×667, screenshots in the scratchpad: boss win with 2 misses; wiped out with 5+ misses; a tie; a run that unlocks a level; meaning mode (no Study button); a `?2d` run. Tap each button and check where it goes.

## Boundaries
- **Always:** keep SRS, unlock, session-log and study behaviour as they are; this round changes only what the end screen shows and how you leave it.
- **Never:** let the buttons overlap the missed list or session line at 390×667.

## Success Criteria
1. Every end screen shows the level card with the right numbers (tested and browser check).
2. Play again, Study and Home work by tap and key; a stray tap does nothing (browser check).
3. Nothing overlaps at 390×844 or 390×667 in the browser cases above.
