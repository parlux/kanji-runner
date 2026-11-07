# Tighter pacing, squads that read like walls, and shootable gates

Status: confirmed by owner, 2026-11-07, from Checkpoint A2 feedback. Input for spec revision 6.

## Feedback
- "Still feels a bit too slow overall, OR the gap between questions and obstacles is too big. Too many periods of not much to do. I almost see the value being in choosing the answer while partly distracted."
- Squads: "I can't tell which squad is right before I cross the line. I can't even tell if it's too fast or just too hard to figure out what I'm supposed to read and do." Squads are cool; the mechanics need work.
- "Shooting an answer at a gate should grow the gate (and shrink other gates). That would allow a big army to keep its size."

## Decisions (owner, 2026-11-07)
1. **Tighten spacing, not speed.** Shrink the calm stretch before each question and the gap between hazards, and let the last hazard overlap the time the prompt is being read: the answer is chosen while partly distracted. Add hazards per beat so a run stays about 60 s. `BASE_SPEED` is unchanged.
2. **Squad charges read like walls, with no lock.** A charge is a wall gate with an enemy squad standing in each opening: the same big prompt, labels and reading time as any wall. The squad you run into is your answer. The firefight plays at contact. The charge line and the steering lock go: the outcome only shows at contact, so there is nothing to retry.
3. **Shooting an opening grows it.** When no crate or pack is in range, fire goes to the opening the crowd is lined up with (the one nearest its centre), once the wall is within `FIRE_RANGE`. That opening widens at a rate set by firepower; the other openings narrow to a readable minimum. Squads in openings are not damaged by it. Growth never depends on correctness, so nothing leaks.

## Why
- Dead time is mostly the empty stretches, not the scroll speed. Faster scrolling would also cut reading and steering time.
- Squads were hard to read because they differed from walls: small labels, a separate line, and about half a wall's reading time before the lock.
- Gate shooting fills the run-up to every wall with something to do, lets a big army keep its size through narrow 3-answer gates, and rewards committing early: changing your mind late means running at an opening you have narrowed.

## Risks to check
- [ ] Reading while dodging is too much: the prompt must stay readable with a hazard on screen. Owner playtest.
- [ ] Late changes of mind feel too harsh with shrunk openings. Owner playtest; `GATE_MIN_W` is the lever.
- [ ] Bot balance still holds: 100% never dies early, 50% dies early in at least half of 200 runs.
- [ ] Squads can't be told apart before contact (honesty tests, owner check).

## Not doing (yet)
- A faster scroll.
- Shooting squads to thin them before contact (it could leak, and blurs the answer with combat).
- Splitting the crowd across openings.
