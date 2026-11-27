# Story style guide

How to write (and judge) the stories in this dictionary. The writer follows it; the judge checks every entry against it. Spec: `docs/specs/done/SPEC-own-stories.md`.

## What you get

For each level, an input file from `npm run stories:prep -- <levels>` (in `.data-cache/stories/in/kanji-NNN.json`). Per kanji:

- `char`, `glosses` (the first gloss is the meaning the game asks for), `on` (main on'yomi, hiragana, or null), `kun` (main kun'yomi as the game shows it, okurigana in brackets: `やす(む)`, or null), `readings` (all readings, for context only).
- `components`: the kanji's parts, each with its name from `parts.json` (null if not named yet).
- `onSound`: the `sounds.json` keyword for the on'yomi, or null.
- `words`: a few words from our levels that use the kanji (word, reading, gloss). Use them for context or a kun story.
- `earlier`: earlier kanji that appear as parts of this one.

Plus `parts.json` (part names) and `sounds.json` (sound keywords). Work from these files only. Never read WaniKani material (`.data-cache/stories/wk-library.json`), overlap reports or judge files, and do not write from memory of WaniKani's or any other course's mnemonics.

## Output

`dictionary/stories/kanji-NNN.json` (`kanji-001.json` is "Kanji 1", game level 2):

```json
{
  "level": "Kanji 1",
  "kanji": {
    "休": { "meaning": "…", "on": "…", "kun": "…" }
  }
}
```

- Every kanji of the level, no others. `meaning` always; `on` only when the input has `on`, `kun` only when it has `kun`.
- Markup, nothing else: `<part>` a part name, `<kanji>` the kanji's meaning word, `<sound>` the sound-alike chunk of a reading story (below), `<ja>` other Japanese text, `<em>` emphasis. No attributes, no nesting tricks, every tag closed.
- Run `npm run stories:check -- <levels>` and fix every error. Read the warnings.

## Meaning story

