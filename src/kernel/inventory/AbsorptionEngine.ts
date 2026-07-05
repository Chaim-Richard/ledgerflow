export class AbsorptionEngine {
  /**
   * Calculates Absorption Costing Per Unit.
   * Total Manufacturing Cost = Direct Materials + Direct Labor + Variable Mfg Overhead + Fixed Mfg Overhead
   */
  static calculateAbsorptionCostPerUnit(directMaterials: number, directLabor: number, variableMfgOverhead: number, fixedMfgOverhead: number, unitsProduced: number): number {
    if (unitsProduced === 0) return 0;
    const totalCost = directMaterials + directLabor + variableMfgOverhead + fixedMfgOverhead;
    return Math.round(totalCost / unitsProduced);
  }
}
