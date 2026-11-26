# Intent: change speed from the pause screen

Status: confirmed by the owner, 2026-11-26, after an interview. Spec: `docs/specs/done/SPEC-pause-speed.md`. Tasks: `tasks/done/todo-pause-speed.md`. The owner waived spec approval: straight to the checkpoint. Shipped in 1.6.32; the owner ticked Checkpoint P on 2026-11-26.

## Statement of intent
- **Outcome:** every pause screen (run or boss clash, with or without a study card) shows a Relaxed / Normal / Fast row. One tap changes the speed; the run continues at it on resume.
- **User:** the owner, when Fast turns out too much mid-run (or Relaxed too slow).
- **Why now:** speed is only changeable from Settings on the start screen, which means leaving the run.
- **Success:** on the phone: pause, tap a speed, resume, the run moves at that speed. A speed tap doesn't resume; a tap elsewhere still does. The next run starts at the picked speed.
- **Saving:** a pause-screen change is saved on the device, the same as the Settings switch.
- **Constraint:** same three presets; no change to scoring or how a run plays out; the study card stays readable.
- **Out of scope:** opening Settings from pause, new presets, speed controls outside the pause screen.

## Decisions (and why)
| Decision | Reason |
|---|---|
| Change sticks for later runs | Owner: if Fast was too much today, the next run shouldn't start on Fast. |
| Speed row on the pause screen, not a Settings button | Owner chose A: one tap, and Settings holds options (WaniKani, sync) that shouldn't change mid-run. |
| On every pause screen | So it's reachable before the first answer and in Meaning mode, which show no card. |
