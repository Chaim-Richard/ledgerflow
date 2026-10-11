/**
 * What each AI model costs, as dated rows with the provider's page (the strategic review, 11 Oct:
 * the old constant priced Gemini 2.5 Flash at $0.075 / $0.30 per million tokens, about 4× and 8×
 * too low). Standard paid tier, text, US dollars per million tokens. A model without a row is not
 * priced: the caller records the tokens and leaves the cost unknown rather than guessing.
 */
export interface ModelPrice {
  model: string;
  validFrom: string;
  validTo?: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  source: string;
}

const GOOGLE = 'https://ai.google.dev/gemini-api/docs/pricing';

export const MODEL_PRICES: ModelPrice[] = [
  { model: 'gemini-2.5-flash', validFrom: '2025-06-17', inputUsdPerMillion: 0.3, outputUsdPerMillion: 2.5, source: GOOGLE },
];

export function priceOn(model: string, date: string): ModelPrice | undefined {
  return MODEL_PRICES.find(p => p.model === model && p.validFrom <= date && (!p.validTo || date <= p.validTo));
}

/** The cost in US cents (fractional) of one call, or undefined when the model has no price row. */
export function callCostCents(model: string, date: string, inputTokens: number, outputTokens: number): number | undefined {
  const price = priceOn(model, date);
  if (!price) return undefined;
  return (inputTokens * price.inputUsdPerMillion + outputTokens * price.outputUsdPerMillion) * 100 / 1_000_000;
}
