# Tasks: teach the most useful reading first (v1.4.0)

Spec: `docs/specs/SPEC-reading-choice.md` (2026-11-17). Intent: `docs/intent/reading-choice.md`. Idea: `docs/ideas/reading-choice.md`. Started 2026-11-17.
Review: owner skipped the spec page (2026-11-17).
Every task: `npm run check` passes before it is checked off. Never commit `.data-cache` or raw EDRDG downloads.

## Plan
- **Counting first, data second.** R1 builds and tests the pure counting module on synthetic fixtures, with no change to `src/data/`. R2 wires it into the build, regenerates the data and logs the numbers. A bad aligner shows up in R1's tests, not in a 2,000-kanji diff.
- **No game code.** Gates, distractors and the reveal read `on`/`kun`; only the data changes.

### Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Alignment miscounts (sound changes, ambiguous words) | High | Strict "every alignment agrees" rule; synthetic tests per case; owner reviews the change list. |
| Plain entry count picks an odd reading for some kanji | Med | Overrides file; report shows top candidates and counts. |
| JMdict XML is large (~60 MB) for regex parsing | Low | Parse per `<entry>`, keep only common kanji spellings. |
| A longer kun label doesn't fit narrow gates | Low | R2 checks the longest new label at `GATE_MIN_W`. |

### Task R1: Counting module (highest risk: opus)
**Description:** New `scripts/readings.ts` with pure functions per the spec: parse common words from JMdict XML, align spelling/reading pairs to kanji readings (rendaku, sokuon, `々`, "every alignment agrees"), count entries per on'yomi and per kun entry, pick with ties/zero rule and overrides (unknown override throws), and build report rows. Not yet called by the build.
**Acceptance:**
- [x] spec Testing Strategy synthetic cases (common filter, alignment, kun entry attribution, pick) pass in `tests/data/readings.test.ts`.
- [x] `src/data/` unchanged.
- [x] `npm run check` passes (knip: export only what tests and R2 use).
**Verification:** `npm test -- readings`
**Files:** `scripts/readings.ts`, `tests/data/readings.test.ts`
**Scope:** M

### Task R2: Wire into the build, regenerate data
**Description:** Add JMdict to `SOURCES`; `build-data.ts` uses `scripts/readings.ts` for `on`/`kun`; create `scripts/reading-overrides.json` as `{}`; write `.data-cache/reading-report.txt` and print the summary. Run `npm run data:build`, commit the regenerated `src/data/`. Add the real-data spot checks to `tests/data/kanji.test.ts`. Credit JMdict in `README.md`. Check the longest new gate label fits `GATE_MIN_W` (browser check at 390×844 on a crafted reading gate). Log in this file under "Numbers": changed on'yomi / kun'yomi counts, the 明 and 図 rows, and 10 sample changed rows.
**Acceptance:**
- [ ] spec Testing Strategy "Real data" checks pass; two builds give identical JSON.
- [ ] Report written; numbers logged below.
- [ ] Longest new label readable at 390×844 (screenshot in the scratchpad).
- [ ] README credits JMdict.
- [ ] `npm run check` passes.
**Verification:** `npm run data:build` twice + `git diff --exit-code src/data`; `npm test -- kanji readings`; browser check.
**Dependencies:** R1
**Files:** `scripts/build-data.ts`, `scripts/reading-overrides.json`, `src/data/kanji.json` (+ any regenerated `src/data/` file), `tests/data/kanji.test.ts`, `README.md`, this file
**Scope:** M

### Task R3: Changelog, version
**Description:** Bump to 1.4.0, add `## 1.4.0 (date)` to `CHANGELOG.md` (one line: readings picked by how many common words use them).
**Acceptance:**
- [ ] Version 1.4.0 in `package.json` and `CHANGELOG.md`.
- [ ] Deploy green.
**Verification:** `npm run check`; deploy green.
**Dependencies:** R2
**Files:** `package.json`, `CHANGELOG.md`, this file
**Scope:** S

### Checkpoint R: v1.4.0 (owner, on the phone + change list)
- [ ] The change list (checkpoint page) reads right against your WaniKani sense; flagged misses noted for overrides.
- [ ] A run with 明 (level 5) shows あか(るい) on its reading gate; labels readable.
- [ ] Existing progress intact; stories still show (or "no story") for the new readings.

## Numbers
(filled in by Task R2)
