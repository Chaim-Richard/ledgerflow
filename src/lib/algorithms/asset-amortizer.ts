import { AlgorithmDefinition, AlgoResult } from './types';
import { isPostable, lineAmount } from '../txFilters';

export const assetAmortizer: AlgorithmDefinition = {
  id: '3',
  name: 'Fixed Asset Amortizer (MACRS / DDB)',
  domain: 'finance',
  tags: ['Amortization', 'Depreciation', 'Capital', 'Tax Shield'],
  description: 'Compound temporal tracking of capital degradation. Calculates and compares Straight-Line vs. Double-Declining Balance (DDB) to optimize tax shields.',
  inputs: [
    { key: 'life', label: 'Asset Lifespan (Years)', min: 3, max: 30, step: 1, defaultValue: 5 },
    { key: 'salvageValuePct', label: 'Salvage Value (%)', min: 0, max: 50, step: 5, defaultValue: 10 },
    { key: 'taxRate', label: 'Corporate Tax Rate (%)', min: 0, max: 50, step: 5, defaultValue: 25 },
    { 
      kind: 'select', 
      key: 'convention', 
      label: 'Depreciation Convention', 
      options: [
        { value: 'half-year', label: 'Half-Year Convention (MACRS Standard)' },
        { value: 'full-year', label: 'Full-Year Convention' }
      ], 
      defaultValue: 'half-year' 
    }
  ],
  compute: (ctx, inputs): AlgoResult => {
    const { transactions: txs, accounts, accounting } = ctx;
    
    // Strict isolation of Fixed / Capital Assets (excluding liquid cash, AR, and inventory)
    const isFixedAssetAccount = (a: any) => {
      if (!accounting.isAsset(a.id)) return false;
      const cat = (a.category || '').toLowerCase();
      const sub = (a.subtype || a.subType || '').toLowerCase();
      const name = (a.name || '').toLowerCase();
      const role = (a.role || '').toLowerCase();
      
      // Explicitly reject liquid/current assets
      if (role === 'cash' || cat.includes('cash') || cat.includes('bank') || cat.includes('receivable') || sub.includes('cash') || sub.includes('bank') || sub.includes('receivable') || cat.includes('inventory')) {
        return false;
      }
      
      return (
        cat === 'fixed assets' ||
        cat.includes('fixed') ||
        cat.includes('property') ||
        cat.includes('equipment') ||
        sub.includes('fixed') ||
        name.includes('equipment') ||
        name.includes('machinery') ||
        name.includes('vehicle') ||
        name.includes('hardware') ||
        name.includes('building') ||
        name.includes('leasehold')
      );
    };

    const caAccts = accounts.filter(isFixedAssetAccount).map(a => a.id);
    let assetBaseCents = 0;
    let usingFallback = false;
    
    txs.forEach(t => {
      if (!isPostable(t)) return;
      t.lines?.forEach(l => { 
        if (caAccts.includes(l.accountId) && l.amountCents > 0) {
          assetBaseCents += lineAmount(l, t);
        }
      });
    });
    
    // If no dedicated fixed asset debits found, check if fixed assets have balance in accounts
    if (assetBaseCents === 0 && caAccts.length > 0) {
      accounts.forEach(a => {
        if (caAccts.includes(a.id) && (a.balanceCents || 0) > 0) {
          assetBaseCents += a.balanceCents;
        }
      });
    }

    // Fallback only if no fixed asset accounts exist at all
    if (assetBaseCents === 0 && caAccts.length === 0 && txs.length > 0) {
      usingFallback = true;
      txs.forEach(t => {
        if (!isPostable(t)) return;
        if (t.totalAmountCents >= 200000 && (t.type === 'adjustment' || t.type === 'journal')) {
          assetBaseCents += t.totalAmountCents;
        }
      });
    }

    const assetBase = assetBaseCents / 100;
    
    const life = Math.max(1, inputs.life ?? 5);
    const salvageValuePct = (inputs.salvageValuePct ?? 10) / 100;
    const taxRate = (inputs.taxRate ?? 25) / 100;
    const convention = inputs['convention'] || 'half-year';
    
    const salvageValue = assetBase * salvageValuePct;
    const depreciableBase = assetBase - salvageValue;
    
    const straightLineYearly = depreciableBase / life;
    const ddbRate = 2 / life;

    const data: any[] = [];
    
    let slRemaining = assetBase;
    let ddbRemaining = assetBase;
    const totalPeriods = convention === 'half-year' ? life + 1 : life;

    for (let i = 1; i <= totalPeriods; i++) {
       const isFirstYear = i === 1;
       const isFinalYear = i === totalPeriods;
       const periodFactor = (convention === 'half-year' && (isFirstYear || isFinalYear)) ? 0.5 : 1.0;

       // Straight Line
       const slExpense = isFinalYear && convention === 'half-year'
         ? Math.min(slRemaining - salvageValue, straightLineYearly * 0.5)
         : Math.min(slRemaining - salvageValue, straightLineYearly * periodFactor);
       
       slRemaining = Math.max(salvageValue, slRemaining - slExpense);
       
       // DDB
       let ddbExpense = ddbRemaining * ddbRate * periodFactor;
       
       if (isFinalYear || (ddbRemaining - ddbExpense) < salvageValue) {
         ddbExpense = Math.max(0, ddbRemaining - salvageValue);
       }
       
       ddbRemaining = Math.max(salvageValue, ddbRemaining - ddbExpense);

       data.push({ 
         year: `Yr ${i}${convention === 'half-year' && (isFirstYear || isFinalYear) ? ' (Half)' : ''}`, 
         'SL Book Value': Math.max(0, slRemaining),
         'DDB Book Value': Math.max(0, ddbRemaining),
         'SL Exp': slExpense,
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
