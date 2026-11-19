# Spec: our own stories

Status: 2026-11-20. Intent: `docs/intent/own-stories.md`. Epic: `docs/ideas/useful-japanese.md` (round 3). Tasks: `tasks/todo-own-stories.md`.

**Extends** `docs/specs/done/SPEC-stories.md`, `SPEC-reading-stories.md` and `SPEC-compound-stories.md` (the WaniKani study card): where our dictionary has a kanji, the card shows ours instead. The WaniKani path stays, untouched, for kanji the dictionary doesn't have yet; removing it is a later round.

## Objective
A story dictionary in `dictionary/`, kept separate from the game code: our own name for every kanji part, plus a meaning story and a story per main reading for every kanji in our levels. An LLM writes it ahead of time in batches. A judge on a different model checks every entry for sense and for closeness to WaniKani, comparing it side by side with the owner's WaniKani library, which is fetched locally and never committed. The game bundles the dictionary (lazy-loaded) and shows it on the study and pause cards, in both modes, with no token. A flag button on each kanji card sends "this story is bad" (plus an optional note) to Supabase, and a script lists the flags for the next rewrite pass.

## User stories
- As a player with no WaniKani account, I open Study after a run and every kanji card shows its parts with names, a meaning story and a story for each reading I was shown.
- As the owner, I tap **Flag** on a card whose story doesn't work, optionally type why, and it reaches the repo's rewrite list without my writing it down.
- As the owner, I can trust nothing in `dictionary/` was copied or derived from WaniKani: a judge compared every entry against WaniKani's own and passed it.

## Dictionary (`dictionary/`, committed)
- `README.md`: what it is, how it's made (writer, judge, checks), that it is our own text, and how to add or fix an entry.
- `STYLE.md`: the writer's style guide (below). The judge reads it too.
- `parts.json`: `{ "<part glyph>": { "name": "person" } }` for every component in `src/data/kanji.json` (237 today). Names come from open data (KANJIDIC2 or Kangxi radical meanings) or our own choice, never from WaniKani's data; overlap with a WaniKani name is fine. A part that is itself a kanji in our levels uses that kanji's first gloss unless the style guide says otherwise. Names are unique (no two parts share a name) and short (1–3 words).
- `sounds.json`: `{ "<hiragana sound>": { "keyword": "show", "note": "..." } }`, one English sound-alike keyword per common on'yomi (しょう, こう, じん…) that reading stories reuse, so a sound always calls up the same image. Our own keywords: the judge rejects WaniKani's recurring reading characters.
- `stories/kanji-NN.json`, one file per kanji level, named by the level as the player sees it (`kanji-01.json` is game level 2, "Kanji 1"):
  ```json
  { "level": "Kanji 1",
    "kanji": {
      "休": { "meaning": "A <part>person</part> leans on a <part>tree</part>…",
              "on": "…<reading>きゅう</reading>…",
              "kun": "…<reading>やす</reading>…" } } }
  ```
  - `meaning` always; `on` when the kanji has a main on'yomi (`k.on`), `kun` when it has a main kun'yomi (`k.kun`). These are the readings gates show (`mainReadings`).
  - Markup: `<part>`, `<kanji>`, `<reading>`, `<ja>`, `<em>` only. `<kanji>` wraps the kanji's meaning word; `<reading>` wraps the kana reading.
- Writer working notes, judge verdicts, WaniKani text and similarity reports live in `.data-cache/stories/`, never committed.

### Style guide (`STYLE.md`, summary)
- Meaning story: 1–4 sentences, 120–600 characters. Names every part (by its `parts.json` name, in `<part>`) and lands on the meaning (first gloss, in `<kanji>`). Concrete, visual, a little absurd; no puns that need the reader to know WaniKani.
- Reading story: 1–3 sentences, 80–450 characters. Ties the meaning to the reading's sound, using the `sounds.json` keyword where there is one, and spells the reading in `<reading>` kana. `kun` stories may use the kanji's okurigana word (休む).
- Build on earlier levels: when a part is an earlier kanji, call it by that kanji's name; reuse images from earlier stories where natural.
- Plain English, no cultural knowledge needed, nothing offensive, nothing that only works in American English.
- Written from the inputs only. The writer never reads WaniKani's library or the judge's comparison files.

## Pipeline (dev-only, `scripts/stories/`)
- `npm run stories:prep -- <levels>` (e.g. `2-4`, game levels): writes one input file per level to `.data-cache/stories/in/`: each kanji's glosses, main on/kun, all readings, components with their `parts.json` names, the `sounds.json` keyword for its on'yomi, the level words (`words.json`) that use it, and the kanji taught before it. The writer works from these files only.
- **Writer:** a subagent on **opus** reads `STYLE.md` and the input files and writes `dictionary/stories/kanji-NN.json` (2 levels per batch). Parts and sounds are written the same way, once.
- `npm run stories:check [-- <levels>]`: the validator, also run inside `npm test` over every committed file:
  - JSON shape; level file names match their `level`; every kanji of a written level is present, and no others.
  - `on`/`kun` present exactly when the kanji has that main reading; `<reading>` text equals the reading's hiragana (kun: the base, okurigana optional).
  - Only the allowed tags; tags balanced; lengths in band.
  - Every `<part>` name is in `parts.json`; for a kanji with components, each component's name appears (warning, not error, for a component the writer judged invisible, listed in the report).
  - `parts.json` covers every component; names unique.
