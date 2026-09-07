/**
 * Canonical monetary allocation module.
 * Implements largest-remainder method (Hare-Niemeyer) for distributing
 * exact cent values without losing or gaining single cents.
 */

export function allocateCents(totalCents: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (weights.length === 1) return [Math.round(totalCents)];

  const totalWeight = weights.reduce((acc, w) => acc + (w || 0), 0);
  if (totalWeight <= 0) {
    // Equal distribution fallback if weights sum to <= 0
    const equalShare = Math.floor(totalCents / weights.length);
    const result = new Array(weights.length).fill(equalShare);
    const remainder = Math.round(totalCents) - (equalShare * weights.length);
    for (let i = 0; i < remainder; i++) {
      result[i] += 1;
    }
    return result;
  }

  // Calculate unrounded exact allocations and integer floors
  const allocations = weights.map((w) => {
    const exact = (totalCents * (w || 0)) / totalWeight;
    const floor = Math.floor(exact);
    const remainder = exact - floor;
    return { floor, remainder };
  });

  const allocatedSum = allocations.reduce((acc, a) => acc + a.floor, 0);
  const unallocatedCents = Math.round(totalCents) - allocatedSum;

  const result = allocations.map((a) => a.floor);

  // Distribute remaining cents to shares with largest fractional remainders
  if (unallocatedCents > 0) {
    const indexed = allocations.map((a, idx) => ({ idx, remainder: a.remainder }));
    indexed.sort((a, b) => b.remainder - a.remainder);

    for (let i = 0; i < unallocatedCents && i < indexed.length; i++) {
      result[indexed[i].idx] += 1;
    }
  }

  return result;
}
