// All gameplay tuning constants live here.

export const STARTING_ARMY = 5;

/** Max soldiers gained from a single ×N gate. */
export const MAX_MULTIPLY_GAIN = 150;
export const WRONG_MIN_LOSS = 5;
export const WRONG_PCT_LOSS = 0.3;

// Squad charges (R5, S6): a wall gate with a squad in each opening. See track.ts and sim.ts.
/** Temporary toggle for Checkpoint A2: false makes every question a wall gate. */
export const SQUADS_ENABLED = true;
/** Questions (1-based) that are squad charges. Never one of the 3 warm-ups. */
export const SQUAD_QUESTIONS = [4, 8, 12] as const;
/** Soldiers a correct squad adds on top of the streak reward. Also the count every squad shows. */
export const SQUAD_DEFECT_GAIN = 10;
/** Wrong squad charge: lose max(WRONG_CHARGE_MIN_LOSS, ceil(WRONG_CHARGE_PCT_LOSS × army)). */
export const WRONG_CHARGE_MIN_LOSS = 8;
export const WRONG_CHARGE_PCT_LOSS = 0.5;

export const BASE_REWARD = {
  kana: 3,
  meaning: 5,
  reading: 8,
  word: 5,
} as const;

export const ROWS_PER_RUN = 14;
// Item selection (SRS). See run.ts.
/** The first N questions are warm-ups: the strongest known items, always wall gates. */
export const WARM_UPS = 3;
/** Most never-seen items introduced per run, taken in progression order. */
export const MAX_NEW_PER_RUN = 4;
/** Of those, at most this many may be words (kanji keep priority). */
export const MAX_NEW_WORDS_PER_RUN = 1;
/** WaniKani mode: a kanji due for review on WaniKani is drawn this many times as often. */
export const WK_DUE_BOOST = 4;
/** The story library is refetched when older than this. */
export const STORY_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Katakana loanwords that join each kanji level, in list order. See words.ts. */
export const WORDS_PER_LEVEL = 5;
/** Rows 1..N have 2 options; later rows have 3. */
export const TWO_OPTION_ROWS = 7;

// Track and speed. Distances are in "track units"; 1 unit/s at 1.0×.
/** How far ahead rows and hazards become visible. Equals the first row's lead time in seconds. */
export const VIEW_DISTANCE = 3.0;
export const BASE_SPEED = 1.6;
/** Player speed presets: multipliers on BASE_SPEED (the ramp still applies on top). */
export const SPEED_PRESETS = { relaxed: 0.7, normal: 0.85, fast: 1.0 } as const;
export type SpeedPreset = keyof typeof SPEED_PRESETS;
export const DEFAULT_SPEED: SpeedPreset = "normal";
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

// Gate growth (S7). See gates.ts and sim.ts.
/**
 * Track widths an opening widens per point of damage. The wall is in range
 * for FIRE_RANGE / speed ≈ 1.75 s (1.35 s at the end of the run), so a full
 * army (100, 100 damage/s) widens by 0.13–0.17 (reaching the cap at 3
 * answers), while 20 soldiers manage about 0.03 and the starting 5 under 0.01.
 * A max-width crowd (0.30) clears a 3-answer opening after 40 damage.
 */
export const GATE_GROW_PER_DAMAGE = 0.001;
/** Widest an opening can grow. At 2 answers the other is left at 0.22, which clips a max-width crowd. */
export const GATE_MAX_W = 0.5;
/**
 * Narrowest the other openings can be pushed: 70 px on a 390 px phone,
 * room for a short label at LABEL_MIN_PX. At 3 answers this caps the grown
 * opening at 0.78 − 2 × 0.18 = 0.42.
 */
export const GATE_MIN_W = 0.18;
/** Solid wall always left at each track edge, so an edge opening still reads as an opening. */
export const GATE_EDGE_MIN = 0.02;

// Crowd width: w = clamp(CROWD_MIN_W, CROWD_K × √army, CROWD_MAX_W). Max width is reached at 100 soldiers.
export const CROWD_MIN_W = 0.06;
export const CROWD_K = 0.03;
export const CROWD_MAX_W = 0.3;

// Track layout (R3). See track.ts.
/**
 * Hazard-free stretch right before each wall. Shorter than VIEW_DISTANCE, so
 * the prompt appears while the last hazards are still being dodged (S5).
 * Squad charges get the same stretch as walls (S6).
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
/** Damage that kills one enemy. */
export const ENEMY_HP = 1;
/**
 * A pack starts running at the army this far ahead (track units): where the 3D
 * view starts drawing it (its default shape distance, 4 × VIEW_DISTANCE).
 */
export const PACK_WAKE = 4 * VIEW_DISTANCE;
/** Pack start centres are drawn from [ENEMY_X_MARGIN, 1 − ENEMY_X_MARGIN]. */
export const ENEMY_X_MARGIN = 0.2;
/**
 * Hordes (v1.10): a pack's head count = clamp(round(HORDE_K × expected army),
 * ENEMY_MIN, PACK_MAX). Its hit points (see KILL_SECONDS) are shared evenly.
 */