- `npm run stories:wk`: reads `WANIKANI_TOKEN` from `.env.local` and writes the owner's WaniKani library (kanji meaning and reading mnemonics, radical names) to `.data-cache/stories/wk-library.json`, reusing `src/wanikani/` parsing. Dev-only, never committed, never bundled.
- `npm run stories:overlap -- <levels>`: for each of our entries with a WaniKani counterpart, a text-similarity score (shared word 3-grams and shared rare content words, ignoring the kanji's glosses, readings and part names) → `.data-cache/stories/overlap-NN.txt`, sorted, with anything over the threshold marked **suspect**. Also compares `sounds.json` keywords and `parts.json` names against WaniKani's (name overlap is listed, not failed).
- **Judge:** a subagent on **sonnet** (a different model from the writer) reads `STYLE.md`, the input file, our entries, the overlap report and the matching WaniKani entries, and writes `.data-cache/stories/judge-NN.json`: per kanji `pass` or `fail` with a reason in one of: `wrong` (parts, meaning or reading don't fit the kanji), `weak` (not memorable or confusing), `close` (too near WaniKani's story: same scene, same twist or same phrasing). Every overlap suspect needs an explicit verdict.
- **Rewrite loop:** the writer rewrites the failed entries from the judge's reasons only (never WaniKani's text); the judge re-checks them; at most 3 rounds, then the orchestrator rewrites by hand. A batch is done when `stories:check` passes, every entry has a judge `pass`, and no suspect is left without a `pass`.
- Per batch, the task list logs: entries, first-pass fails by reason, suspects, rounds, final pass. Counts only, no WaniKani text.

## Game
- **Loading:** `src/game/dictionary.ts` loads the stories with `import.meta.glob("/dictionary/stories/*.json")` (lazy, one chunk per level file) plus `parts.json`. Loaded when the study screen or pause card first needs a level, cached after. The main chunk grows by at most 10 KB.
- **Card (`src/core/study.ts`):** a pure function turns a dictionary entry into a `Story`-like card data, so `kanjiCard` picks **ours first**, then the WaniKani library, then today's card. With ours:
  - The parts row shows each component with its name (like today's radical chips, no images).
  - "Meaning story" block: our meaning story.
  - One "Reading story: <label>" block per presented reading (the same `presented` rule as today): `on` for the on'yomi label, `kun` for the kun label; a presented reading that isn't a main reading gets today's "no story" line.
  - Headings say "story", not "mnemonic", for our entries.
  - `part` tag shown in the radical colour.
- Works in both modes (meaning mode shows our stories too; it never fetches WaniKani).
- **Flag:** each kanji card with our story has a **Flag** button. A tap opens an inline note field (optional, 200 characters) with **Send** and **Cancel**. Send stores `{ kanji, level, note, at, build }` in a local queue (`kanji-runner:story-flags:v1`) and the button reads **Flagged**. The queue is pushed to Supabase table `story_flags` when signed in (on Send and after each successful sync push); sent flags leave the queue. Signed out or offline: the flags wait in the queue. Never blocks or throws.
- `supabase/story-flags.sql`: `story_flags (id bigint identity, user_id uuid default auth.uid(), kanji text, level text, note text, build text, created_at timestamptz default now(), resolved_at timestamptz)`, RLS own-insert/own-select. The owner runs it once in the Supabase SQL editor.
- `npm run stories:flags [-- --resolve <id,…>]`: reads unresolved flags with the service-role key from `.env.local` and prints id, kanji, level, note, date and our current story; `--resolve` marks them resolved after a rewrite pass.

## Files
```
dictionary/README.md, STYLE.md, parts.json, sounds.json, stories/kanji-NN.json   (new)
scripts/stories/prep.ts, check.ts, wk.ts, overlap.ts, flags.ts                    (new)
src/game/dictionary.ts       → lazy loader (new)
src/core/study.ts            → our entries first on the card
src/core/mnemonic.ts         → `part` tag
src/game/ui/study.ts         → parts with names, story headings, Flag button
src/storage/flags.ts         → local flag queue (new)
src/sync/flags.ts            → push queue to story_flags (new)
supabase/story-flags.sql     (new)
tests/data/stories.test.ts   → validator over committed dictionary + fixtures
```

## Commands
`npm run stories:prep -- <levels>`, `stories:check`, `stories:wk`, `stories:overlap -- <levels>`, `stories:flags`, plus `npm run check`.

## Testing
- Validator unit tests on fixtures (each rule fails on a broken fixture); the validator runs over the committed dictionary in `npm test`.
- Overlap scoring on tiny fixtures (copied text scores high, unrelated low, shared glosses ignored).
- `studyCards`: ours beats WaniKani; parts with names; reading blocks by presented label; missing reading → none line; meaning mode.
- Flag queue: save, load, bad JSON ignored, push removes sent, push failure keeps.
- Browser: study card with our story and the flag form at 390×844.

## Boundaries
- Always: `npm run check` before commit; push after each slice; the writer works only from `STYLE.md`, `parts.json`, `sounds.json` and the prep input; every committed entry has a judge pass; log batch counts in the task list.
- Ask first: changing the dictionary file format after the first checkpoint.
- Never: commit or bundle anything from WaniKani (text, names list, similarity reports, judge files); let the writer read `.data-cache/stories/wk-library.json`, `overlap-*` or the judge's WaniKani excerpts; change gates, levels, the save format or the WaniKani path's behaviour for kanji without our story.

## Success criteria
- **Early levels only** (owner, 2026-11-20): the owner's current levels first (Kanji 5–6), then pairs of levels about one ahead of the owner; Kanji 1–4 later; later levels are written as the owner nears them, so a renamed part or keyword ripples into few stories. Every committed entry passes `stories:check` and has a judge `pass`; every part has a name; no unresolved overlap suspect.
- First checkpoint: Kanji 5–6 done, deployed; the owner reviews a handful and plays with our stories on the phone.
- Main chunk grows ≤ 10 KB; a level's stories load in under 300 ms on the phone after the first study open.
- The flag round trip works: flag on the phone → `npm run stories:flags` lists it.
