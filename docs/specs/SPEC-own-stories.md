# Spec: our own stories

Status: 2026-11-20. Intent: `docs/intent/own-stories.md`. Epic: `docs/ideas/useful-japanese.md` (round 3). Tasks: `tasks/todo-own-stories.md`.

**Extends** `docs/specs/done/SPEC-stories.md`, `SPEC-reading-stories.md` and `SPEC-compound-stories.md` (the WaniKani study card): where our dictionary has a kanji, the card shows ours instead. The WaniKani path stays, untouched, for kanji the dictionary doesn't have yet; removing it is a later round.

## Objective
A story dictionary in `dictionary/`, kept separate from the game code: our own name for every kanji part, plus a meaning story and a story per main reading for every kanji in our levels. An LLM writes it ahead of time in batches. A judge on a different model checks every entry for sense and for closeness to WaniKani, comparing it side by side with the owner's WaniKani library, which is fetched locally and never committed. The game bundles the dictionary (lazy-loaded) and shows it on the study and pause cards, in both modes, with no token. A flag button on each kanji card sends "this story is bad" (plus an optional note) to Supabase, and a script lists the flags for the next rewrite pass.

## User stories
- As a player with no WaniKani account, I open Study after a run and every kanji card shows its parts with names, a meaning story and a story for each reading I was shown.
- As the owner, I tap **Flag** on a card whose story doesn't work, optionally type why, and it reaches the repo's rewrite list without my writing it down.
- As the owner, at my desk, I go through part names, sound keywords and a sample of each level's stories on a review page: ✓, or ✗ with a note, and I fix a name or keyword by typing it. My notes come back as rewrites in the next pass.
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
- Reading story: 1–3 sentences, 60–450 characters. Ties the meaning to the reading's sound, using the `sounds.json` keyword where there is one, and spells the reading in `<reading>` kana. `kun` stories may use the kanji's okurigana word (休む).
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
- `npm run stories:overlap -- <levels>`: for each of our entries with a WaniKani counterpart, a text-similarity score (shared word 3-grams and shared rare content words, ignoring the kanji's glosses, readings and part names) → `.data-cache/stories/overlap-NN.txt`, sorted, with anything over the threshold marked **suspect**. (D3: the score is a hint, not a gate. `close` fails were rephrased scenes scoring 0.08–0.14, so the judge compares every entry with WaniKani's side by side, suspect or not.) Also compares `sounds.json` keywords and `parts.json` names against WaniKani's (name overlap is listed, not failed).
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

## Review page (added 2026-11-20, intent `docs/intent/story-review.md`)
The owner reviews the dictionary at a desk on a private claude.ai page, not by playing. The page never calls an LLM and shows no WaniKani text; the orchestrator seeds it, reads the verdicts back and runs the rewrites. `dictionary/` stays the only thing the game reads.

