/// <reference types="node" />
/**
 * Dev-only clip coverage (SPEC-sound-effects §3): `npm run voice:coverage`.
 * Lists the `allSpoken` keys with no clip in `public/voice/<id>/index.json`
 * (the phone voice says those). Reports only, never fails.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
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
const dir = join("public/voice", config.id);
const bytes = Object.values(index).reduce(
  (sum, [file]) =>
    sum + (existsSync(join(dir, file)) ? statSync(join(dir, file)).size : 0),
  0,
);
console.log(
  `${config.name} (${config.id}): ${keys.length - missing.length}/${keys.length} keys have a clip (${pct.toFixed(1)}%), ${missing.length} missing; clips ${(bytes / 1024 / 1024).toFixed(1)} MB`,
);
if (missing.length)
  console.log(
    `missing: ${missing.slice(0, 50).join(" ")}${missing.length > 50 ? " …" : ""}`,
  );
