# Spec: teach the most useful reading first (v1.4.0)

Extends `docs/specs/done/SPEC.md` and the specs after it. Everything there still holds unless this spec says otherwise. Intent: `docs/intent/reading-choice.md`. Idea: `docs/ideas/reading-choice.md`.

## Objective
Each kanji's taught readings (`on` and `kun` in `src/data/kanji.json`, shown on reading gates via `mainReadings`) become the on'yomi and the kun'yomi used by the most common JMdict words, instead of the first ones KANJIDIC2 lists. Today 明 teaches あ(かり) and 図 teaches え; they should teach あか(るい) and はか(る) if the counts agree.

### User stories
- As the player on a 明 reading gate, I see めい and あか(るい), the readings I know from WaniKani, not あ(かり).
- As the player on 日, 上 or 間, nothing changes: the first-listed readings were already the common ones.
- As the owner at the checkpoint, I read a list of every kanji whose reading changed, old → new with the word counts, and flag the ones that look wrong; those become overrides.

## Rules

### Source
- Add JMdict (`http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz`, EDRDG, CC BY-SA 4.0) to `SOURCES` in `scripts/build-data.ts`, cached in `.data-cache/` like KANJIDIC2. Never committed.
- **Common word:** a JMdict entry with a kanji spelling (`keb`) whose `ke_pri` includes one of `news1`, `ichi1`, `spec1`, `spec2`, `gai1`. Its readings are the `reb`s that apply to that spelling (no `re_restr`, or `re_restr` naming it), keeping only common ones (same `re_pri` set) when any are common. Readings marked `re_nokanji` are skipped.
- Output still depends only on the cached files: two builds give identical JSON.

### Matching a word to readings (alignment)
For each (spelling, reading) pair of a common word:
- Walk the spelling. A kana character (katakana folded to hiragana) must match the reading literally. A kanji consumes one of its KANJIDIC2 readings (on'yomi in hiragana; kun'yomi base, without the `.` okurigana and leading/trailing `-`).
- Allowed sound changes, all counted towards the unchanged reading: **rendaku**, the first kana voiced (か→が, さ→ざ, た→だ, は→ば or ぱ); **sokuon**, an on'yomi ending in く, つ, ち or き whose last kana becomes っ (がく→がっ in 学校).
- `々` repeats the previous kanji's readings (with the same sound changes).
- A pair with a character that isn't one of our Jōyō kanji, kana or `々` is skipped.
- A kanji's reading in a pair counts only when **every** alignment of that pair gives it the same reading. Otherwise that kanji gets nothing from the pair (other kanji in the word still can).
- An entry counts **at most once** per kanji reading, however many of its pairs match.

### Which kun'yomi entry a match counts for
KANJIDIC2 lists kun'yomi as entries like `あか.るい`, `あ.かり`. A kun match counts for the entry whose base the kanji consumed **and** whose okurigana the spelling writes straight after the kanji (`明るい` → `あか.るい`). Among several such entries, the longest okurigana wins. An entry without okurigana matches whatever follows.

### Pick
- Taught on'yomi = the on'yomi with the most common entries; ties go to KANJIDIC2 order. All zero → first listed, as today.
- Taught kun'yomi = the kun entry with the most common entries; same tie and zero rules.
- **Overrides:** `scripts/reading-overrides.json`, `{ "<kanji>": { "on"?: "<on'yomi>", "kun"?: "<kun entry, e.g. あか.るい>", "why": "<reason>" } }`. An override wins over the count. The build fails if an override names a reading the kanji doesn't have in KANJIDIC2. Starts as `{}`; misses from the owner's review are added here.
- `readings` (every reading, used to keep distractors honest) is unchanged.
- The pick lives in its own module, `scripts/readings.ts`: pure functions (parse common words, align, count, pick) that `build-data.ts` calls.

### Report
The build writes `.data-cache/reading-report.txt` and prints a summary line ("N kanji changed on'yomi, M changed kun'yomi"). One row per kanji whose on or kun changed: kanji, level, old → new for each changed reading, and the top three candidates with counts. Overrides are marked.

### Effects in the game (no code change expected)
- Reading gates, distractors (other kanji's main readings) and the answer reveal use the new `on`/`kun` automatically.
- SRS is keyed per kanji (`<kanji> reading`), so progress carries over. No save-format change.
- Stories: unchanged matching. A new reading the WaniKani story doesn't cover shows the compound story or the "no story" line, as today.
- Gate labels: the longest new label must stay readable at `GATE_MIN_W` 0.18 (about 70 px on a 390-wide phone).

## Project Structure (changes)
- `scripts/readings.ts` (new): common-word parse, alignment, counting, pick, overrides check, report rows.
- `scripts/build-data.ts`: JMdict source; calls `scripts/readings.ts` for `on`/`kun`; writes the report.
- `scripts/reading-overrides.json` (new).
- `src/data/kanji.json`: regenerated.
- `tests/data/readings.test.ts` (new); `tests/data/kanji.test.ts` gains spot checks.
- `README.md`: credit JMdict alongside KANJIDIC2 and KRADFILE.

## Commands
`npm run data:build` (add `--refresh` to re-download), `npm run check`.

## Code Style
As the existing build script: small pure exported functions, regex XML parsing, no new dependencies.

## Testing Strategy
- **Synthetic fixtures** for `scripts/readings.ts` (tiny made-up JMdict XML and kanji).
- Common filter: `ke_pri` set; uncommon spelling skipped; `re_restr` honoured; `re_nokanji` skipped; common readings preferred over uncommon ones.
- Alignment: plain on + on; kun with okurigana; rendaku; sokuon; `々`; non-Jōyō character skips the pair; ambiguous alignment gives nothing to the ambiguous kanji only; entry counted once per reading.
- Kun entry attribution: `あか.るい` vs `あ.かり`; longest okurigana wins; entry without okurigana.
- Pick: most counts wins; tie → KANJIDIC2 order; all zero → first listed; override wins; unknown override reading throws.
- Real data (`tests/data/kanji.test.ts`): 明 kun `あか.るい`; 日 `にち`/`ひ` and 上 `じょう`/`うえ` unchanged; every kanji that had an on/kun still has one; `kanji.json` is deterministic.

## Boundaries
- Always: `npm run check` before commit; push after each task; re-run `npm run data:build` and commit the regenerated `src/data/`.
- Ask first: weighting by frequency rank instead of counting entries; adding any data source besides JMdict; changing what `readings` holds.
- Never: commit `.data-cache` or raw EDRDG downloads; copy WaniKani readings; touch SRS, the save format or level order.

## Success Criteria
1. 明 teaches あか(るい); 日, 上, 間 keep their readings.
2. The report lists every changed kanji with counts; the owner's review of it at Checkpoint R finds no more than a handful of misses, and each is fixed by an override.
3. On the phone, reading gates show the new readings, labels readable, and existing progress is intact.
4. `npm run check` passes; version 1.4.0 in `package.json` and `CHANGELOG.md`; README credits JMdict.

## Open Questions
1. How many kanji change? Unknown until the first build; Task R2 logs the numbers in the task list.
2. Is a plain entry count good enough, or do obscure-but-"common" entries skew a few kanji? The owner's review decides; overrides absorb the odd ones. If many look wrong, weighting is an "ask first" change.