- 1–4 sentences, 120–600 characters of plain text (tags don't count).
- Names every part, using its `parts.json` name exactly (case aside), each wrapped in `<part>`: `<part>tree</part>`. Don't pluralise or reword inside the tag ("two `<part>tree</part>` trunks", not `<part>trees</part>`). If a part really can't be seen in the glyph, leave it out; the checker lists it as a warning for the judge. Never rationalise an invisible part into the scene (no "lid" in 円 or 味).
- The input's components come from a flat decomposition, so a list can hold a part and its own sub-parts (味: mouth, tree, pole, eight, two). Name either the whole or the pieces, never both: one tree, not tree + pole + eight.
- Lands on the meaning: the first gloss, in `<kanji>`, ideally near the end. Other glosses may appear as plain text.
- Concrete, visual, a little absurd. One scene the reader can picture, with the parts doing something. Prefer action and a twist over a description.
- No puns that need the reader to know WaniKani or any other course.

## Reading stories (`on`, `kun`)

- 1–3 sentences, 40–350 characters of plain text.
- Ties the meaning (or the meaning story's scene) to the reading's sound.
- When `onSound` has a keyword, use it: the same sound always calls up the same image across all kanji. Only the keyword's matching syllable is the sound (the `sounds.json` note says how much counts); make that clear, don't make the reader say the whole word. Without a keyword, pick an English sound-alike and say how it sounds.
- Sounds that come in sets (しょう / しょ / しょく, よう / よ / よく): make the length or final consonant obvious in the scene, so the reader can't mix up the set.
- Japanese vowels are pure, and the keyword's vowel must be the same one (owner, 2026-11-20): あ is "ah" (spa, father), never the flat English a of cat, can, cab, candle or anchor; the "u" of cup (tub, hut, duck, mug, won) also counts as あ for this owner (2026-11-20); い is "ee"; う is a short "oo" with no w in front ("woo", wolf, "you" are not う); え is "eh" (bed); お is "oh" cut short. Test the keyword aloud against the kana, syllable by syllable. Loanwords English speakers say the Japanese way (katsu, karate, sushi) are fine.
- Never borrow a long-vowel keyword for a short sound, in `on` or `kun` stories: "toe" is とう, so it can't stand for short と (おっと, おとこ); "dough" is どう, not ど. Find a sound-alike with the short vowel.
- The story must produce every syllable of the reading, and a sound-alike keeps its real ending ("oats" gives おつ only if the s stays as つ; don't drop letters that are part of the reading).
- A picture, not a caption: "it sounds like the English word X" with no scene, or a hook that only restates the meaning, is weak.
- Show the sound, don't explain it. No closing sentence that says what the reading is, and no kana at all: `<reading>` is not used in our stories. The reading story ends with the scene.
- Wrap the chunk of an English word that carries the sound in `<sound>`: `a steel <sound>sa</sound>fe`. One `<sound>` per word that carries a piece of the reading, in reading order, so the reader hears the syllables in sequence. 1–6 Latin letters, no nesting, `on` and `kun` only (never in `meaning`). When the spelling isn't exact, mark the closest chunk (`<sound>Sa</sound>fe` for せい). Sneeze or noise sounds count as words (`'<sound>tsu</sound>!'`).
- `on`: when `onSound` has a keyword, the `<sound>` chunk plus the letters touching it in the same word must spell the keyword (or one word of a multi-word keyword), ignoring case. The checker enforces it.
- `kun`: highlight the pieces of the kun reading (the base, without okurigana) the same way. The story may use the okurigana word (`<ja>休む</ja>`) when the scene needs it. Add a short meaning tail ("…: a pair") only when the kun word's meaning differs from the kanji's glosses; otherwise stop at the scene.

## Building on earlier levels

- A part that is an earlier kanji is called by its `parts.json` name. That is normally the kanji's first gloss, but some parts have a more drawable name (日 is the part "sun" though the kanji means "day"). Always use the part name in `<part>`, and still land on this kanji's own gloss in `<kanji>`.
- Reuse an image from an earlier story where it comes naturally; a recurring character is fine. Don't force it.

## Language

- Plain English, short words. No cultural knowledge needed (no TV shows, brands, celebrities, sports rules, holidays of one country).
- Nothing offensive: no slurs, nothing sexual, no cruelty played for laughs, no stereotypes.
- Nothing that only works in American (or British) English: avoid sound-alikes that depend on one accent, and spellings or words one side wouldn't know.

## Part names and notes (`parts.json`)
- A part's name says what its shape looks like, so a reader can see it in the glyph. A name that only fits through history or etymology is replaced by a visible shape (⻏ is a squashed 邑 "town", so "village" fails: name what the stroke shape looks like).
- A part that is its own character, named by that character's meaning (戈 spear, 豕 pig, 隹 sparrow, 虍 tiger), keeps that name: the shape is a stylised picture of it and the reader meets the meaning again. These are marked `"fixed": true` and are not put up for review; the note says how to see the thing in the shape. Rename only a squashed variant whose meaning came from a different shape (⻏ from 邑, ⺘ from 手).
- Exception: a part that is itself a kanji in our levels keeps that kanji's meaning (or an existing more drawable name, like 日 "sun"); its note says how the shape shows it, or that it is that kanji.
- Names are unique, 1–3 words, plain English, concrete nouns you can draw. One shape, one name: a glyph that is the same shape as another part (⻏ and ⻖, the same 阝 on the right or left) gets `sameAs` and the same name, wherever it sits in a kanji.
- Every part has a `note`: one sentence, 20–120 characters, saying what in the glyph the name points at ("Three short strokes stacked like water drops"). Describe strokes and positions, not history. Our own words.

## Example (made up, not a real entry)

休, glosses `rest`, parts `coat hook` + `tree`, on `きゅう`, kun `やす(む)`, sound keyword for きゅう: `cue` (a pool cue).

- meaning: `A tired hiker hangs his jacket on a <part>coat hook</part> nailed to a <part>tree</part> and flops down in its shade, snoring. The tree doesn't mind: it was planning a day off too. Both of them <kanji>rest</kanji> until the moon comes up.`
- on: `The resting person uses a pool <sound>cue</sound> to scratch their back without getting up. Even rest needs the right tool.`
- kun: `A friend shakes the sleeper: "Get up!" A sleepy voice answers "<sound>Ya</sound>, <sound>sue</sound> me, I'm on a break." That is how <ja>休む</ja> goes.`

Why it works: every part named and visible in the scene, the meaning lands last in `<kanji>`, each reading story reuses the meaning scene and marks its sound-alike chunks with `<sound>`, no kana and no explainer.

## Judge's checklist

Pass, or fail with one reason:

- `wrong`: a part that isn't in the kanji, a wrong meaning, a reading story that doesn't make the sound.
- `weak`: no picture, confusing, too long to remember, a sound-alike that doesn't sound alike, breaks a rule above.
- Parts: every named part is visible in the glyph; no part named together with its own sub-parts.
- Part names and notes: the name is a visible shape (or the part's own kanji meaning); the note is true to the glyph and in band.
- `close`: too near WaniKani's story for this kanji (same scene, same twist or same phrasing), or uses one of WaniKani's invented radical names or recurring reading characters.
