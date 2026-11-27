# Intent: show overall progress, finish every level

Status: confirmed by the owner, 2026-11-28, after a second interview (revises the 2026-11-27 version: learned at box 3, words count, 8 kanji per level, groups). Idea: `docs/ideas/overall-progress.md`. Spec: `docs/specs/SPEC-overall-progress.md`. Tasks: `tasks/todo-overall-progress.md`.

## Statement of intent
- **Outcome:** small levels you finish completely, grouped into named stages, and one view of where you are overall.
  - **Learned (live):** a kanji or word is learned while its meaning **and** its reading are each at box ≥ 3 (right three times running). Kana and loanwords have one gate: that gate at box ≥ 3. A miss drops the box to 0, so the item stops counting until it is re-learned.
  - **Box names:** each box gets a short name for what it proves (draft: New, Met, Recalled, Learned, Strong, Solid). Names say "right N times running", never a time promise.
  - **Levels of 8 kanji**, same order: Kanji 1–267, each with its ~8 words and about one loanword. The next level unlocks when every kanji and word of the current level is learned at once. Unlocks never go back.
  - **Old items stay fresh** through what exists: warm-ups (box ≥ 3, every unlocked level) and low-box weighting re-test and re-teach slipped items. No new mechanism.
  - **Groups:** equal chunks of 25 levels (200 kanji), named for what you can do by the end (Claude drafts, owner reviews). The overall view shows past groups collapsed and the current one open.
  - **Words appear** once their kanji are learned.
- **User:** the owner, daily, Built-in mode.
- **Why now:** epic round 4 (`docs/ideas/useful-japanese.md`). The February WaniKani assessment needs a yardstick, and the end card reads as wrong (unlock at a hidden 80%; readings and words not counted).
- **Success:** the end card's numbers add up; a level takes a few days (checked at the checkpoint; size is a one-line change); the overall view gives a coverage % to set against WaniKani in February.
- **Constraint:** level numbers move (fine). No automatic save conversion: the owner sets their level with the picker. Rule changes live in `core/`, tested.
- **Out of scope:** coverage-based groups, JLPT share, time-based review, sticky learned, save conversion, WaniKani mode beyond sharing the kanji rule, the kanji order, sound and feel, SRS weights.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Learned = meaning and reading each at box ≥ 3 | Owner: finishing a level should mean you can read its Japanese with good recall. Box 3 is already where readings open and warm-ups start. |
| Live, not sticky | Owner: a slipped item should be re-learned; level size, not stickiness, keeps unlocks reachable. Discussed: live makes counts able to drop; accepted. |
| Words count toward the level | Owner: a kanji you can't read inside its words isn't learned. Replaces the 2026-11-27 "words stay out". |
| 8 kanji per level (267 levels) | 3 running × meaning and reading × kanji and words ≈ 100 right answers per level at 8; 15 would be ~3× the old pace. 8 is a trial, checked at the checkpoint. |
| Equal groups of 25 levels | Owner: grouping makes 267 levels readable; equal chunks are fine, "not too stressed about perfect tracking". Coverage-based groups were offered and declined. |
| Unlock at 100% | Owner (2026-11-27): a level should be finished; the 80% rule was never visible. |
| No save conversion | Owner: "I'm happy to manually drop it somewhere and play through." |
| Coverage over JLPT | Owner: coverage is the yardstick; JLPT is WaniKani's. |
