import type { AlgoInput, AlgoResult } from "./types";

export const MAX_PREVIEW_CENTS = 1_000_000_000_000;
export function numberInput(
  key: string,
  label: string,
  defaultValue: number,
  max = MAX_PREVIEW_CENTS,
  min = 0,
): AlgoInput {
  return { kind: "number", key, label, min, max, step: 1, defaultValue };
}
export function integer(
  inputs: Record<string, unknown>,
  key: string,
  fallback: number,
  min = 0,
  max = MAX_PREVIEW_CENTS,
): number {
  const value = inputs[key] ?? fallback;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${key} must be a whole number between ${min} and ${max}.`);
  return value;
}
export function safeMinor(value: bigint): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new Error("The result exceeds the safe integer minor-unit range.");
  return result;
}
/** Nonnegative rational values, rounded half up without floating-point money arithmetic. */
export function roundRatio(numerator: bigint, denominator: bigint): number {
  if (numerator < 0n || denominator <= 0n)
    throw new Error(
      "A nonnegative amount and a positive denominator are required.",
    );
  return safeMinor((numerator * 2n + denominator) / (2n * denominator));
}
/** Floors shares, then gives the last positive-weight part the remaining minor units. */
export function allocateMinor(total: number, weights: number[]): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    weights.some((w) => !Number.isSafeInteger(w) || w < 0)
  )
    throw new Error(
      "Allocation requires nonnegative integer minor units and weights.",
    );
  const sum = weights.reduce((s, w) => s + BigInt(w), 0n);
  if (sum === 0n)
    throw new Error("At least one allocation weight must be above zero.");
  let last = weights.length - 1;
  while (weights[last] === 0) last--;
  let remaining = total;
  return weights.map((weight, index) => {
    const amount =
      index === last
        ? remaining
        : safeMinor((BigInt(total) * BigInt(weight)) / sum);
    remaining -= amount;
    return amount;
  });
}
export function guardedPreview(compute: () => AlgoResult): AlgoResult {
  try {
    return compute();
  } catch (error) {
    return {
      metrics: [],
      charts: [],
      rows: [],
      insights: [
        error instanceof Error
          ? error.message
          : "Unable to calculate this preview.",
      ],
    };
  }
}
