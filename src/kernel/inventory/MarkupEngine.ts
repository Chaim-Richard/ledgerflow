export class MarkupEngine {
  /**
   * Converts a Markup percentage to a Margin percentage.
   */
  static markupToMargin(markupPercentage: number): number {
    const markupDecimal = markupPercentage / 100;
    return (markupDecimal / (1 + markupDecimal)) * 100;
  }

  /**
   * Converts a Margin percentage to a Markup percentage.
   */
  static marginToMarkup(marginPercentage: number): number {
    if (marginPercentage >= 100) throw new Error("Margin cannot be 100% or greater");
    const marginDecimal = marginPercentage / 100;
    return (marginDecimal / (1 - marginDecimal)) * 100;
  }
}
