export class BenfordsLawEngine {
  /**
   * Tests a dataset of numbers against Benford's Law distribution.
   * Returns an array of actual frequencies [1-9] vs expected.
   */
  static testBenfordsLaw(numbers: number[]): { digit: number, actualFrequency: number, expectedFrequency: number, variance: number }[] {
    const counts = new Array(10).fill(0);
    let totalValid = 0;

    for (const num of numbers) {
      const absNum = Math.abs(num);
      if (absNum >= 1) {
        const firstDigit = parseInt(absNum.toString().charAt(0), 10);
        if (firstDigit >= 1 && firstDigit <= 9) {
          counts[firstDigit]++;
          totalValid++;
        }
      }
    }

    const results = [];
    for (let i = 1; i <= 9; i++) {
      const actualFreq = totalValid > 0 ? counts[i] / totalValid : 0;
      const expectedFreq = Math.log10(1 + (1 / i));
      results.push({
        digit: i,
        actualFrequency: actualFreq,
        expectedFrequency: expectedFreq,
        variance: Math.abs(actualFreq - expectedFreq)
      });
    }

    return results;
  }
}
