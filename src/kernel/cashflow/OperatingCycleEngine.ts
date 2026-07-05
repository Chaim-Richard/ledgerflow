export class OperatingCycleEngine {
  /**
   * Calculates the Operating Cycle.
   * Operating Cycle = Days Sales of Inventory (DSI) + Days Sales Outstanding (DSO)
   */
  static calculateOperatingCycle(dsi: number, dso: number): number {
    return dsi + dso;
  }
}
