import { KANJI } from "../../src/core/kanji";
import type { KanjiItem } from "../../src/core/types";

/**
 * A synthetic WaniKani list: real characters and components, but made-up
 * glosses, readings, stages and `similar` links. No WaniKani content.
 */
export type WkExtrasLike = {
  srsStage: number;
  due: boolean;
  similar: string[];
};

const SYL = "かきくけこさしすせそたちつてとなにぬねの".split("");

/** `n` made-up taught kanji. Every 7th shares a gloss and a reading with the one before. */
export function syntheticList(n = 60): {
  level: number;
  kanji: KanjiItem[];
  extras: Map<string, WkExtrasLike>;
} {
  const kanji: KanjiItem[] = KANJI.slice(0, n).map((k, i) => {
    const on = `${SYL[i % 20]}${SYL[(i * 7 + 3) % 20]}`;
    const prev = `${SYL[(i - 1 + 20) % 20]}${SYL[((i - 1) * 7 + 3 + 140) % 20]}`;
    const kunBase = `${SYL[(i * 3) % 20]}`;
    const glosses = [`thing ${i}`, `idea ${i}`];
    const readings = [on, `${kunBase}る`];
    if (i % 7 === 6) {
      glosses.push(`thing ${i - 1}`);
      readings.push(prev);
    }
    return {
      char: k.char,
      level: 1 + Math.floor(i / 20),
      grade: 8,
      freq: null,
      glosses,
      on,
      kun: { base: kunBase, okurigana: "る" },
      readings,
      components: k.components,
    };
  });
  const extras = new Map<string, WkExtrasLike>();
  kanji.forEach((k, i) =>
    extras.set(k.char, {
      srsStage: 1 + (i % 9),
      due: i % 2 === 0,
      similar: [1, 2, 13]
        .map((d) => kanji[(i + d) % n]?.char as string)
        .filter((c) => c !== k.char),
    }),
  );
  return { level: 3, kanji, extras };
}
