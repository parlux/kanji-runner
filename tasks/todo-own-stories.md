# Tasks: our own stories (v1.7.0)

Spec: `docs/specs/SPEC-own-stories.md` (2026-11-20). Intent: `docs/intent/own-stories.md`. Epic: `docs/ideas/useful-japanese.md` (round 3). Started 2026-11-20. The owner approved going straight to the first checkpoint (no spec sign-off).
Checkpoint D: https://claude.ai/artifact/Pzt8idETzahrdN9ohvua6S (superseded: Checkpoint D moved to the review page, see Task R2)
Review tool: https://claude.ai/artifact/CNZAQt1csZLwyV29i5piR9
Review: https://claude.ai/artifact/8XjjrPPLSvPDR8dkBTgdst (review page addition; intent `docs/intent/story-review.md`, 2026-11-20).
Every task: `npm run check` passes before it is checked off. Never commit `.data-cache` or anything from WaniKani (text, names, overlap reports, judge files).

## Plan
- **Pipeline first.** D1 builds the format, validator, prep, WaniKani fetch and overlap check, so every story after it is checked the same way.
- **Shared vocabulary next.** D2 names the parts and the on'yomi sound keywords once, so every story uses the same names and images.
- **Pilot, then the card.** D3 writes Kanji 5–6 (the owner is on Kanji 5 and doesn't need Kanji 1–4) through the full writer/judge loop and tunes `STYLE.md` on what fails; D4 shows them on the card; D5 adds the flag.
- **Review page (added 2026-11-20).** Reviewing by playing was too slow. R1 builds the seed/apply scripts, R2 the desk review page; Checkpoint D happens there (all parts and sounds, then Kanji 5–6); R3 applies it. From D7 on, every batch gets a sampled review.
- **Then the owner's levels only.** D6 deploys: Checkpoint D, on Kanji 5–6. After it, D7 fixes flags and writes the next levels in pairs, about one level ahead of the owner; D8 ships 1.7.0. Kanji 1–4 are left for later (owner, 2026-11-20). Later levels are written as the owner nears them (owner, 2026-11-20: a renamed part or keyword ripples into every story that uses it, so keep few stories ahead until the names have settled).

### Content tasks (D2, D3, D7): run by the orchestrator
Not one implementer subagent: the orchestrator runs the loop per batch (2 levels):
1. `npm run stories:prep -- <levels>`.
2. Writer subagent, **opus**: reads `dictionary/STYLE.md`, `parts.json`, `sounds.json`, the prep files; writes the level files. Told it must not read `.data-cache/stories/wk-library.json`, `overlap-*` or `judge-*`.
3. `npm run stories:check -- <levels>` until clean; `npm run stories:overlap -- <levels>`.
4. Judge subagent, **sonnet**: reads `STYLE.md`, prep files, our entries, the overlap report and `wk-library.json`; writes `judge-NN.json`.
5. Fails go back to a writer with the judge's reasons only (no WaniKani text); re-judge; max 3 rounds, then fix by hand.
6. Commit the level files, log counts below, push. Independent batches may run in parallel; commits stay serial.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Stories too close to WaniKani (the writer model has read WaniKani) | High | Side-by-side judge on another model, similarity pre-pass, writer never sees WaniKani text; `close` fails rewritten from the reason only. |
| Stories wrong (part not in the kanji, wrong reading) | High | Validator checks readings and part names mechanically; judge checks sense; owner review and flags. |
| Weak, samey stories across 2,100 kanji | Med | Pilot (D3) tunes `STYLE.md` before scaling; sound keywords and part names give consistent building blocks. |
| Bundle bloat (2,100 × ~800 chars) | Med | Lazy chunk per level; main chunk cap +10 KB. |
| KRADFILE parts that aren't visible in the glyph | Med | Missing-part is a warning, listed; writer may skip an invisible part; judge checks. |
| Subagent cost and time for 70 levels | Med | 2 levels per batch, parallel batches after the pilot. |

### Task D1: Dictionary format, validator and WaniKani comparison tools (opus)
**Description:** Create `dictionary/` (`README.md`, `STYLE.md` per the spec's style guide, empty `parts.json`/`sounds.json`, `stories/`), and `scripts/stories/`: `prep.ts`, `check.ts`, `wk.ts`, `overlap.ts`, with `npm run stories:*` scripts. `check` runs over committed files inside `npm test` (empty dictionary passes; parts coverage is checked only once `parts.json` is non-empty).
**Acceptance:**
- [x] `stories:prep -- 2-3` writes input files with every field the spec lists.
- [x] Validator tests: each rule fails on a broken fixture and passes a good one.
- [x] `stories:wk` writes `.data-cache/stories/wk-library.json` (owner's token from `.env.local`); nothing under `dictionary/` or `src/` reads it.
- [x] Overlap tests: copied text scores high, unrelated low, shared glosses/readings/part names ignored.
- [x] `npm run check` passes (knip and deps included).
**Verification:** `npm test -- stories`; `npm run stories:prep -- 2-3`; `npm run stories:wk && ls .data-cache/stories`
**Files:** `dictionary/*`, `scripts/stories/*.ts`, `package.json`, `tests/data/stories.test.ts`, this file

### Task D2: Part names and sound keywords (content, orchestrator)
**Description:** Writer names every component in `src/data/kanji.json` (from KANJIDIC2/Kangxi meanings or our own choice) and writes `sounds.json` for every main on'yomi in our levels that occurs on 3+ kanji. Judge checks: fits the shape, unique, short, not a WaniKani invented name or recurring reading character. Overlap with plain WaniKani names is listed, not failed.
**Acceptance:**
- [x] `parts.json` covers every component; names unique; `stories:check` passes.
- [x] `sounds.json` covers every on'yomi on 3+ kanji; judge pass on all. (Amended: 179 of 186; 7 have no good English sound-alike and are left out, so their stories improvise: げん, きょく, ざん, びょう, ひょう, ぞく, きょう.)
- [x] Counts logged below.
**Files:** `dictionary/parts.json`, `dictionary/sounds.json`, this file

### Task D3: Pilot, Kanji 5–6 (content, orchestrator)
**Description:** Run the loop on game levels 6–7. Read every entry and the judge's fails; tighten `STYLE.md` where fails cluster (re-run the pilot if the guide changed much). Log counts.
**Acceptance:**
- [x] `dictionary/stories/kanji-05.json`, `kanji-06.json` committed; all pass check and judge.
- [x] `STYLE.md` updated from the pilot; changes listed below.
- [x] Counts logged below.
**Files:** `dictionary/stories/*`, `dictionary/STYLE.md`, this file

### Task D4: Our stories on the study and pause cards (sonnet)
**Description:** `src/game/dictionary.ts` lazy loader; `src/core/study.ts` uses our entry first (spec "Card"); `part` tag; parts row with names; "story" headings. Both modes. WaniKani path unchanged for kanji without our entry.
**Acceptance:**
- [x] `studyCards` tests: ours beats the library; parts with names; reading blocks by presented label; non-main reading → none line; no entry → today's card or WaniKani's.
- [x] Main chunk grows ≤ 10 KB (`npm run build` sizes before/after logged); level files are separate chunks.
- [x] Screenshot at 390×844: Kanji 5 card (折, 合), meaning-gate card (both reading blocks), pause card (checked offscreen; owner sees it live at Checkpoint D).
- [x] `npm run check` passes.
**Files:** `src/game/dictionary.ts`, `src/core/study.ts`, `src/core/mnemonic.ts`, `src/game/ui/study.ts`, `src/game/ui/panels.ts`, tests

**Log (D4):** main chunk 908.91 kB (238.93 gz) before, 910.84 kB (239.64 gz) after: +1.93 kB. Separate chunks: `parts` 4.80 kB, `kanji-05` 15.35 kB, `kanji-06` 15.21 kB. Loading: study awaits the (local) chunk before opening, the pause card waits to render until it settles, so the WaniKani card never flashes first; a failed load falls back to today's card. Core holds `Dictionary`/`DictEntry` and conversion; `src/game/dictionary.ts` loads and `panels.ts` passes it in. Tests: 5 new `studyCards`/`lastAnswer` cases (42 in file).

### Task D5: Flag a story (sonnet)
**Description:** Flag button, inline note, local queue, push to `story_flags`, `supabase/story-flags.sql`, `npm run stories:flags` (spec "Flag").
**Acceptance:**
- [x] Queue tests: save/load, bad JSON ignored, push removes sent, failure keeps; never throws.
- [x] Signed out: Flag → Flagged, queued; nothing thrown.
- [x] `stories:flags` prints an empty list (or a "table missing, run supabase/story-flags.sql" hint) without crashing.
- [x] Screenshot of the flag form at 390×844.
- [x] `npm run check` passes.
**Files:** `src/storage/flags.ts`, `src/sync/flags.ts`, `src/game/ui/study.ts`, `supabase/story-flags.sql`, `scripts/stories/flags.ts`, `package.json`, tests

### Task D6: Deploy (orchestrator)
**Description:** Deploy and check the live build shows our stories for Kanji 5–6.
**Acceptance:**
- [x] Deploy green; live study card shows our story. (81662af: the live bundle loads `kanji-05`, `kanji-06` and `parts` chunks and has the Flag button.)

### Task R1: Review scripts, seed and apply (sonnet)
**Description:** `scripts/stories/review.ts` with `npm run stories:review -- seed|apply` (spec "Review page": item shape, ids, sample rule, apply rules). Seed output is in the `ArtifactData` batch shape. Nothing seeded or written carries WaniKani text (no `close` reasons).
**Acceptance:**
- [x] `seed parts`, `seed sounds`, `seed 6-7` write files; pilot levels get every kanji, later levels judge fails + 10 seeded random (same picks on a re-run); no judge file → random only, with a warning.
- [x] `apply` tests on fixtures: a part rename rewrites `<part>` text in every story using it and lists them; duplicate or 4-word names rejected; sound keyword edit saved; ✗ notes land in `notes-<scope>.json` with our text and the note only; random-miss count per level printed.
- [x] `npm run check` passes (knip and deps included).
**Files:** `scripts/stories/review.ts`, `package.json`, `tests/data/review.test.ts`, this file

### Task R2: Review page (sonnet, published by the orchestrator)
**Description:** `tools/review/index.html`, one self-contained page (spec "Review page": tabs, rows, keyboard, saves, filters, counters), `db` + `user` capabilities, works empty and shows a load error after 10 s. The subagent builds and checks it against a fixture listing offline; the orchestrator publishes it, seeds parts, sounds and Kanji 5–6, and checks one verdict round trip with `ArtifactData`.
**Acceptance:**
- [x] Screenshot at 1280×800 of each tab from a fixture, tags rendered as on the card, light and dark.
- [x] Published; link in this file's header (`Review tool: <url>`); items seeded (237 parts, 179 sounds, Kanji 5–6); a test verdict written and read back, then removed. (476 items. Round trip: verdict → listing → `apply` → notes file. The rules refuse a review write from a non-owner. Fixed on the way: saved listing files carry no version, so `apply` read nothing; `seed` now takes versions from `--version-list`, the listing's tool output.)
- [x] `npm run check` passes.
**Files:** `tools/review/index.html`, this file

### Checkpoint D: owner (moved to the review page, 2026-11-20)
- [x] Owner runs `supabase/story-flags.sql` once. (2026-11-20; `stories:flags` reads the table: no flags yet.)
- [ ] Owner reviews every part name and sound keyword on the review page, then all of Kanji 5–6.
- [ ] Owner ticks, or sends `STYLE.md` changes before D7 scales up.

### Task R3: Apply Checkpoint D's review (content, orchestrator)
**Description:** `stories:review -- apply` on the owner's verdicts; renamed parts and keywords ripple into the stories using them; ✗ stories rewritten through the writer/judge loop with the owner's notes; `stories:check`, `stories:overlap` (with `--names`), commit, push; re-seed changed items at `pass + 1` for a quick second look. First make `apply` skip reviews whose `pass` is below the item's (R1 rough edge: needs `--items`). `STYLE.md` updated where the notes cluster; changes listed below.
**Acceptance:**
- [ ] Every ✗ from Checkpoint D rewritten or answered on the page; all entries pass check and judge.
- [ ] Changed items re-seeded; counts logged below.

### Task D7: Flags, and a few levels ahead (content, orchestrator)
**Description:** Owner's flags first (rewrite, resolve; a renamed part or keyword means rewriting every story using it), then the loop on the next levels in pairs, about one level ahead of the owner. Each batch adds review steps after the commit: `stories:review -- seed <levels>` (judge fails + 10 random), owner reviews on the page, `apply`, rewrites. More than 2 random misses in a level → the whole level seeded and `STYLE.md` revisited before the next batch.
**Acceptance:**
- [ ] Levels through the owner's level + 1 have files; all pass check and judge; no unresolved suspect.
- [ ] Flags resolved; every seeded sample reviewed and its ✗ rewritten (random misses per level logged).
- [ ] Counts logged below.

### Task D8: Ship 1.7.0
**Description:** Credits/README note on the dictionary, `package.json` 1.7.0, `## 1.7.0 (<date>)` in `CHANGELOG.md`, deploy.
**Acceptance:**
- [ ] Version and changelog; deploy green.

### Checkpoint D2: owner
- [ ] Owner plays on with our stories only; ticks to close the round.

## Numbers
(batch counts: entries, first-pass fails by reason, suspects, rounds, final pass)

### D2: parts and sounds (2026-11-20)
| | Entries | 1st pass fails (wrong / weak / close) | Round 2 fails | Final |
|---|---|---|---|---|
| Parts | 237 | 0 / 13 / 3 | 2 weak (fixed by hand from the judge's suggestion) | 237 pass |
| Sounds | 186 → 179 | 3 / 12 / 2 | 3 weak (2 fixed by hand, きょう dropped) | 179 pass, 7 dropped |
- 123 part names equal a WaniKani radical name: plain shape meanings (mouth, tree, sun), judged fine; 3 distinctive matches renamed.
- STYLE.md: part names vs kanji glosses (日 part "sun", kanji "day"); only the keyword's matching syllable counts; sound sets (しょう/しょ/しょく) make length or final consonant obvious; example uses ⺅ "leaning person".

### D3: pilot, Kanji 5–6 (2026-11-20)
| Level | Fields | Overlap suspects (≥ 0.2) | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|---|---|
| Kanji 5 | 89 | 0 | 3 / 8 / 1 | 1 | 89 pass |
| Kanji 6 | 90 | 0 | 1 / 5 / 3 | 1 | 90 pass |
- The 4 `close` fails scored 0.08–0.14 on overlap: the score is a hint; the side-by-side judge is the gate.
- STYLE.md: reading minimum 80 → 60 (owner); no invisible parts; never a part plus its own sub-parts (flat KRADFILE lists); no long-vowel keyword for a short sound; every syllable produced; picture, not caption.
- Rough edge: component lists are flat (味 lists mouth, tree, pole, eight, two), so the checker warns where the writer names only visible parts (着, 円, 味, 薬). A real fix is part data with structure: its own job.
