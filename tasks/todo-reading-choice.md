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
- [x] spec Testing Strategy "Real data" checks pass; two builds give identical JSON.
- [x] Report written; numbers logged below.
- [x] Longest new label readable at 390×844 (screenshot in the scratchpad).
- [x] README credits JMdict.
- [x] `npm run check` passes.
**Verification:** `npm run data:build` twice + `git diff --exit-code src/data`; `npm test -- kanji readings`; browser check.
**Dependencies:** R1
**Files:** `scripts/build-data.ts`, `scripts/reading-overrides.json`, `src/data/kanji.json` (+ any regenerated `src/data/` file), `tests/data/kanji.test.ts`, `README.md`, this file
**Scope:** M

### Task R3: Golden reading set (highest risk: opus, web research)
**Description:** Owner request (2026-11-17): a curated, researched set of expected readings so this and later data changes are measured against it. `tests/data/reading-golden.json`: one entry per kanji, `{ "char", "on": [acceptable on'yomi], "kun": [acceptable kun entries], "note": "<evidence: top everyday words, source>" }`. "Correct" = the reading a learner meets most in everyday vocabulary (on'yomi: across common words; kun'yomi: the most frequent word where the kanji stands alone with kana). Two readings go in the list only when they're genuinely about equally common. Covers: every kanji in the R2 change list (135), every level 2–10 kanji whose pick was a tie or a count of 1, and the hard multi-reading kanji of levels 2–10 (生, 下, 間, 日, 上, 家, 人, 行, 出, 中…). Researched from open sources and general knowledge of Japanese (word-frequency lists, dictionaries); nothing copied from WaniKani. A test checks every golden entry against `src/data/kanji.json`; each mismatch is fixed with an override in `scripts/reading-overrides.json` (why cites the evidence) or, if the golden entry was wrong, a corrected entry.
**Acceptance:**
- [ ] Golden set covers the groups above; every entry has a note.
- [ ] Golden test passes; overrides added with reasons; data rebuilt and committed.
- [ ] Numbers logged below: golden size, agreement before overrides, overrides added.
- [ ] `npm run check` passes.
**Verification:** `npm test -- golden kanji`
**Dependencies:** R2
**Files:** `tests/data/reading-golden.json`, a golden test in `tests/data/`, `scripts/reading-overrides.json`, `src/data/kanji.json`, this file
**Scope:** M

### Task R4: Changelog, version
**Description:** Bump to 1.4.0, add `## 1.4.0 (date)` to `CHANGELOG.md` (one line: readings picked by how many common words use them).
**Acceptance:**
- [ ] Version 1.4.0 in `package.json` and `CHANGELOG.md`.
- [ ] Deploy green.
**Verification:** `npm run check`; deploy green.
**Dependencies:** R3
**Files:** `package.json`, `CHANGELOG.md`, this file
**Scope:** S

### Checkpoint R: v1.4.0 (owner, on the phone + change list)
- [ ] The change list (checkpoint page, with the golden-set result) reads right against your WaniKani sense; flagged misses noted for overrides.
- [ ] A run with 明 (level 5) shows あか(るい) on its reading gate; labels readable.
- [ ] Existing progress intact; stories still show (or "no story") for the new readings.

## Numbers
From Task R2's build (full report: `.data-cache/reading-report.txt`, 135 rows):
- **29 kanji changed on'yomi, 106 changed kun'yomi** (kun counted from standalone words only).
- Spec rows. Counts are common JMdict entries; on'yomi from every word, kun'yomi from standalone spellings.
  - 明: on メイ 42 (unchanged); kun あ.かり → あか.るい by override (standalone tie: あ.かり, あか.るい, あき.らか, あ.ける, あ.くる, あ.かす all 1).
  - 図: on ズ 17 (unchanged); kun え → はか.る (はか.る 1, え 0).
  - 上: on ジョウ 74 (unchanged); kun うえ, first listed (うえ, かみ, あ.げる, あ.がる, … all 1, tie → KANJIDIC2 order). Not in the report.
  - 家: on カ 59 (unchanged); kun いえ 2, うち 1 (unchanged). Not in the report.
  - 気: on キ 124, ケ 12 (unchanged); kun いき → き (き 9, いき 0).
- 10 sample rows:
  ```
  大 L2  kun おお- → おお.きい (おお.きい 1, おお- 0, -おお.いに 0)
  木 L2  on ボク → モク (モク 13, ボク 2)
  生 L2  kun い.きる → なま (なま 3, う.まれ 2, い.きる 1)
  間 L5  kun あいだ → ま (ま 2, あいだ 1, あい 0)
  少 L7  kun すく.ない → すこ.し (すこ.し 3, すく.ない 1)
  主 L11  kun ぬし → おも (おも 2, ぬし 1, あるじ 1)
  世 L11  on セイ → セ (セ 24, セイ 10, ソウ 0)
  省 L20  on セイ → ショウ (ショウ 21, セイ 5)
  便 L21  on ベン → ビン (ビン 13, ベン 9)
  怒 L46  kun いか.る → おこ.る (おこ.る 1, いか.る 0)
  ```
- Longest new gate labels: 7 characters (あたた(かい), まぬが(れる), わきま(える), そそのか(す), い(まわしい)); the longest label overall was already 8. At GATE_MIN_W (70 px) they draw at 13–23 px, い(まわしい) smallest (13 px on one line).
- Screenshot (crafted 3-answer reading walls, 60–160 px tall, narrowed openings at GATE_MIN_W, drawn with the game's `drawLabel`): `/private/tmp/claude-501/-Users-parlux-Projects-number-runner/a6a4a232-bb83-492b-845a-8f572a909944/scratchpad/r2-gate-labels-390x844.png`.
