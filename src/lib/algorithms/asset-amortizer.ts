import { AlgorithmDefinition, buildHelper } from './types';

export const assetAmortizer: AlgorithmDefinition = {
  id: '3',
  name: 'Fixed Asset Amortizer',
  description: 'Compound temporal tracking of capital degradation.',
  inputs: [{ key: 'life', label: 'Asset Lifespan (Years)', min: 3, max: 30, step: 1, defaultValue: 5 }],
  compute: buildHelper((txs, accounts, inputs) => {
    const caAccts = accounts.filter(a => (a.name||'').toLowerCase().includes('asset')).map(a => a.id);
    let assetBase = 0;
    txs.forEach(t => t.lines?.forEach(l => { if (caAccts.includes(l.accountId) && l.amountCents > 0) assetBase += l.amountCents; }));
    assetBase = assetBase / 100;
    
    const data = [];
    const life = inputs.life;
    let val = assetBase;
    const straight = assetBase / life;
    for (let i = 0; i < life; i++) {
       val -= straight;
       data.push({ year: `Yr ${i+1}`, Value: Math.max(0, val), Depreciation: straight });
    }
    return {
      metrics: [{ label: 'Active Capital Base', value: `$${assetBase}` }],
      charts: [{ data, config: { xKey: 'year', yKeys: [{ key: 'Value', color: '#10b981', name: 'Remaining Book Value', type: 'line' }] } }],
      insights: [`Straight-line degradation over ${life} years yields ` + `$${straight.toFixed(2)}` + ` in yearly depreciation burden.`]
    };
  })
};
