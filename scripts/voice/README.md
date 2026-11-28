# Voice clips

`npm run voice:build` renders every line a gate can say (`allSpoken` in
`src/core/speech.ts`) through a running VOICEVOX engine and writes
`public/voice/<id>/<hash8>.m4a` plus `index.json` (`{ key: [file, ms] }`).
`npm run voice:coverage` lists the keys still without a clip. The character
(style id, credit name, speed) is in `voice.config.json`. Spec:
`docs/specs/SPEC-sound-effects.md` §3–4.

Options: `--force` (re-render kept clips), `--limit N`, `--keys 毎年,にち|にち`
(by text or full key), `--config <file>`, `--out <dir>`. `VOICEVOX_URL`
overrides the engine (default `http://127.0.0.1:50021`). Needs `ffmpeg` and
`ffprobe` on the PATH. A full build is ~3,900 clips at ~0.6 s each (~40 min).

What it does per key: `audio_query` on the written form; if its moras read
like the reading (long おう/えい/ー heard as the engine writes them), that
query is used (dictionary pitch accent), else the reading is queried (e.g.
日本 reads にっぽん, so にほん is queried). A reading the engine reads wrong or
in pieces is tried in the other kana (hiragana はち reads ワチ, ぜい reads
ゼ・イ; katakana ハチ, ゼイ read right); one still in pieces is joined into one
accent phrase. The build reports the fallbacks, joins and any misreads. Then
`synthesis`, silence trimmed with short fades, loudness evened (mean −16 dB,
peak ≤ −1 dB), mono AAC 40 kbps.

## Running the engine in a cloud session (Linux)

The engine's Linux CPU release downloads from GitHub releases (no API needed;
`git ls-remote --tags https://github.com/VOICEVOX/voicevox_engine` lists
versions). Keep it in the session's scratchpad, never in the repo.

```sh
SP=<scratchpad>            # e.g. /tmp/claude-0/<project>/<session>/scratchpad
mkdir -p $SP/vv && cd $SP/vv
curl -L -o engine.7z.001 https://github.com/VOICEVOX/voicevox_engine/releases/download/0.26.2/voicevox_engine-linux-cpu-x64-0.26.2.7z.001
apt-get install -y 7zip          # gives /usr/bin/7z
7z x engine.7z.001 && rm engine.7z.001   # → $SP/vv/linux-cpu-x64 (2.2 GB, all models)
cd linux-cpu-x64 && chmod +x run
nohup ./run --host 127.0.0.1 --port 50021 > $SP/vv/engine.log 2>&1 &
curl -s http://127.0.0.1:50021/version   # "0.26.2" once up (a few seconds)
```

In Task A3's session it ran from
`/tmp/claude-0/-home-user-kanji-runner/08cc6a50-0e53-570a-9f84-7fc69c5bf743/scratchpad/vv/linux-cpu-x64`
on port 50021; if that folder still exists, only the last three lines are
needed. Character terms ship with the engine:
`linux-cpu-x64/resources/character_info/<uuid>/policy.md`.

## Running it on a Mac

Either open the VOICEVOX app (https://voicevox.hiroshiba.jp/; it serves the
engine on `http://127.0.0.1:50021` while open), or run the engine release
alone, as Task A4 did on the owner's Mac (Intel, macOS 12):

```sh
SP=<scratchpad>; mkdir -p $SP/vv && cd $SP/vv
# 0.25+ needs macOS 15 (its ONNX Runtime links a newer libc++); 0.24.1 runs on 12.
# On Apple silicon use macos-arm64 instead of macos-x64.
gh release download 0.24.1 --repo VOICEVOX/voicevox_engine -p 'voicevox_engine-macos-x64-0.24.1.7z.001'
7za x voicevox_engine-macos-x64-0.24.1.7z.001 && rm voicevox_engine-macos-x64-0.24.1.7z.001
cd macos-x64 && chmod +x run
nohup ./run --host 127.0.0.1 --port 50021 > $SP/vv/engine.log 2>&1 &
curl -s http://127.0.0.1:50021/version   # "0.24.1"
```

No `7z` or `ffmpeg` from Homebrew on macOS 12 (no bottles); the npm packages
`7zip-bin`, `ffmpeg-static` and `ffprobe-static`, installed in the scratchpad
(never the repo), give working binaries: put them on the PATH for the build.
The Docker image (`voicevox/voicevox_engine:cpu-0.26.2`) also works, but on an
8 GB Mac its VM pushes the engine into swap (~7 s a clip instead of ~2 s).

Then, in the repo: `npm run voice:build` (try `-- --limit 20` first; the full
build took ~80 min on a 2015 dual-core i5), `npm run voice:coverage`, commit
`public/voice/` and push.

## Style ids (from the VOICEVOX model table)

| Character | Style | id |
|---|---|---|
| ずんだもん | ノーマル / あまあま / ツンツン | 3 / 1 / 7 |
| 四国めたん | ノーマル / あまあま / ツンツン | 2 / 0 / 6 |
| 春日部つむぎ | ノーマル | 8 |
| 冥鳴ひまり | ノーマル | 14 |
| 青山龍星 | ノーマル / 喜び / 熱血 | 13 / 83 / 81 |

Credit as each character asks: `VOICEVOX:<name>` (start screen and README).
