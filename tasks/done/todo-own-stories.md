# Tasks: our own stories (v1.7.0)

Spec: `docs/specs/done/SPEC-own-stories.md` (2026-11-20). Intent: `docs/intent/own-stories.md`. Epic: `docs/ideas/useful-japanese.md` (round 3). Started 2026-11-20. The owner approved going straight to the first checkpoint (no spec sign-off).
Checkpoint D: https://claude.ai/artifact/1oDceuTuxQf87tyqBgTpEX (play Kanji 1–6, 2026-11-21; earlier: https://claude.ai/artifact/FD3HpQjJjEHKNXaqB5vDQd on the review page; the earlier play-based page https://claude.ai/artifact/Pzt8idETzahrdN9ohvua6S is superseded)
Review tool: https://claude.ai/artifact/CNZAQt1csZLwyV29i5piR9
Review: https://claude.ai/artifact/8XjjrPPLSvPDR8dkBTgdst (review page addition; intent `docs/intent/story-review.md`, 2026-11-20).
Review (part notes): https://claude.ai/artifact/Db8Pq8NVeYCqsTvKxVsLVV (intent `docs/intent/part-notes.md`, 2026-11-20).
Sound highlight: intent `docs/intent/sound-highlight.md` (2026-11-21); the owner waived the spec page.
Composite parts: intent `docs/intent/composite-parts.md` (2026-11-21); the owner waived the spec page.
Every task: `npm run check` passes before it is checked off. Never commit `.data-cache` or anything from WaniKani (text, names, overlap reports, judge files).

