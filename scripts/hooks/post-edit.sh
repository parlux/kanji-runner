#!/bin/bash
# Claude Code PostToolUse hook (Edit|Write): lint and run related tests for an edited .ts file.
# Reads the hook JSON on stdin. Success prints a systemMessage; failure blocks with the first lines.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
case "$f" in *.ts) ;; *) exit 0 ;; esac
[ -f "$f" ] || exit 0
cd "$(dirname "$0")/../.." || exit 0
case "$f" in "$PWD"/*) ;; *) exit 0 ;; esac

out=$(
  npx eslint --cache "$f" 2>&1
  e1=$?
  npx vitest related --run "$f" 2>&1
  e2=$?
  exit $((e1 || e2))
)
rc=$?
name=${f#"$PWD"/}
if [ $rc -eq 0 ]; then
  jq -n --arg m "post-edit ok: $name (eslint, related tests)" '{systemMessage: $m}'
else
  head=$(printf '%s\n' "$out" | head -n 25)
  jq -n --arg r "post-edit FAILED for $name:"$'\n'"$head" '{decision: "block", reason: $r}'
fi
