// All gameplay tuning constants live here.

export const STARTING_ARMY = 5;

/** Max soldiers gained from a single ×N gate. */
export const MAX_MULTIPLY_GAIN = 150;
export const WRONG_MIN_LOSS = 5;
export const WRONG_PCT_LOSS = 0.3;

// Squad charges (R5). See track.ts and sim.ts.
/** Temporary toggle for Checkpoint A2: false makes every question a wall gate. */
export const SQUADS_ENABLED = true;
/** Questions (1-based) that are squad charges. Never one of the 3 warm-ups. */
export const SQUAD_QUESTIONS = [4, 8, 12] as const;
/** The charge line sits this far before the squads; crossing it locks steering. */
export const CHARGE_LINE_DISTANCE = 1.0;
/** Soldiers a correct squad adds on top of the streak reward. Also the count every squad shows. */
export const SQUAD_DEFECT_GAIN = 10;
/** Wrong squad charge: lose max(WRONG_CHARGE_MIN_LOSS, ceil(WRONG_CHARGE_PCT_LOSS × army)). */
export const WRONG_CHARGE_MIN_LOSS = 8;
export const WRONG_CHARGE_PCT_LOSS = 0.5;

export const BASE_REWARD = { kana: 3, meaning: 5, reading: 8 } as const;

export const ROWS_PER_RUN = 14;
/** Rows 1..N have 2 options; later rows have 3. */
export const TWO_OPTION_ROWS = 7;

// Track and speed. Distances are in "track units"; 1 unit/s at 1.0×.
/** How far ahead rows and hazards become visible. Equals the first row's lead time in seconds. */
export const VIEW_DISTANCE = 3.0;
export const BASE_SPEED = 1.6;
/** Speed multiplier reached by the last row (ramps linearly from 1.0×). */
export const MAX_SPEED_MUL = 1.3;

// Steering. The track is 1.0 wide; x runs from 0 (left) to 1 (right).
/** Fastest the crowd (and a held key's target) can move, in track widths per second. */
export const STEER_MAX_SPEED = 1.2;
/** Easing time constant: the crowd closes the gap to its target at gap / STEER_EASE per second, capped. */
export const STEER_EASE = 0.08;
/** Drag gain: a finger moving one screen width moves the target this many track widths. */
export const DRAG_GAIN = 1.5;

/** Wall-gate opening widths for 2- and 3-answer gates. */
export const GATE_OPENING_2 = 0.36;
export const GATE_OPENING_3 = 0.26;

// Crowd width: w = clamp(CROWD_MIN_W, CROWD_K × √army, CROWD_MAX_W). Max width is reached at 100 soldiers.
export const CROWD_MIN_W = 0.06;
export const CROWD_K = 0.03;
export const CROWD_MAX_W = 0.3;

// Track layout (R3). See track.ts.
/**
 * Hazard-free stretch right before each wall. Shorter than VIEW_DISTANCE, so
 * the prompt appears while the last hazards are still being dodged (S5).
 * A squad charge's calm stretch is CHARGE_LINE_DISTANCE longer, so lining up
 * before its charge line keeps this much room.
 */
export const CALM_DISTANCE = 1.2;
/** Distance between a question and the next hazard, and between hazards. */
export const HAZARD_SPACING = 3.0;
/** Hazard beats between consecutive questions: HAZARDS_MIN to HAZARDS_MAX (seeded). */
export const HAZARDS_MIN = 2;
export const HAZARDS_MAX = 3;
/** Static block width range. */
export const BLOCK_MIN_W = 0.15;
export const BLOCK_MAX_W = 0.35;
/** Saw: width, sweep amplitude range (of its centre), sweep rate in radians per track unit, and chance a hazard is a saw. */
export const SAW_W = 0.1;
export const SAW_MIN_AMP = 0.15;
export const SAW_MAX_AMP = 0.35;
export const SAW_RATE = (2 * Math.PI) / 3;
export const SAW_CHANCE = 1 / 3;

// Shooting (S1). The army auto-fires at the nearest shootable threat ahead.
/** Damage per second per soldier. */
export const FIRE_PER_SOLDIER = 1;
/** How far ahead (track units) the army can hit a threat. */
export const FIRE_RANGE = 2.8;
/** Block hit points = BLOCK_HP_K × the expected army at that point of the run. */
export const BLOCK_HP_K = 1.0;
/** Supply crates (S3): a shattered block adds round(CRATE_REWARD_K × its hit points) soldiers. */
export const CRATE_REWARD_K = 0.3;

// Enemy packs (S2). Shootable groups that run at the army. See track.ts and sim.ts.
/** Chance a hazard beat after question 2 is an enemy pack. */
export const ENEMY_CHANCE = 0.3;
/** Pack strength = max(ENEMY_MIN, round(ENEMY_K × the expected army at that point)). */
export const ENEMY_K = 0.6;
export const ENEMY_MIN = 3;
/** Extra approach speed on top of the scroll, in track units per second. */
export const ENEMY_SPEED = 0.5;
/** Sideways drift towards the crowd centre, in track widths per second. */
export const ENEMY_STEER_SPEED = 0.15;
/** Damage that kills one enemy. */
export const ENEMY_HP = 1;
/** Soldiers lost per surviving enemy on contact. */
export const ENEMY_DAMAGE = 1;
/** Pack start centres are drawn from [ENEMY_X_MARGIN, 1 − ENEMY_X_MARGIN]. */
export const ENEMY_X_MARGIN = 0.2;
