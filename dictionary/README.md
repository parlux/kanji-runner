# Story dictionary

Our own memory stories for every kanji in the game: a name for every kanji part, a meaning story and a story per main reading. The game shows them on the study and pause cards. Spec: `docs/specs/done/SPEC-own-stories.md`.

## Files

- `STYLE.md`: the style guide the writer follows and the judge checks against.
- `parts.json`: `{ "<part>": { "name": "person" } }` for every component in `src/data/kanji.json`. Names are unique and short (1–3 words), from open data (KANJIDIC2, Kangxi radical meanings) or our own choice.
- `sounds.json`: `{ "<hiragana>": { "keyword": "cue", "note": "a pool cue" } }`, one English sound-alike per common on'yomi, reused by every reading story with that sound.
- `stories/kanji-NN.json`: one file per kanji level, named as the player sees it (`kanji-01.json` is "Kanji 1", game level 2). Per kanji `meaning`, plus `on` and `kun` when the kanji has that main reading. `on` or `kun` may be `null` to leave that story out on purpose (盲's kun めくら is a slur, owner 2026-11-26); the card then shows no story for it. Tags: `<part>`, `<kanji>`, `<reading>`, `<ja>`, `<em>`.

## How it's made

1. `npm run stories:prep -- <levels>` writes the writer's input files to `.data-cache/stories/in/` (`--parts`, `--sounds` for the shared names).
2. A writer (an LLM) reads `STYLE.md`, `parts.json`, `sounds.json` and the input files only, and writes the level files.
3. `npm run stories:check [-- <levels>]` validates shape, readings, tags, lengths and part names. It also runs in `npm test`.
4. `npm run stories:wk` fetches the owner's WaniKani library to `.data-cache/stories/` (never committed), and `npm run stories:overlap -- <levels>` scores each entry's similarity to WaniKani's; `--names` compares part names and sound keywords with WaniKani's radical names.
5. A judge on a different model reads our entries side by side with WaniKani's and passes or fails each (`wrong`, `weak`, `close`). Fails are rewritten from the judge's reason only.

All text here is our own. Nothing in this folder is copied or derived from WaniKani; the WaniKani library is used only by the judge, to make sure of that.

## Adding or fixing an entry

Edit the level file by hand or with the writer, keeping `STYLE.md`. Run `npm run stories:check -- <level>` and `npx prettier --write dictionary`, then `npm run stories:overlap -- <level>` and have the entry judged again before committing.
