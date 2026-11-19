# Intent: our own stories

Status: confirmed by the owner, 2026-11-20, after an interview. Epic: `docs/ideas/useful-japanese.md` (round 3). Idea: `docs/ideas/own-stories.md`. Spec: `docs/specs/SPEC-own-stories.md`.

## Statement of intent
- **Outcome:** a story dictionary in this repo, separate from the game code: our own part names and, for the early levels first (growing as the owner goes), a meaning story and a reading story. The study card shows ours instead of WaniKani's.
- **Authoring:** an LLM writes it ahead of time, in batches. A judge on a different model checks each entry: it makes sense (parts, meaning, reading fit the kanji), and it isn't too close to WaniKani, compared against the owner's WaniKani library fetched by a dev-only script into `.data-cache` (never committed), with a cheap text-similarity pass first.
- **Review:** the owner reviews a handful from the first levels at the checkpoint, then flags stories while playing: a **flag** button next to the study card saves the kanji (optional note) to the synced save; a script lists flags for the next rewrite pass.
- **User:** the owner first, then anyone they share the game with: no token, no account.
- **Why now:** WaniKani's renewal is 2027-03-14, and the game should be shareable without WaniKani.
- **Success:** the owner plays their next levels on the phone without missing WaniKani's stories; the judge passes every entry; nothing in the dictionary is derived from WaniKani's data. Part names may overlap with WaniKani's.
- **Constraint:** the dictionary is public once it ships (it is in the game bundle), so it is our own text. WaniKani's library is only ever compared against locally.
- **Out of scope:** word stories (今日, 一人); removing the WaniKani token, fetch and mode (backlog: `docs/ideas/remove-wanikani.md`); overall progress (next round).

## Decisions (and why)
| Decision | Reason |
|---|---|
| Our stories, not a kept WaniKani cache | The owner wants to share the game and not rely on WaniKani. |
| Overlap in part names is fine | Plain names (mouth for 口) aren't ownable; the line is the stories' text and copying WaniKani's list. Names come from open data or our own choice, never from WaniKani's data. |
| LLM writer, judge on a different model | 4,000+ stories by hand isn't realistic before February; a second model catches what the writer can't see in its own work. |
| Judge compares against the owner's WaniKani library | A judge from memory can't tell whether a story is WaniKani's; side by side makes "too close?" concrete. Same scratchpad-only pattern as round 2. |
| Early levels only, grow as the owner goes (changed 2026-11-20) | A renamed part or sound keyword ripples into every story using it; keep few stories ahead until names settle. Word stories later. |
| Flag button on the study card | Bad stories are found on the phone mid-session; one tap, nothing lost. |
| WaniKani code removal is a separate round | Owner's call: keep this round to the dictionary. |
