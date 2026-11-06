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
