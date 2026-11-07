# Kanji Runner

A browser game for learning kana and kanji: steer an army through gates, pick the right answer, and beat the boss. Vite and strict TypeScript on a canvas. See `SPEC.md` for the rules.

```sh
npm install
npm run dev     # play locally
npm test        # unit tests
npm run lint
npm run build
```

`npm run data:build` regenerates `src/data/kanji.json` from the sources below. The generated JSON is committed, so the app needs no network at runtime.

## Attribution

Kanji data comes from the [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) and [KRADFILE](https://www.edrdg.org/krad/kradinf.html) files, the property of the [Electronic Dictionary Research and Development Group](https://www.edrdg.org/) (EDRDG), used in conformance with the group's [licence](https://www.edrdg.org/edrdg/licence.html): [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The generated data in `src/data/` is derived from them and shared under the same licence.
