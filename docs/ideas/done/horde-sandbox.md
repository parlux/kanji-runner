# Idea: horde gauntlet (tuning run)

Status: owner idea, 2026-11-14, during v1.10 hordes. Queued after Task H5b, before H6 (kill effects).

Owner: "if we still can't get it right, I'd like to set up a playable test run of just killing armies, with different settings and army strengths and sizes, to really tune it. It's an important mechanic." And: "I'd want each army to have different settings, so I can say army 3 and 5 felt right, 4 felt off, etc, to feed back and tune. I'm fiddling with knobs I don't understand."

So: the owner reacts, the orchestrator turns the knobs.
- `?sandbox=horde` (behind the dev gear): no questions or walls, a gauntlet of numbered waves. Each wave has its own preset (army size, enemy count, kill time, spread, adapt), chosen to sweep the settings sensibly (e.g. one variable at a time across a few waves). A big "Wave N" label before each.
- After each wave, a one-tap rating: Felt right / Too fast / Too slow / Too few / Too many. Then the next wave.
- A per-wave log: preset, measured kill time, soldiers lost, fps, rating. "Copy results" puts it on the clipboard as text for the owner to paste into chat.
- The preset list lives in one data file, so the next gauntlet is a quick edit.

## Getting results from the phone (owner chose, 2026-11-14)
- Results save to the owner's Supabase account (the game's existing login/sync), one row per gauntlet run in a new `tuning_results` table (user_id, created_at, data jsonb) with row-level security like `progress` (own insert, own select). Its SQL goes in `supabase/schema.sql`; the owner runs it once in the Supabase dashboard.
- The orchestrator reads them on the laptop with a script (`scripts/gauntlet-results.ts`, prints the latest runs). The script needs a service-role key in `.env.local` (never committed; the owner adds it once), because RLS hides rows from the publishable key.
- Fallback: a Share button (Web Share API) on the results screen, and Copy.
