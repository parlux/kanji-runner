import {
  MAX_MULTIPLY_GAIN,
  SQUAD_DEFECT_GAIN,
  WRONG_CHARGE_MIN_LOSS,
  WRONG_CHARGE_PCT_LOSS,
  WRONG_MIN_LOSS,
  WRONG_PCT_LOSS,
} from "./tuning";

export type GateResult = { army: number; streak: number };

/** How a correct answer at this streak (the count including it) pays. */
export type StreakTier = "base" | "double-base" | "double" | "triple";

export function streakTier(streak: number): StreakTier {
  return streak >= 8
    ? "triple"
    : streak >= 5
      ? "double"
      : streak >= 3
        ? "double-base"
        : "base";
}

export function applyCorrect(
  army: number,
  streak: number,
  base: number,
): GateResult {
  const next = streak + 1;
  const tier = streakTier(next);
  const gain =
    tier === "triple"
      ? Math.min(army * 2, MAX_MULTIPLY_GAIN)
      : tier === "double"
        ? Math.min(army, MAX_MULTIPLY_GAIN)
        : tier === "double-base"
          ? base * 2
          : base;
  return { army: army + gain, streak: next };
}

function lose(army: number, min: number, pct: number): GateResult {
  const loss = Math.max(min, Math.ceil(army * pct));
  return { army: Math.max(0, army - loss), streak: 0 };
}

/** Wrong wall gate: lose max(5, 30%), rounded up. */
export function applyWrong(army: number): GateResult {
  return lose(army, WRONG_MIN_LOSS, WRONG_PCT_LOSS);
}

/** Correct squad charge: the streak reward (capped as usual), plus the defecting squad. */
export function applyCorrectCharge(
  army: number,
  streak: number,
  base: number,
): GateResult {
  const r = applyCorrect(army, streak, base);
  return { army: r.army + SQUAD_DEFECT_GAIN, streak: r.streak };
}

/** Wrong squad charge: lose max(8, 50%), rounded up. */
export function applyWrongCharge(army: number): GateResult {
  return lose(army, WRONG_CHARGE_MIN_LOSS, WRONG_CHARGE_PCT_LOSS);
}
