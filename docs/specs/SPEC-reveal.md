# Spec: the other half after a right answer (v1.6)

Extends `docs/specs/done/SPEC.md` (v1) through `docs/specs/SPEC-stories.md` (v1.5). Everything there still holds unless this spec says otherwise. Intent: `docs/intent/answer-reveal.md`. Idea: `docs/ideas/answer-reveal.md`.

## Objective
Each right kanji answer briefly shows the half of the kanji that wasn't asked, so meaning gates also teach readings and reading gates also teach meanings. Display only: no change to the sim, scoring, selection or records.

### User stories
- As the player, when I pick "water" for 水, I see 水 みず · すい near my army for a moment.
- As the player, when I pick すい for 水, I see 水 water.
- As the player, the pop-up never hides the next question or its answers.

## Rules

### When
- Only after a **right** answer to a kanji **meaning** or **reading** gate (wall gates and squad charges alike). Nothing after a wrong answer, and nothing for kana or loanword gates.
- Shown for the same span as the existing answer feedback (`ANSWER_FEEDBACK_DIST` of track, about a second), fading out over its last part. A new right answer replaces it.

### What
- The kanji character, then:
  - **Meaning gate →** the kanji's main readings, as `mainReadings(k).map(showReading)` (the same list the run summary uses), separated by ` · `. Kun'yomi and on'yomi are told apart by colour (the existing reading-label colours: okurigana greyed as on gates), on'yomi then kun'yomi as in the summary. No "kun"/"on" labels.
  - **Reading gate →** the kanji's meaning, the same text a meaning gate for that kanji shows as its right answer.
- The kanji is looked up from the run's kanji data (Built-in or WaniKani mode) by the row's prompt. If it isn't found, nothing is shown.

### Where
- Near the army, clear of the existing `+N`/streak pop-up (to its right) and the army count: e.g. centred just above the army. It must stay below the next gate's prompt and labels at 390×844 and 1280×800, in 3D (overlay, unhazed: it's at the army) and in `?2d`.
- Size readable at a glance on the phone (around the answer-label size); long meanings fit or wrap to two lines within the screen.

## Testing
- **Unit:** a pure function from (row, kanji data, correct) to the reveal text parts: meaning gate → readings in order with their kind; reading gate → meaning; wrong answers, kana and loanword gates, and unknown kanji → nothing.
- **Unchanged:** the golden run and every existing test.
- **Browser:** 390×844 in 3D and `?2d`: a right meaning answer (a kanji with on'yomi and kun'yomi, one with okurigana), a right reading answer, a wrong answer (nothing), a long meaning; the next gate's prompt and labels uncovered. Screenshots in the scratchpad.

## Boundaries
- **Always:** keep `src/core` sim, scoring and selection unchanged; keep the pop-up off the next prompt and labels.
- **Never:** show the pop-up after a wrong answer, or labels like "kun"/"on".

## Success Criteria
1. Right kanji answers show the other half per the rules, in 3D and 2D (browser check).
2. Nothing is shown after wrong answers or for kana and loanwords (tested).
3. **Owner checkpoint:** on the phone, the pop-up reinforces the kanji without getting in the way.

## Out of Scope
Wrong-answer pop-ups, kana and loanword gates, components or mnemonics in the pop-up, a setting to turn it off.
