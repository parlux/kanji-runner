# Intent: WaniKani stories in Built-in mode

Status: confirmed by the owner, 2026-11-12, after an interview. Extends `docs/intent/kanji-runner.md`. Idea: `docs/ideas/done/wk-stories-builtin.md`. Spec: `docs/specs/done/SPEC-stories.md`, tasks: `tasks/done/todo-stories.md`.

## Statement of intent
- **Outcome:** on the study screen in Built-in mode, every kanji card shows WaniKani's meaning and reading stories (mnemonics), and the "parts" row becomes WaniKani's radicals with their WaniKani names (an image when a radical has no character).
- **User:** the owner. They follow Built-in mode's order and pace and use WaniKani only as a library of stories.
- **Why:** the owner likes Built-in mode's progress and pace, but doesn't want to invent their own stories for each kanji's meaning and readings.
- **Success:** the owner misses a kanji in a Built-in run, opens Study, and reads its WaniKani stories, with the radical names in the stories matching the radicals on the card, whatever the owner's WaniKani level or progress.
- **Constraint:** stories are fetched with the owner's saved token (paid account, so all levels) and kept on the device only; never bundled or committed. With no token, or for a kanji WaniKani doesn't teach, the card looks exactly as it does today. Saving a token keeps you in Built-in mode.
- **Out of scope:** changing Built-in mode's kanji order or pace; vocabulary stories; hints; fixing a reading story when WaniKani teaches a different reading from the one Built-in shows.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Stories for every kanji WaniKani has, not only taught ones | The owner isn't progressing on WaniKani; it's a story library, and Built-in is the course. |
| WaniKani radicals with names replace the "parts" row | WaniKani stories are written around its own radical names; without them the stories refer to shapes you can't see. |
| No token or no story → today's card, no note | A "no story" note on many cards would be noise. |
| Saving a token stays in Built-in | The owner adds the token for stories; being moved to WaniKani's list and pace is what they don't want. The mode switch stays the only way in. |
| WaniKani mode also gets the radicals row | Same card, same reason; no extra work. |
