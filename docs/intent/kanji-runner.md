# Intent: Kanji Runner

Status: confirmed by user, 2026-11-07. Input for `spec-driven-development`.

## Statement of intent

- **Outcome:** A browser runner game where you steer a growing army through gates. Each gate shows a kanji (or kana); picking the correct meaning grows the army, picking wrong shrinks it. Streaks escalate the payoff (e.g. +5 → +10 → ×2 → ×3). The run ends in a boss clash decided by army size.
- **User:** The project owner only. Returning Japanese learner: knew all kana but rusty after a year off (expected to return quickly); studied kanji on WaniKani for a while but has forgotten most.
- **Why:** The fun of the genre is the snowball (army growing from a few to hundreds). What makes it interesting is picking the right gate under time pressure. Making those picks Japanese practice means play time isn't wasted.
- **Success:** Every run feels different (procedural), and forgotten kanji come back because weak characters resurface more often.
- **Constraint:** Personal use. Runs in the browser, progress saved locally. No accounts, no backend, no WaniKani API.
- **Platform:** Laptop with arrow keys first, with touch support for phone.

## Decisions made (and why)

| Decision | Reason |
|---|---|
| No maths gates at all | User chose the kanji/kana version over the original number-gate idea. Numbers remain only as the *reward*, not the puzzle. |
| Army growth comes from correctness + streaks | User wanted to keep the upgrade/snowball feel without `+10`/`×2` puzzle gates. Streaks provide the escalation; a wrong pick breaks the streak, raising stakes. |
| Harder characters pay more | Adds a risk/reward choice instead of a pure quiz. |
| Default gate: kanji → English meaning | Fastest to judge at running speed; matches how WaniKani introduces kanji. |
| Reading gates (kanji → reading, e.g. 水 → みず / すい) as harder, higher-paying type | Adds depth for later levels. |
| Kana as warm-up, then kanji | Kana should return quickly; kanji is the main value. |
| Kanji ordered in a WaniKani-like level progression | Lines up with what the user previously studied. |
| Kanji data from open sources (e.g. KANJIDIC), not WaniKani content | WaniKani's content isn't free to redistribute. |
| Lightweight SRS stored in browser (localStorage) | Weak characters reappear more often; no backend needed. User explicitly approved. |
| Procedural runs | User said it would be cool if it wasn't the same every run. |

## Out of scope

- Maths/number puzzle gates
- English → kanji gates (possible later)
- Multiplayer, leaderboards, accounts, backend, WaniKani API sync
- Monetisation, ads
- Native app (3D art came back in scope on 2026-11-12: `docs/intent/3d-run.md`)
- Copying any existing game's name, art, characters or levels. Inspired by the genre only (mobile "crowd runner" games such as "Real War (not fake)").

## Open questions for the spec

- Exact streak/payoff curve and how wrong answers penalise (subtract vs. divide).
- Gate count per run, run length, speed ramp.
- How distractor answers are chosen (similar-looking kanji? similar meanings?).
- SRS model detail (simple weight per character vs. Leitner boxes vs. SM-2-lite).
- What a "level" is and when new kanji unlock.
- 2D vs. simple 3D rendering; tech stack.
- Boss fight mechanics beyond "bigger army wins".
- Source of the WaniKani-like ordering (open frequency/grade lists as a proxy).
