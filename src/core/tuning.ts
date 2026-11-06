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
