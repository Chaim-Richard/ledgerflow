# Financial Algorithms (Tools)

This directory contains the mathematical and logical engines used by the Tool Sandbox and other analytical views. 

## Structure
- `types.ts`: Defines the `AlgorithmDefinition` interface.
- `index.ts`: The central registry mapping IDs to their respective algorithms.
- `[name].ts`: Individual algorithms (e.g., `altman-z-score.ts`, `asset-amortizer.ts`).
- `generic-algorithms.ts`: A dynamic generator for placeholder algorithms.

## How to Add a New Tool / Algorithm

1. **Create a new file**: E.g., `my-new-tool.ts`
2. **Implement the Definition**:
```typescript
import { AlgorithmDefinition, buildHelper } from './types';

export const myNewTool: AlgorithmDefinition = {
  id: 'unique_id',
  name: 'My New Tool',
  description: 'What this tool does.',
  inputs: [
    { key: 'threshold', label: 'Threshold', min: 0, max: 100, step: 1, defaultValue: 50 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    // Perform complex calculations using txs (transactions) and accounts
    return {
      metrics: [ { label: 'Result', value: inputs.threshold } ],
      charts: [],
      insights: ['Calculated successfully']
    };
  })
};
```
3. **Register it**: Open `index.ts`, import your tool, and add it to `FINANCIAL_ALGORITHMS`.

## Modifying Existing Tools
Just find the corresponding `.ts` file (e.g. `altman-z-score.ts`) and modify the logic in the `compute` function. The UI will automatically reflect the changes in the Tool Sandbox and Intelligence Center.