- **Source:** `tools/review/index.html` (committed, one self-contained page), published with the Artifact tool, with the `db` and `user` capabilities. The link goes in the task list header (`Review tool: <url>`).
- **Data (the page's database):**
  - `items/<id>`, written by the orchestrator only. Ids are ASCII (the database allows only `A-Za-z0-9_-.~:@+`): `part-<hex>`, `sound-<hex>-<hex>…`, `story-<hex>`, codepoints in lowercase hex (`story-6298` for 折); `key` holds the glyph or kana. Fields: `kind` (`part`/`sound`/`story`), `key`, `level` (stories), `pass` (1, then +1 per rewrite), `why` (`all`, `judge-fail`, `random`, `extra`), `judge` (first-pass verdict: `pass`/`wrong`/`weak`/`close`, plus the judge's reason for `wrong`/`weak` only; `close` reasons can quote WaniKani and are never shown), and the content: part `name`, glyph, uses (kanji in our levels, up to 8); sound `keyword`, `note`, uses; story `glosses`, main `on`/`kun`, parts with names, `meaning`/`on`/`kun` texts.
  - `reviews/<id>`, written by the page (the owner). Fields: `kind` and, for stories, `level` (so the page can query reviews per kind and level, 1,000 per query), `pass` (the item pass it reviews), per field (`name`/`keyword` for parts and sounds; `meaning`/`on`/`kun` for stories) a `verdict` (`ok`/`work`) and `note`, plus `edit` (new name or keyword, parts and sounds only), `at`. A review whose `pass` is below the item's shows as "to review" again, with the old note shown.
- **Layout (desk, dense):** tabs **Parts**, **Sounds**, **Stories**, each a table, one row per item. Filter by level (stories) and status (to review / ok / needs work / all), counters per tab ("41 of 237 reviewed, 6 need work").
  - Parts row: glyph (large), name (editable inline), uses as kanji chips, ✓ / ✗ + note.
  - Sounds row: kana, keyword (editable inline), note, uses, ✓ / ✗ + note.
  - Stories row: kanji (large), glosses and readings, parts with names, then one cell each for meaning, on, kun: the text with tags rendered (part, kanji, reading colours as on the card), a ✓ / ✗ per cell and a note field that opens on ✗. A "why" tag (judge fail: weak, random…) per row.
  - Keyboard: `j`/`k` next/previous row, `a` approves the row's to-review fields, `x` opens the first note, `Esc` closes. Saves on each verdict, edit or note blur; a failed save shows on the row and keeps the input.
  - "Show the rest of the level" lists a level's unsampled stories for browsing (seeded with `why: extra`, verdicts optional).
- **Sample (stories):** pilot levels Kanji 5–6: every kanji (`all`). Later levels: every kanji the judge failed at least once or marked close (`judge-fail`), plus 10 random others (`random`, seeded by level so a re-run picks the same). Rule: more than 2 `random` stories in a level with a field marked ✗ → the whole level is seeded for review and `STYLE.md` is revisited before the next batch.
- **Scripts (`scripts/stories/review.ts`, `npm run stories:review -- <cmd>`):**
  - `seed <parts|sounds|levels>`: writes the items for that scope to `.data-cache/stories/review/seed-<scope>-NN.json`, each a JSON array of at most 50 `ArtifactData` batch writes (`{op: "set", collection: "items", doc_id, data}`, under 1 MiB); with `--versions <dir>` (an `items` listing saved with `out_dir`) it bumps `pass` for items that already exist, and adds `if_version` from `--version-list <file>` (the listing's tool output saved as text; saved files carry no version); applying the sample rule; reads judge files when present (no judge file → `random` only, with a warning).
  - `apply <dir>` (the `reviews` listing, saved by the orchestrator with `out_dir`, one JSON file per document): edits to `parts.json`/`sounds.json` (validated: unique, 1–3 words); a renamed part's `<part>` text is replaced in every story using it, and those stories are listed for the writer to re-read; ✗ notes go to `.data-cache/stories/notes-<scope>.json`, the writer's rewrite input (the note and our current text only). Prints counts per scope and the random-miss count per level.
- **Loop:** seed → owner reviews → `apply` → rewrites through the writer/judge loop (owner notes beside the judge's reasons) → `stories:check`, `stories:overlap` → commit → re-seed changed items with `pass + 1`. Owner edits to names and keywords go through `stories:check` and `stories:overlap -- --names` too. Story batches are committed after the judge, as before; the owner's review feeds the next pass and doesn't block the game.

## Part notes (added 2026-11-20, intent `docs/intent/part-notes.md`)
Each part gets a one-line "why it fits" note, and a part named after its history instead of its shape is renamed to something you can see.

- **Data:** `parts.json` entries become `{ "name": "village", "note": "..." }`. `note` is required for every part: one sentence, 20–120 characters, saying what in the glyph the name points at ("Three short strokes stacked like water drops"). Our own text, never from WaniKani.
- **Names you can see (`STYLE.md`):** a part's name says what its shape looks like. A name that only holds through history or etymology (⻏ "village", the right-hand 阝 from 邑) is replaced by a visible shape. Exception: a part that is itself a kanji in our levels keeps that kanji's meaning (as now); its note says how the shape shows it, or that it is the kanji itself. Names stay unique and 1–3 words.
- **Pass (once, content):** a writer on **opus** reads `STYLE.md`, `parts.json`, each part's uses and the owner's part reviews so far (verdict and note, from the page); writes every note and proposes renames, each with a one-line reason, to `.data-cache/stories/renames.json` (`[{ part, from, to, why }]`). Owner ✗ notes on a part are binding input. A judge on **sonnet** checks every note (true to the glyph) and every rename (visible, unique, not a WaniKani radical name match flagged by `stories:overlap -- --names`).
- **Ripple:** renames go through `stories:review -- rename <renames.json>`, which uses the same code as `apply`'s edit path: `parts.json` updated, `<part>` text replaced in every story using it, touched stories listed. The writer re-reads each touched story (Kanji 5–6) so the sentence still reads; the judge re-checks them.
- **Re-seed:** `seed parts` puts `note` and, for a renamed part, `was` (the old name) on the item. `--bump <ids file>` bumps `pass` only for the listed ids (renamed parts, rewritten stories); the rest are written with their current `pass`, so the owner's verdicts on them stand.
- **Page:** the Parts row shows the note under the name (like the Sounds row's note) and, when `was` is set, "was: village" beside the name.
- `stories:check` fails a part with no `note` or a note out of band.

## Files
```
dictionary/README.md, STYLE.md, parts.json, sounds.json, stories/kanji-NN.json   (new)
scripts/stories/prep.ts, check.ts, wk.ts, overlap.ts, flags.ts, review.ts          (new)
tools/review/index.html      → the review page (new)
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
`npm run stories:prep -- <levels>`, `stories:check`, `stories:wk`, `stories:overlap -- <levels>`, `stories:flags`, `stories:review -- seed|apply|rename` (`seed` also takes `--bump <ids.json>` and `--renames <renames.json>`), plus `npm run check`.

## Testing
- Validator unit tests on fixtures (each rule fails on a broken fixture); the validator runs over the committed dictionary in `npm test`.
- Overlap scoring on tiny fixtures (copied text scores high, unrelated low, shared glosses ignored).
- `studyCards`: ours beats WaniKani; parts with names; reading blocks by presented label; missing reading → none line; meaning mode.
- Flag queue: save, load, bad JSON ignored, push removes sent, push failure keeps.
- Browser: study card with our story and the flag form at 390×844.
- Part notes: `check` fails a missing or out-of-band note; `rename` ripples like an `apply` edit; `seed --bump` bumps only listed ids; page shows note and `was`.
- Review: `seed` sample rule (all for pilot levels, judge fails + 10 seeded random, no judge file → random only); `apply` on fixtures (rename ripples into `<part>` text, duplicate or 4-word name rejected, notes file has no WaniKani text); page at 1280×800 renders the three tabs from a fixture listing.

## Boundaries
- Always: `npm run check` before commit; push after each slice; the writer works only from `STYLE.md`, `parts.json`, `sounds.json` and the prep input; every committed entry has a judge pass; log batch counts in the task list.
- Ask first: changing the dictionary file format after the first checkpoint.
- Never: commit or bundle anything from WaniKani (text, names list, similarity reports, judge files), or put it on the review page; let the writer read `.data-cache/stories/wk-library.json`, `overlap-*` or the judge's WaniKani excerpts; change gates, levels, the save format or the WaniKani path's behaviour for kanji without our story.

## Success criteria
- **Early levels only** (owner, 2026-11-20): the owner's current levels first (Kanji 5–6), then pairs of levels about one ahead of the owner; Kanji 1–4 later; later levels are written as the owner nears them, so a renamed part or keyword ripples into few stories. Every committed entry passes `stories:check` and has a judge `pass`; every part has a name; no unresolved overlap suspect.
- First checkpoint (Checkpoint D, moved to the review page 2026-11-20): Kanji 5–6 done and deployed; the owner reviews all parts, all sounds and all of Kanji 5–6 on the review page.
- Review page: all parts and sounds take the owner about an hour; a later level's sample about 15 minutes; notes come back as rewrites in the next pass.
- Main chunk grows ≤ 10 KB; a level's stories load in under 300 ms on the phone after the first study open.
- The flag round trip works: flag on the phone → `npm run stories:flags` lists it.
