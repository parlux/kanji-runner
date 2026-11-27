# Spec: items met after a run, what's in a level

Intent: `docs/intent/run-items.md` (2026-11-28). Tasks: `tasks/todo-run-items.md`. Extends `docs/specs/SPEC-overall-progress.md` (1.8.0: stages, 15-item levels, groups, the progress view); where they disagree, this spec wins. Version: **1.9.0** (a round).

## Objective
After a run, show every kanji and word met and how the run moved its stage; in the progress view, open any level to see its items and their stages, and open an item's study card. Success:
- After a run the owner can say what was met and what moved without opening anything.
- "What's in Kanji 1" takes two taps from the start screen (level block → Kanji 1 row).

## 1. Run items (core)
- `runItems(before, after, rows, results, kana, kanji, words)` in `src/core/` (new module, e.g. `runitems.ts`): one entry per **item** met in the run (a kanji, kanji word, kana or loanword; its meaning and reading gates fold into one entry). Only answered rows count. `before` is the progress before the run (`session.before`), `after` the progress now.
- Each entry: the item (key, char/word, kind), its meaning (first gloss; kana: romaji), its main reading (kanji: as the study card's first reading; word: its reading; kana and loanwords: none), and per gate **asked this run**: `{ gate, from: box, to: box, missed: boolean }`, plus the item's other gate's current box when not asked (kanji, kanji words).
- **Change** of an entry: `new` (no record of any gate before the run), `up` (some asked gate ended higher, none lower), `slip` (some asked gate ended lower, i.e. a miss), `same`. A gate missed and then re-asked right still counts by its box before vs after.
- **Order:** new, up, slip, same; within each, the order the item was first asked.
- For a missed gate, the entry carries the right answer (the reading(s) for a reading gate, the meaning for a meaning gate), as `missedItems` gives today.
- Meaning mode: kanji meanings only. WaniKani mode: kanji only (no words).

## 2. End screen
Top to bottom: result title → level card (unchanged) → **item list** → buttons (Study for misses, Play again; unchanged).
- **Removed:** the three stat tiles (accuracy, gates right, best streak), the missed-gates list, and the session line. The session log is no longer kept: `src/core/session.ts`, `src/storage/session.ts`, its wiring in `main.ts`/`scenes.ts` and their tests go. The stored log keys in `localStorage` are left as they are (never read or written again). The progress save is untouched.
- **Row** (one line): the item (kanji/word large, left), its meaning (dim, truncated with "…" to fit), and on the right the stage change of the asked gate(s): "Recalled → Learned". When both gates of an item were asked: "M Met → Recalled · R New → Met" (labels M/R only in that case). A `new` row reads e.g. "New → Met". A `slip` row shows its change in the bad colour and, under the item on a second dim line, the right answer ("にち・じつ"). `same` rows are drawn dim with just the stage ("Strong").
- Colours: up/new in the good colour, slip in the bad colour, same dim; the existing palette.
- **Fit:** at 390×844 a normal run (up to 16 items) fits without scrolling; longer lists scroll (drag, wheel) between the level card and the buttons. Compact screens (h < 760) use tighter rows (min 22 px).
- The Study button and the study cards for misses work as today.

## 3. Progress view: groups and levels
- **Past groups** (collapsed rows) are tappable: a tap expands the group to its level rows (as the current group's), a second tap collapses it. Several can be open.
- **Level rows** (any group, including the dimmed next level and levels inside the dimmed next group once expanded) are tappable: a tap opens the **level page**. Locked levels open too (peek ahead) and are drawn dim.
- Taps vs drags: a drag that moved more than a few px is a scroll, never a tap.

## 4. Level page
A canvas screen inside the progress scene; Back (button, Esc) returns to the progress view at the same scroll.
- **Header:** "Kanji 1 · Foundations", "11 of 15 learned", the level's bar (same as the start block, incl. the dim reading-to-go segment).
- **Rows:** one per item of the level (`levelKeys` items: kana, or kanji + words + loanword): the item (large), main reading, meaning (dim, truncated), and the stages on the right: "M Strong · R Recalled" for kanji and kanji words, the single stage for kana and loanwords (meaning mode: meaning stage only). A learned item gets a tick.
- **Order:** unlearned first, then learned; within each, teaching order (kanji, then its words, as sliced; loanword last).
- Locked level: all rows dim; stages still shown (placement may have set some).
- Rows scroll if they don't fit.
- **Tap an item:** opens its study card (the existing DOM study overlay, one card) with the stage line; closing it returns to the level page. The overlay's "Play again" is not shown here; it closes instead.

## Commands
`npm run check` before every tick; `npm run check:fast` per slice. Offscreen renders at 390×844 for the end screen and both progress screens.

## Project structure
- `src/core/runitems.ts` (new), `src/core/run.ts` (`missedItems` may go if unused), `src/core/session.ts` and `src/storage/session.ts` (removed).
- `src/game/screens/end.ts`, `src/game/start.ts` (`endLayout`), `src/game/scenes.ts`, `src/main.ts`.
- `src/game/progress.ts`, `src/game/screens/progress.ts` (groups expand, level page), `src/game/ui/panels.ts`, `src/game/ui/study.ts`, `src/core/study.ts` (a study card for one item).

## Testing
- `runitems.test.ts`: new item; up; slip with right answer; re-asked gate (miss then right) uses before/after boxes; both gates asked fold into one entry; order new/up/slip/same then first-asked; unanswered rows ignored; meaning mode; words and loanwords.
- End screen: layout fits 16 rows at 390×844 without scroll; scroll clamp for 30.
- Progress: group toggle; level-row hit test; drag is not a tap; level page rows and order; locked level dim; Back keeps scroll.
- Renders at 390×844: end screen (good run, run with slips, new items, long list scrolled, compact 390×700), progress view with a past group expanded, level page (current, learned, locked), study card opened from the level page.

## Boundaries
- Always: keep the progress save format; `npm run check` green; commit and push each slice.
- Ask first: changing the level card, the rules, SRS, or what counts as learned.
- Never: delete the owner's stored data (old session-log keys stay untouched).

## Success criteria
- Tests above pass; `npm run check` passes; deploy green.
- On the phone (checkpoint): after a run, the list says what was met and what moved; Kanji 1's items open in two taps from the start screen; an item's study card opens from there.

## Out of scope
Per-run history across sessions; stats or charts; search; editing stages by hand; changes to the level card.

## Open questions
- None blocking. Row wording ("M Met → Recalled · R New → Met") is judged on the phone.
