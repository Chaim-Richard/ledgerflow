export class RoyaltyEngine {
  /**
   * Calculates royalty payment based on sales volume and a tier structure.
   * Tiers are evaluated sequentially: { threshold: number, rate: number }
   */
  static calculateTieredRoyalty(salesVolumeCents: number, tiers: { thresholdCents: number, rate: number }[]): number {
    let remainingVolume = salesVolumeCents;
    let royaltyTotal = 0;
    
    // Assume tiers are sorted ascending by threshold
    let previousThreshold = 0;
    
    for (const tier of tiers) {
      const volumeInTier = Math.min(remainingVolume, tier.thresholdCents - previousThreshold);
      if (volumeInTier <= 0) break;
      
      royaltyTotal += volumeInTier * tier.rate;
      remainingVolume -= volumeInTier;
      previousThreshold = tier.thresholdCents;
    }
    
    // Apply last tier rate to any remaining volume
    if (remainingVolume > 0 && tiers.length > 0) {
      royaltyTotal += remainingVolume * tiers[tiers.length - 1].rate;
    }

    return Math.round(royaltyTotal);
  }
}
