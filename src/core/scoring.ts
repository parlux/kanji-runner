import { MAX_MULTIPLY_GAIN, WRONG_MIN_LOSS, WRONG_PCT_LOSS } from "./tuning";

export type GateResult = { army: number; streak: number };

export function applyCorrect(
  army: number,
  streak: number,
  base: number,
): GateResult {
  const next = streak + 1;
  const gain =
    next >= 8
      ? Math.min(army * 2, MAX_MULTIPLY_GAIN)
      : next >= 5
        ? Math.min(army, MAX_MULTIPLY_GAIN)
        : next >= 3
          ? base * 2
          : base;
  return { army: army + gain, streak: next };
}

export function applyWrong(army: number): GateResult {
  const loss = Math.max(WRONG_MIN_LOSS, Math.ceil(army * WRONG_PCT_LOSS));
  return { army: Math.max(0, army - loss), streak: 0 };
}
