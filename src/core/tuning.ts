// All gameplay tuning constants live here.

export const STARTING_ARMY = 5;

/** Max soldiers gained from a single ×N gate. */
export const MAX_MULTIPLY_GAIN = 150;
export const WRONG_MIN_LOSS = 5;
export const WRONG_PCT_LOSS = 0.3;

export const BASE_REWARD = { kana: 3, meaning: 5, reading: 8 } as const;

export const ROWS_PER_RUN = 14;
/** Rows 1..N have 2 options; later rows have 3. */
export const TWO_OPTION_ROWS = 7;

// Track and speed. Distances are in "track units"; 1 unit/s at 1.0×.
/** How far ahead rows and hazards become visible. Equals the first row's lead time in seconds. */
export const VIEW_DISTANCE = 3.0;
export const BASE_SPEED = 1.0;
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
/** Hazard-free stretch before each question, starting when its prompt appears. */
export const CALM_DISTANCE = 3.0;
/** Distance between a question and the next hazard, and between hazards. */
export const HAZARD_SPACING = 4.5;
/** Static block width range. */
export const BLOCK_MIN_W = 0.15;
export const BLOCK_MAX_W = 0.35;
/** Saw: width, sweep amplitude range (of its centre), sweep rate in radians per track unit, and chance a hazard is a saw. */
export const SAW_W = 0.1;
export const SAW_MIN_AMP = 0.15;
export const SAW_MAX_AMP = 0.35;
export const SAW_RATE = (2 * Math.PI) / 3;
export const SAW_CHANCE = 1 / 3;
