# Triage log

One row per owner request, written by the `triage` skill (`.claude/skills/triage/`). Overrides show where the rules need tuning; turn them into eval cases.

| Date | Request | Route | Reason | Override |
|---|---|---|---|---|
| 2026-11-15 | Village keeps coming up as 'ri' | fix | One gloss override for 里, clear outcome | |
| 2026-11-15 | 厘 shows 'rin' (follow-up) | fix | One gloss override for 厘 | |
| 2026-11-15 | Trial HTML review page for SPEC-straight-fire (claude.ai link) | doc | Review view of an existing spec, no code | |
| 2026-11-15 | Make spec and checkpoint review pages part of the flow | doc | Docs, AGENTS.md and triage flow line only | |
| 2026-11-15 | WaniKani reading story covers only one reading | idea | Owner asked for a backlog entry only | |
| 2026-11-15 | Every fix and feat bumps the version (CI guard) | fix | One script, deploy step, rule lines; no game code | |
| 2026-11-15 | Triage idea route must add the backlog entry | doc | Skill text only | |
| 2026-11-15 | Install the webpage as an app on the phone | idea | Owner asked for a backlog entry only | |
| 2026-11-15 | Implement next task: no task list, top backlog idea = story-reading mismatch | sdd | Open design questions; touches reading choice in core | |
| 2026-11-15 | SDD skill: no stop after spec; continue to tasks + spec page | doc | Skill text only | |
| 2026-11-15 | Study button does nothing when tapped | fix | Touch click hit the overlay Back button; one-line fix | |
| 2026-11-15 | On'yomi stories from compound vocabulary | idea | Owner asked for a backlog placeholder | |
| 2026-11-15 | Compound words as gates | idea | Owner asked for a backlog placeholder | |
| 2026-11-15 | Re-order the backlog by Claude's priority | doc | Backlog order only | |
| 2026-11-17 | Align standard progression with WaniKani order, readings, compounds | idea | Owner asked to refine an idea; copying WK order is out of bounds | |
| 2026-11-17 | Fold compound unlocks into compound-word-gates; grade blend as new idea; drop wk-shaped-progression | doc | Idea and backlog edits only | |
| 2026-11-17 | Add reading-choice idea; re-prioritise backlog | idea | Owner asked for an idea entry and backlog order | |
| 2026-11-17 | On'yomi stories already in progress: move to In progress in backlog | doc | Backlog edit only | |
| 2026-11-17 | Start backlog #1: on'yomi stories from compound vocabulary | sdd | New data (compound vocab), storage change, reverses a spec rule | |
| 2026-11-17 | Own stories (drop WaniKani), sound effects, soundtrack, overall progress | idea | Four owner ideas for the backlog | |
| 2026-11-17 | Re-prioritise whole backlog (keep in-progress) | doc | Backlog order only | |
| 2026-11-17 | Make repo private, keep free hosting; add and re-prioritise | idea | Owner idea for the backlog | |
| 2026-11-17 | Start next round: backlog #1, teach the most useful reading first | sdd | Data pipeline change across all kanji; progress/save impact; open questions | |
| 2026-11-17 | Write up drop-WaniKani goal and useful-words epic; fold two ideas; reorder backlog | idea | Goal and backlog docs only | |
| 2026-11-17 | Move overall progress up; make #5 the assess-against-WaniKani checkpoint | doc | Backlog order only | |
| 2026-11-17 | Start next round: Word gates (epic round 1) | sdd | New data source (JMdict), save/unlock logic, many items; epic says each round needs an interview | |
| 2026-11-17 | Start next round: Useful-words order (epic round 2) | sdd | Reorders all kanji levels; new data sources, weighting judgment, save/progress impact | |
| 2026-11-20 | Drop the one-kanji word quota (行 ぎょう, 下 もと in Kanji 1) | fix | Owner decided at Checkpoint U; one picker rule | |
| 2026-11-20 | Start next round: Show overall progress (epic round 3) | sdd | New UI concept, coverage/JLPT yardstick choices; idea needs an interview | |
| 2026-11-20 | Swap backlog: own stories before overall progress | doc | Stories are the only blocker to dropping WaniKani; backlog order only | |
| 2026-11-20 | Remove all WaniKani code from the game (separate from own stories) | idea | Owner split it out of the own-stories round | |
| 2026-11-20 | Story review tool outside the game (approve/refine parts, sounds, stories) | sdd | New tool and review workflow; changes how round 3 is gated | |
| 2026-11-20 | Review page: short "why it fits" explainer per part/sound/story | sdd | New field generated for ~400 items, plus seed and page changes | |
| 2026-11-20 | Same shape listed as two parts (⻖ stairs / ⻏ pennant) should be one part | fix | One data merge plus a checker exception; inside the open part-notes work | |
| 2026-11-20 | Review page: save buttons optimistically | fix | Page-only, clear outcome | |
| 2026-11-20 | Run another round on parts and sounds from owner notes so far | sdd (in round) | Continues Checkpoint D review inside the own-stories round; vowel rule added to STYLE | |
| 2026-11-20 | Parts named by their own meaning (spear, pig) are settled; hide them from review | fix | One flag in parts.json, seed skips it, items removed | |
| 2026-11-20 | Show alternative names on the review page | fix | Optional alts field, seed and page chips | |
| 2026-11-21 | Options for the remaining parts and sounds; sounds tab says 0 left with r-sounds unapproved | fix | Data alts plus a one-line tab count fix | |
| 2026-11-21 | Alts for every part on the review page | sdd (in round) | Continues the Checkpoint D part review; data only, alts field already exists | |
