# Session progress

Status: refined with the owner via interview, 2026-11-09. Confirmed intent; spec it after the reask round (`SPEC-reask.md`) is done.

## Problem
While relearning and catching up, the owner loses most runs. A loss gives no sense of whether anything is sticking; the study screen only shows misses.

## Confirmed intent
- **Outcome:** a "this session" panel listing **fixed** items (missed earlier this session, answered right since) and **still missing** items (last answer this session was a miss).
- **When shown:** during the session, updated after every run on the end-of-run screen; not only when the owner stops.
- **Session:** starts at the first run; ends after 30+ minutes with no runs. Length varies (1 run to 10+), so don't design around a typical count.
- **Fixed rule:** missed, then right once → fixed. A later miss in the same session moves it back to still missing.
- **Tracking:** per gate (`水:meaning` and `水:reading` separately), shown by character with a small "reading" tag where relevant. Kana count the same way.

## Out of scope (for now)
- Trends across days ("am I getting better over the week") — owner wants to revisit later.
- Accuracy percentages, Leitner box stats.
- A manual "new session" button.
- Syncing session state across devices.
