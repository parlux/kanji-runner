# Install as an app on the phone

Status: raw owner idea, 2026-11-15. Not yet interviewed or specced.

## Idea
Let the game (GitHub Pages site) be installed to the phone's home screen and open like an app: own icon, full screen, no browser bar.

## Today
No web app manifest, no service worker, no app icons (`index.html`, `vite.config.ts`).

## Open questions (for the interview)
- Which phone/browser matters: iOS Safari ("Add to Home Screen"), Android Chrome (install prompt), or both?
- Offline play: should it work with no connection (service worker caching), or just install and still need the network? WaniKani and Supabase sync need the network either way.
- Updates: how a new deploy reaches an installed copy (auto-refresh vs. "new version" prompt), given the version-per-fix rule.
- Icon and name: who makes the icon; short name under the icon.
- Orientation lock (portrait?) and status-bar colour.
- In-game "Install" hint, or leave it to the browser?
