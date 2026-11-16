# Private repo, page still hosted

Status: owner idea, 2026-11-17. Needs an interview.

## Idea
Make the repo private but keep the game hosted, ideally on free hosting.

## Today
Public repo, deployed to GitHub Pages by `.github/workflows/deploy.yml`; the build's base path is `/kanji-runner/` (`vite.config.ts`).

## Open questions
- Where to host: GitHub Pages from a private repo needs a paid plan; check which free hosts deploy from a private repo.
- A new URL moves the save data in the browser (local storage is per site) and any home-screen install. Check what Supabase sync and WaniKani need too.
