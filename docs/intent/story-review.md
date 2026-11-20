# Intent: a review page for the story dictionary

Status: confirmed by the owner, 2026-11-20, after an interview. Round: own stories (epic round 3), added before Task D7. Spec: `docs/specs/SPEC-own-stories.md`, section "Review page". Tasks: `tasks/todo-own-stories.md`.

## Statement of intent
- **Outcome:** a desk review page for the dictionary, separate from the game. The owner goes through LLM-written part names, sound keywords and stories in a dense table, approves or writes a note, and edits names and keywords directly. The orchestrator turns notes into rewrites with the writer/judge loop, then checks and commits them.
- **User:** the owner, at a desk. The orchestrator does all the generating and rewriting.
- **Why now:** reviewing by playing is too slow. The owner only sees whichever card comes up and can't compare stories side by side. That is what blocks round 3.
- **Success:**
  - All 237 parts and 179 sounds reviewed in about an hour, first, before more stories are written.
  - After that, a level's sample (stories the judge failed or flagged as close, plus about 10 random kanji) takes about 15 minutes.
  - Notes come back as rewrites in the next pass, with no deploy in between.
- **Constraints:**
  - The page never calls an LLM.
  - Owner edits pass the validator and the WaniKani overlap check before they are committed.
  - No WaniKani text on the page.
  - The committed files in `dictionary/` stay the only thing the game reads.
- **Out of scope:** generating or regenerating from the page; a phone-first layout; approving every story; game changes (the Flag button stays as the safety net); removing WaniKani; structured part data (KRADFILE's flat lists).

## Decisions (and why)
| Decision | Reason |
|---|---|
| Review outside the game | Playing only shows the cards a run happens to give you; no side-by-side, and a change needs a deploy. |
| Names and keywords first | A renamed part or keyword ripples into every story that uses it. |
| Sampled stories, not full approval | 2,100 kanji × 3 texts is ~35 hours of reading. Random picks measure whether the writer can be trusted; judge fails cover the known risks. Kanji 5–6 (the pilot) are read in full. |
| More than 2 random misses → whole level reviewed, `STYLE.md` revisited | A bad random sample means the writer, not one story, is off. |
| Notes for stories, direct edits for names and keywords | Names are one or two words, quicker to type than explain; story rewrites are the writer's job. |
| Desk, dense table | The owner reviews at a desk in one sitting. |
| Private claude.ai page, verdicts in its shared database | Nothing to deploy; the orchestrator seeds items and reads verdicts back directly. |
| Page doesn't call an LLM | No key in the browser, no extra cost; the orchestrator runs the loop. |
| Folded into round 3 before D7, Checkpoint D moves onto the page | It's what blocks the round. |
