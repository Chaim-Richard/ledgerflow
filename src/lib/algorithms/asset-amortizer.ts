import { AlgorithmDefinition, AlgoResult } from './types';

export const assetAmortizer: AlgorithmDefinition = {
  id: '3',
  name: 'Fixed Asset Amortizer (MACRS / DDB)',
  domain: 'finance',
  tags: ['Amortization', 'Depreciation', 'Capital', 'Tax Shield'],
  description: 'Compound temporal tracking of capital degradation. Calculates and compares Straight-Line vs. Double-Declining Balance (DDB) to optimize tax shields.',
  inputs: [
    { key: 'life', label: 'Asset Lifespan (Years)', min: 3, max: 30, step: 1, defaultValue: 5 },
    { key: 'salvageValuePct', label: 'Salvage Value (%)', min: 0, max: 50, step: 5, defaultValue: 10 },
    { key: 'taxRate', label: 'Corporate Tax Rate (%)', min: 0, max: 50, step: 5, defaultValue: 25 }
  ],
  compute: (txs, accounts, inputs): AlgoResult => {
    // Attempt to identify capital assets
    const caAccts = accounts.filter(a => (a.name || '').toLowerCase().includes('asset') || (a.category || '').toLowerCase() === 'asset').map(a => a.id);
    
    let assetBaseCents = 0;
    
    // Fallback: If no dedicated asset accounts found, sum all expenses over $1000 assuming they might be capitilizable (for demo purposes)
    let usingFallback = false;
    
    txs.forEach(t => t.lines?.forEach(l => { 
      if (caAccts.includes(l.accountId) && l.amountCents > 0) {
        assetBaseCents += l.amountCents;
      }
    }));
    
    if (assetBaseCents === 0 && txs.length > 0) {
      usingFallback = true;
      txs.forEach(t => {
        if (t.totalAmountCents >= 200000) { // $2000 minimum
          assetBaseCents += t.totalAmountCents;
        }
      });
    }

    const assetBase = assetBaseCents / 100;
    
    const life = inputs.life ?? 5;
    const salvageValuePct = (inputs.salvageValuePct ?? 10) / 100;
    const taxRate = (inputs.taxRate ?? 25) / 100;
    
    const salvageValue = assetBase * salvageValuePct;
    const depreciableBase = assetBase - salvageValue;
    
    const straightLineYearly = depreciableBase / life;
    const ddbRate = 2 / life;

    const data: any[] = [];
    
    let slRemaining = assetBase;
    let ddbRemaining = assetBase;
    let slCumTaxShield = 0;
    let ddbCumTaxShield = 0;

    for (let i = 1; i <= life; i++) {
       // Straight Line
       slRemaining -= straightLineYearly;
       slCumTaxShield += (straightLineYearly * taxRate);
       
       // DDB
       let ddbExpense = ddbRemaining * ddbRate;
       
       // In final year, or if DDB crosses straight-line remainder, switch to straight line or force to salvage
       if (i === life) {
         ddbExpense = ddbRemaining - salvageValue;
       } else if ((ddbRemaining - ddbExpense) < salvageValue) {
         ddbExpense = ddbRemaining - salvageValue;
       }
       
       ddbRemaining -= ddbExpense;
       ddbCumTaxShield += (ddbExpense * taxRate);

       data.push({ 
         year: `Yr ${i}`, 
         'SL Book Value': Math.max(0, slRemaining),
         'DDB Book Value': Math.max(0, ddbRemaining),
         'SL Exp': straightLineYearly,
         'DDB Exp': ddbExpense
       });
    }

    const earlyYearAdvantage = data[0]['DDB Exp'] - data[0]['SL Exp'];
    const taxShieldAdvantage = earlyYearAdvantage * taxRate;

    return {
      metrics: [
        { label: 'Identified Capital Base', value: `$${assetBase.toLocaleString()}`, color: 'blue' },
        { label: 'Salvage Value', value: `$${salvageValue.toLocaleString()}` },
        { label: 'Yr 1 Tax Shield Adv.', value: `+$${taxShieldAdvantage.toLocaleString()}`, color: taxShieldAdvantage > 0 ? 'green' : 'gray' }
      ],
      charts: [
        { 
          config: { 
            xKey: 'year', 
            yKeys: [
              { key: 'SL Book Value', color: '#6366f1', name: 'Straight-Line BV', type: 'line' },
              { key: 'DDB Book Value', color: '#10b981', name: 'Double-Declining BV', type: 'line' }
            ] 
          },
          data 
        },
        { 
          config: { 
            xKey: 'year', 
            yKeys: [
              { key: 'SL Exp', color: '#a5b4fc', name: 'SL Expense', type: 'bar' },
              { key: 'DDB Exp', color: '#6ee7b7', name: 'DDB Expense', type: 'bar' }
            ] 
          },
          data 
        }
      ],
      insights: [
        usingFallback 
          ? `Could not definitively isolate 'Asset' accounts. Approximated capital base using transactions over $2,000.`
          : `Isolated $${assetBase.toLocaleString()} in gross fixed assets from the ledger.`,
        `Employing a Double-Declining Balance (DDB) method front-loads depreciation, creating an additional $${earlyYearAdvantage.toLocaleString()} in Year 1 expenses.`,
        `At a ${inputs.taxRate}% corporate tax rate, DDB provides a Year 1 cash flow (tax shield) advantage of $${taxShieldAdvantage.toLocaleString()} over Straight-Line.`
      ]
    };
  }
};
