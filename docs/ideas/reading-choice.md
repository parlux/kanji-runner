# Teach the most useful reading first

Status: in progress (interviewed 2026-11-17). Intent: `docs/intent/reading-choice.md`.

## Idea
Like WaniKani, teach each kanji's reading that shows up in the most vocabulary. Today the taught on'yomi is simply the first one KANJIDIC2 lists (`scripts/build-data.ts`), which can be a rare one. Instead, count the common JMdict words that use each reading and teach the winner. This changes only the data build, with overrides for odd cases.

Use open data only (KANJIDIC2, JMdict). WaniKani's own reading choices are proprietary and can't be copied (`docs/intent/kanji-runner.md`).

## Open questions
- Should the taught reading become kun'yomi when that's the more common one (e.g. 山 やま vs サン)? Gates, distractors and stories would follow.
- What happens to progress on a reading that stops being taught?
- Does this shrink the "no story for this reading" gaps that [On'yomi stories from compound vocabulary](done/onyomi-compound-stories.md) targeted (done in v1.3.0)?
