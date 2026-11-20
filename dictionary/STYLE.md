# Story style guide

How to write (and judge) the stories in this dictionary. The writer follows it; the judge checks every entry against it. Spec: `docs/specs/SPEC-own-stories.md`.

## What you get

For each level, an input file from `npm run stories:prep -- <levels>` (in `.data-cache/stories/in/kanji-NN.json`). Per kanji:

- `char`, `glosses` (the first gloss is the meaning the game asks for), `on` (main on'yomi, hiragana, or null), `kun` (main kun'yomi as the game shows it, okurigana in brackets: `やす(む)`, or null), `readings` (all readings, for context only).
- `components`: the kanji's parts, each with its name from `parts.json` (null if not named yet).
- `onSound`: the `sounds.json` keyword for the on'yomi, or null.
- `words`: a few words from our levels that use the kanji (word, reading, gloss). Use them for context or a kun story.
- `earlier`: earlier kanji that appear as parts of this one.

Plus `parts.json` (part names) and `sounds.json` (sound keywords). Work from these files only. Never read WaniKani material (`.data-cache/stories/wk-library.json`), overlap reports or judge files, and do not write from memory of WaniKani's or any other course's mnemonics.

## Output

`dictionary/stories/kanji-NN.json` (`kanji-01.json` is "Kanji 1", game level 2):

```json
{
  "level": "Kanji 1",
  "kanji": {
    "休": { "meaning": "…", "on": "…", "kun": "…" }
  }
}
```

- Every kanji of the level, no others. `meaning` always; `on` only when the input has `on`, `kun` only when it has `kun`.
- Markup, nothing else: `<part>` a part name, `<kanji>` the kanji's meaning word, `<reading>` the reading in kana, `<ja>` other Japanese text, `<em>` emphasis. No attributes, no nesting tricks, every tag closed.
- Run `npm run stories:check -- <levels>` and fix every error. Read the warnings.

## Meaning story

- 1–4 sentences, 120–600 characters of plain text (tags don't count).
- Names every part, using its `parts.json` name exactly (case aside), each wrapped in `<part>`: `<part>tree</part>`. Don't pluralise or reword inside the tag ("two `<part>tree</part>` trunks", not `<part>trees</part>`). If a part really can't be seen in the glyph, leave it out; the checker lists it as a warning for the judge. Never rationalise an invisible part into the scene (no "lid" in 円 or 味).
- The input's components come from a flat decomposition, so a list can hold a part and its own sub-parts (味: mouth, tree, pole, eight, two). Name either the whole or the pieces, never both: one tree, not tree + pole + eight.
- Lands on the meaning: the first gloss, in `<kanji>`, ideally near the end. Other glosses may appear as plain text.
- Concrete, visual, a little absurd. One scene the reader can picture, with the parts doing something. Prefer action and a twist over a description.
- No puns that need the reader to know WaniKani or any other course.

## Reading stories (`on`, `kun`)

- 1–3 sentences, 60–450 characters of plain text.
- Ties the meaning (or the meaning story's scene) to the reading's sound.
- When `onSound` has a keyword, use it: the same sound always calls up the same image across all kanji. Only the keyword's matching syllable is the sound (the `sounds.json` note says how much counts); make that clear, don't make the reader say the whole word. Without a keyword, pick an English sound-alike and say how it sounds.
- Sounds that come in sets (しょう / しょ / しょく, よう / よ / よく): make the length or final consonant obvious in the scene, so the reader can't mix up the set.
- Never borrow a long-vowel keyword for a short sound, in `on` or `kun` stories: "toe" is とう, so it can't stand for short と (おっと, おとこ); "dough" is どう, not ど. Find a sound-alike with the short vowel.
- The story must produce every syllable of the reading, and a sound-alike keeps its real ending ("oats" gives おつ only if the s stays as つ; don't drop letters that are part of the reading).
- A picture, not a caption: "it sounds like the English word X" with no scene, or a hook that only restates the meaning, is weak.
- Spell the reading in `<reading>` kana, exactly the hiragana from the input: `<reading>きゅう</reading>`. For `kun`, the base (`<reading>やす</reading>`) or base plus okurigana (`<reading>やすむ</reading>`); the story may use the okurigana word (`<ja>休む</ja>`). Every `<reading>` tag must hold that story's reading, nothing else.

## Building on earlier levels

- A part that is an earlier kanji is called by its `parts.json` name. That is normally the kanji's first gloss, but some parts have a more drawable name (日 is the part "sun" though the kanji means "day"). Always use the part name in `<part>`, and still land on this kanji's own gloss in `<kanji>`.
- Reuse an image from an earlier story where it comes naturally; a recurring character is fine. Don't force it.

## Language

- Plain English, short words. No cultural knowledge needed (no TV shows, brands, celebrities, sports rules, holidays of one country).
- Nothing offensive: no slurs, nothing sexual, no cruelty played for laughs, no stereotypes.
- Nothing that only works in American (or British) English: avoid sound-alikes that depend on one accent, and spellings or words one side wouldn't know.

## Part names and notes (`parts.json`)
- A part's name says what its shape looks like, so a reader can see it in the glyph. A name that only fits through history or etymology is replaced by a visible shape (⻏ is a squashed 邑 "town", so "village" fails: name what the stroke shape looks like).
- Exception: a part that is itself a kanji in our levels keeps that kanji's meaning (or an existing more drawable name, like 日 "sun"); its note says how the shape shows it, or that it is that kanji.
- Names are unique, 1–3 words, plain English, concrete nouns you can draw. One shape, one name: a glyph that is the same shape as another part (⻏ and ⻖, the same 阝 on the right or left) gets `sameAs` and the same name, wherever it sits in a kanji.
- Every part has a `note`: one sentence, 20–120 characters, saying what in the glyph the name points at ("Three short strokes stacked like water drops"). Describe strokes and positions, not history. Our own words.

## Example (made up, not a real entry)

休, glosses `rest`, parts `leaning person` + `tree`, on `きゅう`, kun `やす(む)`, sound keyword for きゅう: `cue` (a pool cue).

- meaning: `A tired <part>leaning person</part> hugs a <part>tree</part> like a giant pillow and starts snoring. The tree doesn't mind: it was planning a day off too. Both of them <kanji>rest</kanji> until the moon comes up.`
- on: `The resting person uses a pool <em>cue</em> to scratch their back without getting up: <reading>きゅう</reading>. Even rest needs the right tool.`
- kun: `A friend shakes the sleeper: "Get up!" A sleepy voice answers "<reading>やす</reading>… ya, sue me, I'm on a break." <ja>休む</ja> means to take that break.`

Why it works: every part named and visible in the scene, the meaning lands last in `<kanji>`, each reading story reuses the meaning scene and hangs the sound on one clear sound-alike.

## Judge's checklist

Pass, or fail with one reason:

- `wrong`: a part that isn't in the kanji, a wrong meaning, a reading story that doesn't make the sound.
- `weak`: no picture, confusing, too long to remember, a sound-alike that doesn't sound alike, breaks a rule above.
- Parts: every named part is visible in the glyph; no part named together with its own sub-parts.
- Part names and notes: the name is a visible shape (or the part's own kanji meaning); the note is true to the glyph and in band.
- `close`: too near WaniKani's story for this kanji (same scene, same twist or same phrasing), or uses one of WaniKani's invented radical names or recurring reading characters.
