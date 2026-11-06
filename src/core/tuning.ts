// All gameplay tuning constants live here.

export const STARTING_ARMY = 5;

/** Max soldiers gained from a single ×N gate. */
export const MAX_MULTIPLY_GAIN = 150;
export const WRONG_MIN_LOSS = 5;
export const WRONG_PCT_LOSS = 0.3;

export const BASE_REWARD = { kana: 3, meaning: 5, reading: 8 } as const;

export const ROWS_PER_RUN = 20;
/** Rows 1..N have 2 options; later rows have 3. */
export const TWO_OPTION_ROWS = 10;

// Track and speed. Distances are in "track units"; 1 unit/s at 1.0×.
/** How far ahead a row becomes visible. Equals the first row's lead time in seconds. */
export const VIEW_DISTANCE = 3.0;
/** Distance between consecutive gate rows. */
export const ROW_SPACING = 4.5;
export const BASE_SPEED = 1.0;
/** Speed multiplier reached by the last row (ramps linearly from 1.0×). */
export const MAX_SPEED_MUL = 1.6;

// Steering. The track is 1.0 wide; x runs from 0 (left) to 1 (right).
/** Fastest the crowd (and a held key's target) can move, in track widths per second. */
export const STEER_MAX_SPEED = 1.2;
/** Easing time constant: the crowd closes the gap to its target at gap / STEER_EASE per second, capped. */
export const STEER_EASE = 0.08;

/** Wall-gate opening widths for 2- and 3-answer gates. */
export const GATE_OPENING_2 = 0.36;
export const GATE_OPENING_3 = 0.26;

// Crowd width: w = clamp(CROWD_MIN_W, CROWD_K × √army, CROWD_MAX_W). Max width is reached at 100 soldiers.
export const CROWD_MIN_W = 0.06;
export const CROWD_K = 0.03;
export const CROWD_MAX_W = 0.3;