export const HORDE_K = 3;
export const PACK_MAX = 200;
/**
 * Seconds an army of the expected size takes to mow down a whole pack: pack
 * HP = KILL_SECONDS × FIRE_PER_SOLDIER × expected army.
 */
export const KILL_SECONDS = 1.0;
/**
 * A pack's crowd's width (its mouth) as a share of the track (1 = the
 * whole track), at the pack's own x. Its stream is as wide as the army.
 */
export const PACK_WIDTH = 1.0;
/** Enemy figures are drawn this size of a soldier (a view value; the core ignores it). */
export const HORDE_SCALE = 0.7;

/**
 * Horde tuning a run is built with (v1.10 rework): the dev panel changes it,
 * from the next run. `hordeK` and `packMax` set the head count (packCount),
 * `killSeconds` the pack HP (see KILL_SECONDS), `packWidth` its width (see
 * PACK_WIDTH), `hordeScale` the figure size
 * (view only). Defaults: HORDE_DEFAULTS.
 */
export type HordeTuning = {
  readonly hordeK: number;
  readonly packMax: number;
  readonly killSeconds: number;
  readonly packWidth: number;
  readonly hordeScale: number;
};
export const HORDE_DEFAULTS: HordeTuning = {
  hordeK: HORDE_K,
  packMax: PACK_MAX,
  killSeconds: KILL_SECONDS,
  packWidth: PACK_WIDTH,
  hordeScale: HORDE_SCALE,
};
/**
 * Stream contact: each enemy that reaches the army costs HORDE_THREAT ×
 * packStrength(expected) / heads soldiers (the running total rounded), so a
 * pack that arrives untouched costs HORDE_THREAT × today's strength.
 */
export const HORDE_THREAT = 0.2;
/**
 * A waiting pack is a loose, scattered crowd (owner at Checkpoint M2): its
 * figures stand this far apart (track units, times the figure size), about
 * 2.7 figure widths, across its mouth and as deep as that needs, up to
 * CROWD_DEPTH_MAX (then they stand closer). See packCrowd.
 */
export const HORDE_GAP_LOOSE = 0.065;
/**
 * Deepest a pack's crowd stands (track units). It starts half this short of
 * the pack's place, so it stays clear of the beats around it (HAZARD_SPACING
 * before, CALM_DISTANCE after).
 */
export const CROWD_DEPTH_MAX = 2.0;
/**
 * The stream's own length in the core's column (track units), past the
 * deepest crowd: the crowd empties into the stream from its front while
 * the head runs at least this far (1.2 s at ENEMY_SPEED).
 */
export const STREAM_LEAD = 0.6;
/**
 * Length of every pack's column (track units): its enemies stand
 * PACK_COLUMN_MAX / heads apart behind the stream's head (packDensity), as
 * the crowd empties into the stream. A pack's front starts at its
 * crowd's front (CROWD_DEPTH_MAX / 2 short of its place, 2 track units past
 * the beat before it), so even at the fastest scroll the whole column has
 * streamed in about 0.7 track units past the pack's place, before the next
 * wall (CALM_DISTANCE).
 */
export const PACK_COLUMN_MAX = CROWD_DEPTH_MAX + STREAM_LEAD;
/**
 * The army's fire reaches an awake pack's stream from where it starts: up to
 * this far ahead (never past an unanswered wall; nothing beyond one wakes).
 * Other threats stay within FIRE_RANGE.
 */
export const PACK_FIRE_RANGE = PACK_WAKE;
/** A pack that wakes behind another still charging catches up with that column's tail this much faster (track units per second). */
export const PACK_MERGE_SPEED = 2.5;

// Boss (T9). See boss.ts.
/** Boss size = round(BOSS_K × expected army). */
export const BOSS_K = 1.5;
/** Expected army = median of BOSS_PASSES 80%-accuracy passes × EXPECTED_SURVIVAL (clipping losses). */
export const EXPECTED_SURVIVAL = 0.85;
export const BOSS_PASSES = 31;
/** Accuracy of each simulated pass. */
export const BOSS_PASS_ACCURACY = 0.8;
/** The clash takes this long (s) whatever the sizes; both sides lose units at the same rate. */
export const CLASH_SECONDS = 2.5;
/** Before the clash, the two sides take this long (s) to close in. */
export const CLASH_APPROACH_SECONDS = 0.6;
/** The result stays up this long (s) after the clash before the end screen. */
export const CLASH_HOLD_SECONDS = 1.2;

/** WaniKani mode: most re-asks (asking an item again) one run can hold. */
export const REASK_MAX = 3;
/** A right answer triggers a re-ask when the item's box at the start of the run was at most this. */
export const REASK_MAX_BOX = 2;
/** A re-ask replaces a row at least this many rows after its trigger. */
export const REASK_GAP_MIN = 3;
/** ... and at most this many rows after it. */
export const REASK_GAP_MAX = 5;

/** A session ends after this many minutes without a run. */
export const SESSION_IDLE_MINUTES = 30;

/** The end screen's session line wraps to at most this many lines. */
export const SESSION_LINE_MAX_LINES = 2;
