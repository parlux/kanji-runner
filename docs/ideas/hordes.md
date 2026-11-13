# Idea: enemy packs as hordes

Status: owner idea, 2026-11-13, refined in an interview (confirmed below). Spec: `docs/specs/SPEC-hordes.md`, tasks: `tasks/todo-hordes.md`.

The owner: "I don't think the enemy squads need to be 1 to 1 power with my army. I think it would be more exciting if there were a lot of enemies that I get to mow down. Of course only if it doesn't degrade performance to the point of affecting gameplay."

## Statement of intent (confirmed)
- **Outcome:** enemy packs (the groups that run at the army down the track) become hordes: many more, weaker enemies that the army shreds, with kills that look spectacular, more so than today.
- **User:** the owner, playing on a Pixel 7. A pack should feel like a power fantasy, not an even trade.
- **Threat:** packs still bite a little. If the army is misaligned or its fire is low, some get through and cost soldiers. The total threat stays at today's level or a bit lower.
- **Size:** the biggest packs have about 200 figures. This is a starting value to tune by feel (the owner wasn't sure), and it lives in one constant. The figures drawn match the real count.
- **Success:** on the Pixel 7, a big pack dying looks spectacular and the frame rate holds.
- **If the phone struggles:** first make the effects cheaper without making them look smaller (pooling, batching, fewer pieces on distant kills). Cut the count only after that.
- **Out of scope:** charge-row squads, the boss, and other pack balance (spawn chance, speed, steering) unless the change needs it.
