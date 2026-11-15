#!/bin/bash
# Deploy guard: shipped code needs a new version number and a CHANGELOG entry.
# Tags v<version> are pushed by the deploy job after each successful deploy.
# While a round is open (tasks/todo-*.md at the top level) code may ship on the
# current version; the round's final task bumps it.
cd "$(dirname "$0")/.." || exit 1
v=$(node -p "require('./package.json').version")
rc=0
if ! grep -q "^## $v " CHANGELOG.md; then
  echo "check-version: CHANGELOG.md has no '## $v (date)' heading." >&2
  rc=1
fi
if compgen -G "tasks/todo-*.md" >/dev/null; then
  echo "check-version: round open, bump not enforced yet."
  exit $rc
fi
if grep -q "^## Unreleased" CHANGELOG.md; then
  echo "check-version: CHANGELOG.md has an 'Unreleased' section; give it a version." >&2
  rc=1
fi
if git rev-parse -q --verify "refs/tags/v$v" >/dev/null &&
  ! git diff --quiet "v$v" HEAD -- src index.html vite.config.ts package-lock.json; then
  echo "check-version: shipped code changed since v$v. Bump: npm version patch (fix) or minor (feat) --no-git-tag-version." >&2
  git diff --stat "v$v" HEAD -- src index.html vite.config.ts package-lock.json >&2
  rc=1
fi
[ $rc = 0 ] && echo "check-version ok: v$v"
exit $rc
