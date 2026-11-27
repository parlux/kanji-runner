# Useful Japanese, then drop WaniKani (epic)

Status: owner goal, 2026-11-17. Each round needs an interview. Replaces the ideas "Compound words as gates" and "Simple, common kanji first" (both folded in below; originals are in git history).

## Goal
Drop WaniKani by its renewal on **2027-03-14**, with an app whose progression teaches useful Japanese, not kanji characters.

- **Learn words, not characters.** A level brings words; kanji arrive when a word needs them.
- **Pick words for usefulness.** Travel and conversation first (numbers, people, money, food, transport, signs), then reading manga and easy stories.
- **Keep every learned kanji in use** by building later words from earlier kanji.
- **Measure success by coverage, not feel:** how much of a menu, a set of station signs, a phrasebook or a graded reader you can read at level N.
- **Be self-contained:** open data and our own stories, nothing from WaniKani (`docs/intent/kanji-runner.md`).

## Why: what WaniKani does that we don't
From the owner's WaniKani levels 1–7 (approximate counts, scratchpad only, nothing copied):

- **Words outnumber kanji about 2.5 to 1.** E.g. level 4 has 40 kanji and 102 words. Our levels have 30 kanji and only katakana loanwords; a kanji is taught, then left.
- **Three kinds of word, each teaching something:**
  - A kanji that is a word on its own (人, 石), about 25%. This is where kun'yomi lives.
  - Kanji plus kana (一つ, 入る, 小さい, 分かる), about 25%. Verbs and adjectives, so grammar endings from level 1. This is what makes it feel like Japanese.
  - Compounds (今日, 休日, 千円札), about 50%. This is where on'yomi pays off.
- **A level's kanji form words together** (右/左 with 手, 休 with 日). Our order (grade, then frequency, building blocks before each kanji) instead puts near-useless characters early: 干, 乙, 寸, 巾, 辛, 斤, 弓, 矛 in levels 2–6.
- **Old kanji return in new words** (今 in 今日 and 今月), so they stay active instead of only showing up as reviews.

## Rounds
1. **Word gates.** Done in v1.5.0 (2026-11-17): spec `docs/specs/done/SPEC-word-gates.md`; words ranked by TUBELEX (YouTube subtitles), which round 2 can build on. Test words of all three kinds, keeping the current kanji order. A word unlocks once all its kanji are learned, in Built-in mode too. Words and readings come from JMdict, not WaniKani.
   - Gates test the word's own reading, not one pieced together from its kanji: many useful words are irregular (一人 ひとり, 二人 ふたり, 今日 きょう, 大人 おとな).
   - The on'yomi stories round stores only one chosen compound per reading, so this needs its own word list.
   - Kana-only conversation words (すみません, ありがとう) could join the loanword gates.
2. **Useful-words order.** Done in v1.6.0/1.6.1 (2026-11-20): spec `docs/specs/done/SPEC-useful-order.md`, tasks `tasks/done/todo-useful-order.md`. Travel-text kanji coverage at Kanji 5/10: 52/73% (today's order 40/58, WaniKani 38/60); `npm run data:coverage`. Choose levels by usefulness for the cost in new kanji:
   - **Usefulness:** hand-written travel and conversation themes (highest weight), spoken frequency (subtitle corpus), and manga and easy-story frequency (lower weight).
   - **Cost:** the new kanji a word needs, weighted by how complex they are.
   - **Each level:** pick the most useful words for the cost, within a budget of new kanji. A kanji's building blocks still come before it, so stories keep working.
   - **Check:** measure coverage (phrasebook, menu, station signs, a free graded reader) against today's order and against the owner's WaniKani levels (scratchpad only).
3. **[Our own stories](done/own-stories.md).** Done 2026-11-27 (1.7.0). After the reorder, because a kanji's story builds on earlier parts and round 2 changes which parts come first. Stories only need to stay ahead of the owner, so this can ship the first levels and keep growing after WaniKani is dropped.
4. **[Show overall progress](overall-progress.md).** Levels, plus coverage and JLPT share from round 2's numbers, so the assessment has a yardstick besides feel.
5. **Checkpoint: assess against WaniKani.** No code. Ready to start by mid-February 2027, leaving a few weeks before the 2027-03-14 renewal. Pause WaniKani and use only the app; compare its coverage numbers with the owner's WaniKani levels (scratchpad only); then decide whether to renew. If the app falls short, the gaps found become the next rounds.

## JLPT
Use it as a yardstick, not the driver. N5/N4 word lists overlap heavily with travel and conversation, but they're unofficial and somewhat academic. Show it as progress ("72% of N5 words"), via [Show overall progress](overall-progress.md) once round 2 has the coverage numbers.

## Data (open only)
- **JMdict:** words, readings, and tags marking common words.
- **KANJIDIC2:** kanji, already used.
- **Subtitle frequency list:** e.g. from OpenSubtitles; check the licence.
- **Travel themes:** written by us.

## Open questions
- Round 2 reorders every level and moves learned kanji. How does existing progress and placement carry over?
- Pace: how many new kanji and words per level? The owner likes today's pace.
- WaniKani mode (taught list, SRS seeding, similar kanji: `src/core/pool.ts`, `src/game/wkstate.ts`) isn't used by the owner. Remove it with the stories in round 4?
