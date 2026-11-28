/** While a voice line plays, the sfx and music buses drop to this gain. */
export const DUCK_LEVEL = 0.2;
/** Milliseconds from full gain down to `DUCK_LEVEL` when a line starts. */
export const DUCK_ATTACK_MS = 60;
/** Milliseconds from `DUCK_LEVEL` back up to full gain after the last line ends. */
export const DUCK_RELEASE_MS = 250;
/** How deep (dB) the speech-range dip on the sfx and music buses goes at full duck. */
export const SPEECH_DIP_DB = -9;

/**
 * The speech-range dip (dB) for a duck level: 0 at no duck, `SPEECH_DIP_DB`
 * at `DUCK_LEVEL`, linear between. Clears room for the voice's consonants,
 * which turning the music down alone doesn't.
 */
export function speechDipDb(level: number): number {
  const t = (1 - level) / (1 - DUCK_LEVEL);
  return t <= 0 ? 0 : SPEECH_DIP_DB * Math.min(1, t);
}

/** A line whose end is never reported stops ducking after this long. */
export const DUCK_MAX_LINE_MS = 6000;

/**
 * One step of the envelope, linear: towards `DUCK_LEVEL` while ducking (the
 * whole drop takes `DUCK_ATTACK_MS`), back towards 1 otherwise (`DUCK_RELEASE_MS`).
 */
export function duckStep(
  level: number,
  ducking: boolean,
  dtMs: number,
): number {
  const span = 1 - DUCK_LEVEL;
  return ducking
    ? Math.max(DUCK_LEVEL, level - (span * dtMs) / DUCK_ATTACK_MS)
    : Math.min(1, level + (span * dtMs) / DUCK_RELEASE_MS);
}

/**
 * The duck for voice lines. A line of unknown length (the phone voice) opens
 * on its start and closes on its end; a clip holds for its own length.
 * Overlapping lines extend the hold: it ducks while any is open or held.
 * Times are milliseconds on one clock, passed in.
 */
export type Duck = {
  /** A line started at `now`; call the returned function when it ends (twice is fine). */
  open(now: number): () => void;
  /** A line of known length (a clip) started at `now`. */
  holdFor(now: number, ms: number): void;
  /** Whether a line is playing at `now`. */
  ducking(now: number): boolean;
  /** The bus gain at `now` (never earlier than the last call), stepping the envelope. */
  level(now: number): number;
};

export function createDuck(): Duck {
  // each open line's latest end (its safety cut-off until it closes)
  const open = new Set<{ until: number }>();
  let holdUntil = -Infinity;
  let at: number | null = null;
  let gain = 1;
  const ducking = (now: number): boolean => {
    if (now < holdUntil) return true;
    for (const l of open) if (now < l.until) return true;
    return false;
  };
  return {
    open(now) {
      const line = { until: now + DUCK_MAX_LINE_MS };
      open.add(line);
      return () => {
        open.delete(line);
      };
    },
    holdFor(now, ms) {
      holdUntil = Math.max(holdUntil, now + ms);
    },
    ducking,
    level(now) {
      gain = duckStep(
        gain,
        ducking(now),
        at === null ? 0 : Math.max(0, now - at),
      );
      at = now;
      return gain;
    },
  };
}

/** The voice's side of the duck: the same calls on the page's clock. */
export type VoiceDuck = {
  open(): () => void;
  holdFor(ms: number): void;
};

export const voiceDuck = (duck: Duck, now: () => number): VoiceDuck => ({
  open: () => duck.open(now()),
  holdFor: (ms) => duck.holdFor(now(), ms),
});