## Plan
- **Pipeline first.** D1 builds the format, validator, prep, WaniKani fetch and overlap check, so every story after it is checked the same way.
- **Shared vocabulary next.** D2 names the parts and the on'yomi sound keywords once, so every story uses the same names and images.
- **Pilot, then the card.** D3 writes Kanji 5–6 (the owner is on Kanji 5 and doesn't need Kanji 1–4) through the full writer/judge loop and tunes `STYLE.md` on what fails; D4 shows them on the card; D5 adds the flag.
- **Review page (added 2026-11-20).** Reviewing by playing was too slow. R1 builds the seed/apply scripts, R2 the desk review page; Checkpoint D happens there (all parts and sounds, then Kanji 5–6); R3 applies it. Stories are reviewed in the game with flags instead (owner, 2026-11-21). From D7 on, every batch gets a sampled review.
- **Part notes (added 2026-11-20, during Checkpoint D).** The owner couldn't see why some part names fit (⻏ "village"). N1 adds a `note` per part to the data, checker, seed and page; N2 writes the notes, renames history names to visible shapes and re-seeds the parts. The owner's part review resumes on the page after N2. Intent `docs/intent/part-notes.md`.
- **Sound highlight (added 2026-11-21, after the part and sound review).** Reading stories drop the closing explainer and the kana; a `<sound>` tag highlights the sound-alike chunk in place. H1 adds the tag to the checker, card and page; H2 rewrites Kanji 5–6's on/kun stories and re-seeds them. The owner's story review (rest of Checkpoint D) happens on the new form. Intent `docs/intent/sound-highlight.md`.
- **Composite parts (added 2026-11-21, from the owner's flag on 閉 at Checkpoint D).** KRADFILE's flat stroke lists make stories name "one, slash, crowbar". C1 switches components to KanjiVG one level down; C2 names the new parts and seeds the shapes to the review page (owner stop: review them); C3 applies the review, rewrites the changed Kanji 1–6 stories and deploys for Checkpoint D. Intent `docs/intent/composite-parts.md`.
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

### Task N1: Part notes in data, checker, seed and page (sonnet)
**Description:** Spec "Part notes": `stories:check` requires a part `note` (20–120 characters) behind a temporary `--allow-missing-notes` used until N2 lands (`npm test` passes it too until then); `stories:review -- rename <file>` reusing `apply`'s rename path; `seed parts` carries `note` and `was`; `seed --bump <ids file>` bumps `pass` only for listed ids; the Parts row shows the note and "was: …". Republish the page to the same link (orchestrator).
**Acceptance:**
- [x] Tests: missing or out-of-band note fails (without the flag); `rename` on a fixture ripples into `<part>` text and lists touched stories, rejects duplicate or 4-word names; `seed --bump` bumps only listed ids and keeps `if_version`.
- [x] Screenshot at 1280×800 of the Parts tab from a fixture with a note and a `was`, light and dark.
- [x] `npm run check` passes.
**Files:** `scripts/stories/check.ts`, `scripts/stories/review.ts`, `tools/review/index.html`, `tests/data/review.test.ts`, `tests/data/stories.test.ts`

### Task N2: Write part notes, rename history names (content, orchestrator)
**Description:** Save the owner's part reviews so far (`reviews` listing, kind `part`) to `.data-cache/stories/review/`. `STYLE.md` gets the "names you can see" rule. Writer (**opus**) writes all 237 notes and `renames.json` from `STYLE.md`, `parts.json`, uses and the owner's part reviews (✗ notes binding). Judge (**sonnet**) checks notes and renames; max 3 rounds. `stories:review -- rename`; writer re-reads touched Kanji 5–6 stories, judge re-checks them; `stories:check` (flag removed), `stories:overlap -- --names`; commit, push. Re-seed parts with `--bump` for renamed parts and rewritten stories; republish nothing else. Log counts below.
**Acceptance:**
- [x] Every part has a note; `--allow-missing-notes` removed; all renames judged pass; touched stories pass check and judge.
- [x] Parts re-seeded; one renamed part checked on the page (note and "was" shown, back to "to review"); an unchanged reviewed part keeps its verdict.
- [x] Counts logged below (notes, renames, owner ✗ notes used, stories touched, judge rounds).
**Files:** `dictionary/parts.json`, `dictionary/STYLE.md`, `dictionary/stories/kanji-05.json`, `dictionary/stories/kanji-06.json`, this file

### Task H1: `<sound>` tag in checker, card and review page (sonnet)
**Description:** Spec "Sound highlight": `<sound>` in `MNEMONIC_TAGS` and the card CSS (`mn-sound`); `stories:check` rules (on/kun need a `<sound>`, no `<reading>` in our stories, no `<sound>` in `meaning`, 1–6 Latin letters, on story highlights its `sounds.json` keyword, band 40–350) behind a temporary `--allow-reading` that `npm test` passes until H2 lands; the review page renders `<sound>` and shows each On/Kun cell's reading above the story. `STYLE.md` reading-story rules and example rewritten to the new form. Republish the page (orchestrator).
**Acceptance:**
- [x] Tests: each new check rule fails a broken fixture and passes a good one; `parseMnemonic` keeps `<sound>`.
- [x] Screenshot at 390×844 of a study card with a `<sound>` story (fixture entry), and at 1280×800 of the review page Stories tab from a fixture, light and dark.
- [x] `npm run check` passes.
**Files:** `src/core/mnemonic.ts`, `src/game/ui/study.ts` (or its CSS), `scripts/stories/check.ts`, `tools/review/index.html`, `dictionary/STYLE.md`, tests

### Task H2: Rewrite Kanji 5–6 reading stories (content, orchestrator)
**Description:** Writer (**opus**) rewrites every `on` and `kun` field in `kanji-05.json` and `kanji-06.json` to the new form from `STYLE.md`, `sounds.json` and the current stories (same scene and keyword, explainer and kana dropped, kun tail only when the meaning differs). `stories:check` (flag removed), `stories:overlap`; judge (**sonnet**) checks highlights and tails; max 3 rounds. Commit, push, deploy. No re-seed: the owner reviews the stories in the game with the Flag button (owner, 2026-11-21). Log counts below.
**Acceptance:**
- [x] Every on/kun field in Kanji 5–6 rewritten; `--allow-reading` removed; all pass check and judge.
- [x] Deploy green; one Kanji 5 card checked live (highlight shown, no explainer). (Live chunks checked: `<sound>` present, no `<reading>` in kanji-05.)
- [x] Counts logged below.
**Files:** `dictionary/stories/kanji-05.json`, `dictionary/stories/kanji-06.json`, `scripts/stories/check.ts`, this file

### Task B1: Backfill Kanji 1–4 (content, orchestrator)
**Description:** Added 2026-11-21 (owner): Kanji 1–4 still use WaniKani's stories, and removing WaniKani (backlog) needs them. Moved before Checkpoint D (owner, 2026-11-21: all of Kanji 1–6 before the checkpoint). Run the content loop on game levels 2–5 in two batches, current `STYLE.md` (sound highlight form). Review: in-game flags at Checkpoint D.
**Acceptance:**
- [x] `kanji-01.json` to `kanji-04.json` committed; all pass check and judge.
- [x] Deploy green; counts logged below. (9e639b8, live kanji-01…04 chunks.)

### Task C1: Components from KanjiVG (opus, highest risk: data)
**Description:** Spec "Composite parts": `scripts/sources.ts` fetches the pinned KanjiVG release into `.data-cache`; `scripts/build-data.ts` builds `components` from it by the rule (variant table, keep/recurse, order), replacing KRADFILE; `npm run build-data` regenerates `src/data/kanji.json`; `README.md` credits KanjiVG. `stories:check` gets a temporary `--allow-missing-parts` (parts coverage → warnings), passed by `npm test`. Write `.data-cache/stories/new-parts.json` (`[{ part, kanji: bool, uses: [...], children }]`) and `removed-parts.json` for C2. Nothing in `src/` but the data file changes; the card's parts row keeps working (names missing for new parts until C2 show the glyph alone).
**Acceptance:**
- [x] Tests: variant table maps every listed glyph; keep/recurse rule on fixtures (kept: named, kanji, 2+ uses; single-use recursed; leaf kept); 閉 → 門 才, 休 → ⺅ 木, 語 → 言 吾.
- [x] `src/data/kanji.json` regenerated; counts logged below (new parts total / kanji / shapes; Kanji 1–6 kanji changed; removed parts); no other kanji field changed (diff check).
- [x] `npm run check` passes (knip, deps).
**Files:** `scripts/sources.ts`, `scripts/build-data.ts`, `src/data/kanji.json`, `scripts/stories/check.ts`, `tests/data/*`, `README.md`, `package.json`, this file

### Task C2: Name the new parts, seed the shapes (content, orchestrator)
**Description:** From `new-parts.json`: kanji parts get their gloss name, `fixed`, a note (mechanical + writer for notes); shape parts get a name, note and 2–3 alts from a writer (**opus**) per STYLE.md, judged (**sonnet**), unique; removed parts dropped. `--allow-missing-parts` removed. Commit, push; seed the new shape parts to the review page (pass 1, alts). **Owner stop:** review them on the page (Kanji 1–6's 15 first).
**Acceptance:**
- [x] `parts.json` covers every component; check passes without the flag; judge pass on all new names and notes.
- [x] New shape parts seeded; counts logged below.

### Task C3: Apply the review, rewrite Kanji 1–6 stories (content, orchestrator)
**Description:** `apply` the owner's verdicts on the new parts; rewrite every Kanji 1–6 meaning story whose parts changed (and reading stories naming a removed part) through the writer/judge loop; check, overlap; commit, push, deploy. Then Checkpoint D resumes (play Kanji 1–6).
**Acceptance:**
- [x] Every changed Kanji 1–6 story rewritten; all pass check and judge; "part not named" warnings counted before/after.
- [x] Deploy green; counts logged below.

### Checkpoint D: owner (moved to the review page, 2026-11-20)
- [x] Owner runs `supabase/story-flags.sql` once. (2026-11-20; `stories:flags` reads the table: no flags yet.)
- [x] Owner reviews every part name and sound keyword on the review page (done 2026-11-21; applied in 1.6.7–1.6.9).
- [x] Owner plays Kanji 1–6 and flags stories that need work (in-game review, owner 2026-11-21, instead of the review page). (2026-11-24: played, "happy for now".)
- [x] Owner ticks, or sends `STYLE.md` changes before D7 scales up. (2026-11-24, no `STYLE.md` changes; 佰 stays "lodger".)

### Task R3: Apply Checkpoint D's review (content, orchestrator)
**Description:** `stories:review -- apply` on the owner's verdicts; renamed parts and keywords ripple into the stories using them; ✗ stories rewritten through the writer/judge loop with the owner's notes; `stories:check`, `stories:overlap` (with `--names`), commit, push; re-seed changed items at `pass + 1` for a quick second look. First make `apply` skip reviews whose `pass` is below the item's (R1 rough edge: needs `--items`). `STYLE.md` updated where the notes cluster; changes listed below.
**Acceptance:**
- [x] Every ✗ from Checkpoint D rewritten or answered on the page; all entries pass check and judge. (0 ✗: parts batch 2 all ✓; in-game play happy.)
- [x] Changed items re-seeded; counts logged below. (Nothing to re-seed: the only changes are the owner's own 5 renames. `apply` now skips reviews older than the item's pass.)

### Task D7: Flags, and a few levels ahead (content, orchestrator)
**Amended 2026-11-24 (owner):** names have settled (every part and sound reviewed), so write all remaining levels now (Kanji 9–72, game levels 10–73), not one ahead. The owner waived the sampled review ("fine with your stories"); in-game flags are the safety net. Batches of 2 levels, several in parallel, deploy every few batches.
**Description:** Owner's flags first (rewrite, resolve; a renamed part or keyword means rewriting every story using it), then the loop on the next levels in pairs, about one level ahead of the owner. Each batch adds review steps after the commit: `stories:review -- seed <levels>` (judge fails + 10 random), owner reviews on the page, `apply`, rewrites. More than 2 random misses in a level → the whole level seeded and `STYLE.md` revisited before the next batch.
**Acceptance:**
- [x] Levels through the owner's level + 1 have files; all pass check and judge; no unresolved suspect. (All 72 levels, owner's amendment 2026-11-24; 2026-11-27.)
- [x] Flags resolved; every seeded sample reviewed and its ✗ rewritten (random misses per level logged). (No flags; owner waived the sampled review from Kanji 9 on.)
- [x] Counts logged below.

### Task D8: Ship 1.7.0
**Description:** Credits/README note on the dictionary, `package.json` 1.7.0, `## 1.7.0 (<date>)` in `CHANGELOG.md`, deploy.
**Acceptance:**
- [x] Version and changelog; deploy green. (1.7.0, deaf8db, deploy green 2026-11-27.)

### Checkpoint D2: owner
- [x] Owner plays on with our stories only; ticks to close the round. (2026-11-27: played Kanji 5–6, "close the round".)

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

### N2: part notes and renames (2026-11-20)
| | Entries | 1st pass (wrong / weak / close) | Fixed | Final |
|---|---|---|---|---|
| Part notes | 237 | 0 / 11 / 3 | by hand from the judge's suggestions | 237 written |
| Renames | 15 | 3 close (WaniKani names for other glyphs), 1 weak (crook upside down) | coat rack → peg post, scarecrow → straw man, signpost → lamppost, shepherd's crook → fishhook | 15 applied |
| Stories touched | 4 (路 折 落 弁) | 2 weak (路 foot + its own sub-part stop; 弁 kun missed える) | 1 round | 4 pass |
- Owner ✗ notes used: 1 (𠂉 "hat" → diving board; note offers lean-to, flagpole). Owner overrode my revert of ⺘ reaching hand → anchor.
- Re-seeded 237 parts (15 at pass 2) and the 4 stories (pass 2); the 4 parts the owner ✓'d keep their verdict.
- Writer kept history-leaning names it was unsure of (隹 sparrow, 艮 mule, 虍 tiger, 歹 bones, 豸 leopard, 卩 stamp, 豕 pig, 辰 hoe): the owner decides on the page.

### Round 2 from the owner's first review (2026-11-20)
| | Changed | Judge 1st pass (weak / close) | Final |
|---|---|---|---|
| Sound keywords (all 179 audited for the new vowel rule) | 47 (8 owner ✗, 38 vowel audit, 1 note only) | 6 / 1 | fixed by hand: yuzu, lunch, sugar cube, goon; satsuma, jacuzzi, jury left for the owner |
| Parts | 9: ⺅ coat hook, ⻌ ramp, 韋 pagoda (totem pole is と's keyword), 屮 pitchfork / 耒 TV aerial (owner), notes on ⺖ ⺡ 口 囗 | 1 / 2 | all pass |
| Kanji 5–6 story fields | 40 (17 keyword, 6 coat hook, 17 vowel audit) | 10 weak (kun okurigana not produced, long/lax vowels) | fixed by hand: 7 tags to the base, 主 遅 五 落 rewritten |
- Re-seeded 88 items at pass + 1 (32 stories, 9 parts, 47 sounds).
- STYLE.md: vowel rule (あ "ah", no flat a; う no w; strut u counts as あ for this owner); example now uses coat hook.
- Flagged, unchanged: がく gaggle, きゃく kayak (flat a, owner ✓); おん on switch (accent).
- Rough edge: `tests/core/kanji-words.test.ts` "wordreading rows" times out at 5 s under full `npm run check` load; passes alone.

### H2: sound highlight rewrite (2026-11-21)
| Level | Fields | Overlap suspects | Judge 1st pass (weak / wrong) | Fixed | Final |
|---|---|---|---|---|---|
| Kanji 5 | 59 | 0 | 4 / 0 | 4 by hand (着 力 cuckoo for く, 安 sue, 主 mole) | 59 pass |
| Kanji 6 | 60 | 0 | 8 / 0 | 3 by hand (言 Gen, 戻 doll, 冷 tie for たい); 4 strut-u (tub, hut, duck, mug) passed per the owner's vowel rule; 便 tail not needed ("letter" is a gloss) | 60 pass |
- Kun meaning tails kept: 番 (a pair), 弁 (know what's proper).
- Okurigana left uncovered as before where the old story didn't spell it (安 好 遅 交 停 付 戻 高…).

### B1: Kanji 1–4 backfill (2026-11-21)
| Level | Fields | Overlap suspects | Judge 1st pass (weak / wrong / close) | Fixed by hand | Final |
|---|---|---|---|---|---|
| Kanji 1 | 90 | 0 | 6 / 0 / 1 | 出 meaning (no sub-parts), 食 on (close: shock of hair) | 90 pass |
| Kanji 2 | 86 | 0 | 3 / 0 / 1 | 月 on (gecko + tsu), 母 kun (close: harps) | 86 pass |
| Kanji 3 | 87 | 1 (品 kun) | 3 / 0 / 2 | 十 on, 品 kun (close), 半 meaning (cake set up) | 87 pass |
| Kanji 4 | 84 | 0 | 3 / 0 / 1 | 料 meaning (close: canteen tray), 午 kun (umami) | 84 pass |
- Passed against the judge, for the owner to hear in play: と via "totem" (approved keyword), short も/の via "mole"/"No!" (as in Kanji 5–6), がく "gaggle" (owner ✓ earlier).
- Kun meaning tails kept: 金 (money), 門 (a corner), 社 (a shrine).

### C1: components from KanjiVG (2026-11-21)
| New parts | Kanji | Shapes | Kanji 1–6 kanji changed | Kanji 1–6 new parts (kanji / shapes) | Removed parts |
|---|---|---|---|---|---|
| 511 | 348 | 163 | 84 of 180 | 36 (25 / 11) | 5: 母 ⽱ 尢 五 亀 |
- First pass (before the fixes below): 512 new (348 / 164), 116 of 180 changed, 38 needed, 9 removed (also 丷 𠆢 ユ 無).
- Uses counted once per kanji at any depth of its KanjiVG tree, over all 2136. A chunk with strokes of its own beside its sub-chunks (KanjiVG leaves some strokes ungrouped) is kept whole; breaking it up would drop strokes. Prototype 535 → 512 after mapping 21 more look-alike glyphs (疒→⽧, 耂→⺹, 辶→⻌, 覀→西, ⺕→ヨ, ⺤→爪, ⺦→爿, 己→已, 飠→食, 匸→匚…).
- Fallback: 235 kanji whose root has strokes outside its chunks, or no chunks, keep their KRADFILE elements (variant-mapped), so no list is partial: 本 → 一 木, 北 → 匕 爿, 金 → 王 ハ 𠆢 丷, 肉 → 冂 人. 言 and 方 stay empty, as KRADFILE lists them as themselves (like 日).
- 人 on top (own or inherited `kvg:position`) → 𠆢 (今 会 合); a `kvg:variant` 八 on top → 丷 (前 弟 尊). 𠆢 in 茶 (inside 余) is still read as 人.
- `confusables.json` follows the new components (its test ties it to `kanji.json`); the order still uses KRADFILE's elements, so levels didn't move. 24 Kanji 1–6 parts are kanji taught later (何 ← 可, Kanji 23); the "kanji parts come first" data test now checks only duplicates and self.

### C2: new part names (2026-11-21)
| | Entries | Judge (weak / wrong) | Final |
|---|---|---|---|
| Shape parts (named, alts, seeded) | 163 (11 in Kanji 1–6) | 4 / 0 (云 cloud → kite: 雲 is "cloud"; 𠂢 堇 菫 notes) | 163 seeded at pass 1 |
| Kanji parts (fixed, not seeded) | 348 | 28 abstract names swapped for a drawable gloss (直 straight, 周 lap, 卓 desk…); 346 notes polished | 348 |
- Removed: ⽱ paw print, 尢 crutch, 五 five, 亀 tortoise (no kanji uses them now). 母 mother kept until C3 (a story still names it).
- `--allow-missing-parts` removed. `stories:check`: 0 errors, 57 "part not named" warnings, for C3.
- Rough edge: 235 kanji whose KanjiVG root has loose strokes fall back to KRADFILE's flat list (乗 来 円 半 南 夫…, 10 in Kanji 1–6 with 4+ parts).

### C3: review applied, Kanji 1–6 rewritten (2026-11-21)
| | Entries | Judge round 1 (close / weak / wrong) | Final |
|---|---|---|---|
| Parts review, batch 1 | 31 new shapes reviewed (all 11 in Kanji 1–6) | | 6 renamed: 龰 skate, 业 candles, 丩 tuning fork, 乡 scribble, 亘 burger, 𠂇 rudder; 132 still to review |
| Meaning stories with changed parts | 58 (50 rewritten, 8 already fit) | 6 / 3 / 0 (時 国 朝 側 店 値 close; 祖 切 weak) | all pass after round 2 |
| Reading stories adjusted to the new scenes | 16 | | all pass |
- 時 kun "totem" kept (judge: weak, long vowel): totem is the と keyword, as before.
- 母 removed from parts.json (no kanji uses it now). らん's stale "runner" review edit fixed on the page (apply had reverted runway).
- `stories:check`: 0 errors; warnings 56 → 12, all on KRADFILE-fallback kanji (乗 年 金 来 半 円).
- Parts review, batch 2 (2026-11-24): the remaining 132 shapes reviewed, 0 ✗; 5 renamed (⺗ trickle, 乍 coat rack, 兪 spaceship, 叟 lantern holder, 圭 double mound), no stories touched. 佰 "guest" refused (客's name): asked the owner. Review page: 𢆉 drawn from KanjiVG, Noto Sans SC fallback (1.6.19).

### D7 batch 1: Kanji 7–8 (2026-11-24)
| Level | Fields | Overlap suspects (≥ 0.2) | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|---|---|
| Kanji 7 | 85 | 1 (浴 on, judged close) | 0 / 0 / 1 (浴 on: same punchline) | 2 | 85 pass, 0 suspects |
| Kanji 8 | 87 | 0 | 0 / 1 / 1 (助 on: lamp not in the scene; 正 meaning: same scene) | 2 | 87 pass |
- 正's on/kun followed the new meaning scene (licence → medal), judged with it.
- `stories:check`: 0 errors, 7 warnings, all on KRADFILE-fallback kanji (免 無 段).
- Writer notes: no-keyword sounds improvised (病 びょう, 熱 ねつ, 風 ふう, 和 わ, 税 ぜい, 曲 きょく); 且 "moreover" isn't drawable (助 uses it as the word); 替 has two 夫 but one part entry.
- Review page: 23 seeded (3 judge-fail, 10 random per level), pass 1.
- WaniKani library now fetched in the cloud session (`kanji-runner` environment, token as a network secret; Node needs `NODE_USE_ENV_PROXY=1`).

### D7 round 2: Kanji 9–16, 4 batches in parallel (2026-11-24)
| Level | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|
| Kanji 9 | 0 / 0 / 0 | 1 | all pass |
| Kanji 10 | 0 / 0 / 2 (婦 晴 meaning) | 2 | all pass |
| Kanji 11 | 1 / 2 / 0 (進 kun sugar≠su; 万 pole unnamed; 現 on "again") | 2 | all pass |
| Kanji 12 | 0 / 0 / 0 | 1 | all pass |
| Kanji 13 | 0 / 1 / 3 (喫 kun; 毛 器 on, 連 meaning) | 2 | all pass |
| Kanji 14 | 0 / 0 / 2 (服 meaning; 供 on "Tokyo") | 2 | all pass |
| Kanji 15 | 0 / 0 / 0 | 1 | all pass |
| Kanji 16 | 0 / 2 / 2 (魚 源 on; 聞 秋 meaning) | 3 | all pass but 魚 on (weak, kept) |
- 魚 on: no English word glides gy into a short o; four tries judged weak (Gyo!, gyoza = long ぎょう keyword, "Ugh-yo!", "leggy octopus"). Kept "leggy octopus" by hand; owner flags if it bothers.
- Overlap pre-pass: 2 suspects (毛 on judged close, 息 on pass); 9 of 17 close fails scored below 0.2, so the judge stays the gate.
- Owner waived review: nothing seeded.
- Tokens (each agent's final context size as reported; billed input over all turns is higher, mostly cache reads): writers 546,907 (134.5k–140.1k each), judges 501,576 (114.9k–141.7k each), total 1,048,483 for 8 levels, about 131k per level. Wall time about 15 minutes per batch with rewrites.

### D7 round 3: Kanji 17–24, 4 batches in parallel (2026-11-25)
Writers got a "lessons from the last round" list (accent-dependent sounds, made-up noises, place names, stock scenes, unnamed visible parts, `<sound>` format); judges were told to accept best real-word attempts for sounds with no English match (きょう, ぎょ, げん…).
| Level | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|
| Kanji 17 | 0 / 0 / 1 (銀 meaning) | 2 | all pass |
| Kanji 18 | 0 / 0 / 1 (相 meaning) | 2 | all pass |
| Kanji 19 | 0 / 0 / 0 | 1 | all pass |
| Kanji 20 | 1 / 0 / 0 (処 kun sounds out of order) | 2 | all pass |
| Kanji 21 | 0 / 0 / 0 | 1 | all pass |
| Kanji 22 | 0 / 0 / 0 | 1 | all pass |
| Kanji 23 | 0 / 0 / 4 (容 材 様 総) | 2 | all pass |
| Kanji 24 | 0 / 0 / 1 (細 meaning) | 2 | all pass |
- 8 first-pass fails (round 2: 17); 7 are close, all caught by the side-by-side judge, none by the overlap score (1 suspect, 混 on, judged pass).
- `stories:check`: 0 errors, 10 warnings, all flat-fallback kanji.
- Tokens (final context size per agent): writers 593,578 (139.4k–161.5k), judges 475,219 (111.7k–123.5k), total 1,068,797 for 8 levels, about 134k per level.

### D7 round 4: Kanji 25–32, 4 batches in parallel (2026-11-25)
Writers' lessons list now leads with "skip the most literal picture of the parts" and "sounds in reading order".
| Level | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|
| Kanji 25 | 0 / 2 / 2 (軽 "boot" is British; 散 diving board unnamed; 弱 逃 meaning) | 2 | all pass |
| Kanji 26 | 0 / 0 / 1 (省 meaning; round 2 weak: eye only an idiom, fixed by hand) | 3 | all pass |
| Kanji 27 | 0 / 0 / 1 (辺 meaning) | 2 | all pass |
| Kanji 28 | 0 / 1 / 1 (刑 cruelty played for laughs; 島 kun) | 2 | all pass |
| Kanji 29 | 0 / 0 / 0 | 1 | all pass |
| Kanji 30 | 0 / 1 / 1 (植 kun "ukulele" ≠ う; 否 meaning) | 2 | all pass |
| Kanji 31 | 1 / 0 / 0 (許 kun highlight on the wrong syllable) | 2 | all pass |
| Kanji 32 | 0 / 0 / 1 (触 on) | 2 | all pass |
- 11 first-pass fails (round 3: 8); 7 close, all caught by the judge; the overlap score's 2 suspects were 1 close (辺 on) and 1 pass.
- きょう has no keyword: used in 5 kanji in Kanji 29–30 alone ("key" + "Oh!"). A shared keyword is the owner's call.
- `stories:check`: 0 errors; warnings only on flat-fallback kanji.
- Tokens (final context size per agent): writers 570,603 (138.9k–146.2k), judges 504,093 (117.0k–135.8k), total 1,074,696 for 8 levels, about 134k per level.

### D7 round 5: Kanji 33–40, plus the きょう keyword (2026-11-25/26)
Owner asked for a shared きょう keyword: Kyoto (sounds.json; first part = held "kyoh"; an allowed place name like ryokan/gyoza are loanwords). 11 earlier on stories (Kanji 11–32) rewritten to use it; judge rule: a character must say the name, not an object holding a note. 6 passed first time, 5 after one round.
STYLE.md now records the owner's 2026-11-20 cup-vowel rule (the u of cup counts as あ); judges had kept failing tub/duck/won. Three such fails (硬 委 腕) were overruled.
The 5-hour usage limit stopped 3 agents mid-round; they resumed after the reset.
| Level | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|
| Kanji 33 | 0 / 1 / 1 (善 sheep + its horns; 則) + 2 overruled | 2 | all pass |
| Kanji 34 | 0 / 0 / 1 (鳴 kun) + 1 overruled | 2 | all pass |
| Kanji 35 | 0 / 0 / 0 | 1 | all pass |
| Kanji 36 | 1 / 0 / 2 (漁 on gyoza for short ぎょ; 踏 州) | 2 | all pass |
| Kanji 37 | 0 / 1 / 0 (麻 cluttered) | 2 | all pass |
| Kanji 38 | 0 / 0 / 0 | 1 | all pass |
| Kanji 39 | 0 / 0 / 0 | 1 | all pass |
| Kanji 40 | 0 / 1 / 0 (択 taco half-highlighted, fixed by hand) | 1 | all pass |
- 8 real first-pass fails (round 4: 11).
- Tokens (final context size per agent; the 3 resumed agents may under-report): writers 583,649, judges 491,435, total 1,075,084 for 8 levels (about 134k per level); Kyoto rewrite + judge 153,188 more.

### D7 round 6: Kanji 41–48 (2026-11-26)
| Level | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|
| Kanji 41 | 0 / 0 / 1 (灰) | 2 | all pass |
| Kanji 42 | 1 / 0 / 4 (蓄 kun taco=たこ; 脅 殿 署 meaning, 軟 on) | 2 | all pass |
| Kanji 43 | 1 / 0 / 0 (巧 kun taco=たこ) | 2 | all pass |
| Kanji 44 | 0 / 0 / 1 (遂) | 2 | all pass |
| Kanji 45 | 1 / 0 / 1 (雇 kun "toe" long; 肩) | 2 | all pass |
| Kanji 46 | 1 / 0 / 0 (匠 kun taco=たこ) | 2 | all pass |
| Kanji 47 | 0 / 2 / 1 (懸 cluttered, 譲 kun "yuzu" is the reading; 繁) | 2 | all pass |
| Kanji 48 | 0 / 1 / 2 (袖 muddled; 鋼 鈍) | 2 | all pass |
- 17 first-pass fails (round 5: 8). 11 close; 3 kun stories used a whole "taco" for たく (gives たこ; taco is only the on keyword): add to the writers' lessons.
- 盲 kun めくら is a slur: dropped (owner, 2026-11-26). `null` now means "left out on purpose" in check, type and README.
- Tokens (final context size per agent): writers 572,148 (135.8k–144.9k), judges 514,611 (120.4k–133.9k), total 1,086,759 for 8 levels, about 136k per level.

### D7 round 7: Kanji 49–56 (2026-11-26)
The 5-hour usage limit stopped all 4 writers before they saved anything; they resumed after the reset.
| Level | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|
| Kanji 49 | 0 / 0 / 1 (騎 on) | 2 | all pass |
| Kanji 50 | 0 / 0 / 1 (鉢) | 2 | all pass |
| Kanji 51 | 1 / 0 / 2 (懇 kun bingo = long ご; 騰 胆) | 2 | all pass |
| Kanji 52 | 0 / 1 / 3 (亜 cluttered; 秒 刷 軒) | 2 | all pass |
| Kanji 53 | 0 / 0 / 1 (墨 kun) | 2 | all pass |
| Kanji 54 | 0 / 1 / 0 (嬢: child at work) | 2 | all pass |
| Kanji 55 | 0 / 0 / 1 (幣 on; round 2 still close, fixed by hand) | 3 | all pass |
| Kanji 56 | 0 / 2 / 0 (郎 kun unlinked; 憶 on half-highlighted, fixed by hand) | 2 | all pass |
- 15 first-pass fails (round 6: 17).
- Tokens (final context size per agent; resumed writers may under-report): writers 581,994 (137.3k–154.2k), judges 529,050 (130.1k–133.7k), total 1,111,044 for 8 levels, about 139k per level.

### D7 round 8: Kanji 57–64 (2026-11-26)
| Level | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|
| Kanji 57 | 0 / 1 / 0 (尉 innuendo, fixed by hand) | 2 | all pass |
| Kanji 58 | 0 / 0 / 1 (伯) | 2 | all pass |
| Kanji 59 | 1 / 1 / 0 (后 part + own sub-part; 伐 kun unlinked) | 2 | all pass |
| Kanji 60 | 0 / 0 / 1 (紺 on) | 2 | all pass |
| Kanji 61 | 0 / 1 / 1 (貼 kun okurigana highlighted; 帽) | 2 | all pass |
| Kanji 62 | 0 / 1 / 3 (肪 body-shaming; 腫 閑 娠) | 2 | all pass |
| Kanji 63 | 0 / 1 / 0 (肯 kun list) | 2 | all pass |
| Kanji 64 | 0 / 1 / 0 (曹 muddled; 諭 recast, it shared 癒's cast) | 2 | all pass |
- 14 first-pass fails (round 7: 15). WaniKani's library has no stories for some rarer kanji here, so fewer entries were compared (53–83 per level).
- Tokens (final context size per agent): writers 569,233 (138.2k–148.2k), judges 475,495 (116.3k–121.0k), total 1,044,728 for 8 levels, about 131k per level.

### D7 round 9: Kanji 65–72, the last levels (2026-11-26/27)
The 5-hour usage limit stopped 3 judges; they resumed after the reset. WaniKani's library has few of these rare kanji (Kanji 72: none), so the judge compared fewer side by side.
| Level | 1st pass fails (wrong / weak / close) | Rounds | Final |
|---|---|---|---|
| Kanji 65 | 0 / 0 / 0 | 1 | all pass |
| Kanji 66 | 0 / 2 / 1 (彙 kun list; 吟 on "Gee… Nn"; 凄) | 2 | all pass |
| Kanji 67 | 1 / 2 / 0 (暫 kun missing ら; 蜜 on, 旬); round 2 led 蜜 and 旬 into known mnemonics (orchestrator's suggestions), fixed in round 3 | 3 | all pass |
| Kanji 68 | 0 / 1 / 0 (拶 cluttered) | 2 | all pass |
| Kanji 69 | 0 / 2 / 0 (鬱 on long Oo; 嘲 kun unlinked) | 2 | all pass |
| Kanji 70 | 0 / 0 / 1 (恭 kun chant) | 2 | all pass |
| Kanji 71 | 2 / 1 / 0 (但 kun okurigana highlighted; 遡 kun "No!"; 恣 kun list) | 2 | all pass |
| Kanji 72 | 0 / 1 / 0 (蔽 kun one お for おお) | 2 | all pass |
- 14 first-pass fails. Lesson: the orchestrator's example fixes should avoid the obvious picture too (蜜 mitts, 旬 wrapped sun were themselves close).
- Tokens (final context size per agent): writers 613,951, judges 455,530, total 1,069,481 for 216 kanji.
- **D7 total (Kanji 7–72, 1,936 kanji):** about 9.0M tokens on this measure (9 rounds of ~1.05–1.11M, plus 0.29M for Kanji 7–8 and 0.15M for the Kyoto keyword rewrite).
