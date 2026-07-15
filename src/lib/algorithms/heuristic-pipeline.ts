import { AlgorithmDefinition, buildHelper } from './types';

export const heuristicPipeline: AlgorithmDefinition = {
  id: '2',
  name: 'Heuristic Rule Pipeline',
  description: 'Cascading state-machine triggers from ledger inputs.',
  inputs: [{ key: 'automation', label: 'Automation Confidence (%)', min: 10, max: 100, step: 5, defaultValue: 85 }],
  compute: buildHelper((txs, accounts, inputs) => {
    const autoMatches = txs.filter(t => t.payee?.toLowerCase().includes('aws') || t.payee?.toLowerCase().includes('stripe')).length;
    return {
      metrics: [
        { label: 'Rule Conformance rate', value: `${Math.round((autoMatches / Math.max(1, txs.length)) * 100)}%` },
        { label: 'Automated Classifications', value: autoMatches }
      ],
      charts: [],
      insights: [`At ${inputs.automation}% confidence threshold, heuristic machine matched ${autoMatches} sequences.`]
    };
  })
};
