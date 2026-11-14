#!/bin/bash
# Fast check: tests related to changed .ts files, typecheck and lint, run in parallel.
cd "$(dirname "$0")/.." || exit 1
files=$(git diff --name-only --diff-filter=d HEAD -- '*.ts'; git ls-files -o --exclude-standard -- '*.ts')
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
run() { name=$1; shift; "$@" >"$dir/$name.log" 2>&1; echo $? >"$dir/$name.rc"; }
[ -z "$files" ] || run test npx vitest related --run $files &
run types npm run -s typecheck &
run lint npm run -s lint &
wait
rc=0
for n in test types lint; do
  [ -f "$dir/$n.rc" ] || continue
  if [ "$(cat "$dir/$n.rc")" != 0 ]; then rc=1; echo "FAILED: $n"; cat "$dir/$n.log"; fi
done
[ $rc = 0 ] && echo "check:fast ok"
exit $rc
