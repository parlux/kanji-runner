/// <reference types="node" />
/**
 * Dev-only clip coverage (SPEC-sound-effects §3): `npm run voice:coverage`.
 * Lists the `allSpoken` keys with no clip in `public/voice/<id>/index.json`
 * (the phone voice says those). Reports only, never fails.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { KANA } from "../../src/core/kana";
import { KANJI } from "../../src/core/kanji";
import { allSpoken, clipKey } from "../../src/core/speech";
import { WORDS } from "../../src/core/words";
import { CONFIG, type ClipIndex, type VoiceConfig } from "./build";

const config = JSON.parse(readFileSync(CONFIG, "utf8")) as VoiceConfig;
const indexFile = join("public/voice", config.id, "index.json");
const index: ClipIndex = existsSync(indexFile)
  ? (JSON.parse(readFileSync(indexFile, "utf8")) as ClipIndex)
  : {};
const keys = allSpoken({ kana: KANA, kanji: KANJI, words: WORDS }).map(clipKey);
const missing = keys.filter((k) => !index[k]);
const pct = (100 * (keys.length - missing.length)) / keys.length;
console.log(
  `${config.name} (${config.id}): ${keys.length - missing.length}/${keys.length} keys have a clip (${pct.toFixed(1)}%), ${missing.length} missing`,
);
if (missing.length)
  console.log(
    `missing: ${missing.slice(0, 50).join(" ")}${missing.length > 50 ? " …" : ""}`,
  );
