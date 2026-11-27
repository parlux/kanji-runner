# Kanji Runner

A browser game for learning kana and kanji: steer an army through gates, pick the right answer, and beat the boss. Vite and strict TypeScript on a canvas. See `docs/specs/done/SPEC.md` for the rules.

```sh
npm install
npm run dev     # play locally
npm test        # unit tests
npm run lint
npm run build
```

`npm run data:build` regenerates `src/data/` (kanji, words) from the sources below. The generated JSON is committed, so the app needs no network at runtime.

## Attribution

Kanji data comes from the [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project), [KRADFILE](https://www.edrdg.org/krad/kradinf.html) and [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) files (JMdict picks which readings to teach and supplies the kanji words and their glosses), the property of the [Electronic Dictionary Research and Development Group](https://www.edrdg.org/) (EDRDG), used in conformance with the group's [licence](https://www.edrdg.org/edrdg/licence.html): [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). KRADFILE's element lists decide which kanji come first. The parts each kanji shows come from [KanjiVG](https://kanjivg.tagaini.net/) (release [r20250816](https://github.com/KanjiVG/kanjivg/releases/tag/r20250816)), by Ulrich Apel and contributors, used under [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The generated data in `src/data/` is derived from these sources and shared under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), as both licences allow.

The mnemonic stories in `dictionary/` (meaning and reading stories for every kanji, part names and notes, and the on'yomi sound keywords) are our own, written for Kanji Runner and checked against `dictionary/STYLE.md`. WaniKani's mnemonics were used only as a side-by-side check that none of ours is copied: no WaniKani text is in this repository or the app.

Which kanji words each level teaches is ranked by everyday usage from the [TUBELEX](https://github.com/naist-nlp/tubelex) Japanese word frequency list (YouTube subtitles, UniDic 3.1.0 lemmas; Adam Nohejl et al., NAIST), Copyright (c) 2022-4 Adam Nohejl, used under its [BSD 3-Clause licence](https://github.com/naist-nlp/tubelex/blob/main/LICENSE). Only the ranking is used; no list data ships in the app. Rebuilding the data needs the `xz` command to unpack it.

Which kanji come first is judged by everyday usefulness, using example sentences from [Tatoeba](https://tatoeba.org/) (Japanese sentences, licensed [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/)) to count words in easy text. A development-only coverage check (`npm run data:coverage`) reads children's stories from [Aozora Bunko](https://www.aozora.gr.jp/), public domain texts. Neither source ships in the app; both are cached locally and never committed.
