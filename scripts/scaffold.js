#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const type = process.argv[2];
const name = process.argv[3];

if (!type || !name) {
  console.log("Usage: node scripts/scaffold.js <plugin|algo> <Name>");
  console.log("Example: node scripts/scaffold.js plugin MyCustomView");
  console.log("Example: node scripts/scaffold.js algo my-new-math");
  process.exit(1);
}

if (type === 'plugin') {
  const pluginPath = path.join(__dirname, '../src/plugins', `${name}.tsx`);
  const content = `import React from 'react';

export default function ${name}() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">${name} Plugin</h1>
      <p className="mt-4 text-slate-500">This view was auto-generated. Edit src/plugins/${name}.tsx to customize.</p>
    </div>
  );
}
`;
  fs.writeFileSync(pluginPath, content);
  console.log(`✅ Plugin created at ${pluginPath}`);
  console.log(`It will be automatically discovered by the plugin engine and added to the sidebar!`);
} else if (type === 'algo') {
  const algoId = Date.now().toString().slice(-4);
  const algoPath = path.join(__dirname, '../src/lib/algorithms', `${name}.ts`);
  const content = `import { AlgorithmDefinition, buildHelper } from './types';

export const ${name.replace(/-([a-z])/g, (g) => g[1].toUpperCase())}: AlgorithmDefinition = {
  id: 'algo_${algoId}',
  name: '${name.replace(/-/g, ' ')}',
  description: 'Auto-generated algorithm module.',
  inputs: [
    { key: 'threshold', label: 'Threshold', min: 0, max: 100, step: 1, defaultValue: 50 }
  ],
  compute: buildHelper((txs, accounts, inputs) => {
    return {
      metrics: [ { label: 'Result', value: inputs.threshold } ],
      charts: [],
      insights: ['Calculated successfully']
    };
  })
};
`;
  fs.writeFileSync(algoPath, content);
  console.log(`✅ Algorithm created at ${algoPath}`);
  console.log(`To use it, import it in src/lib/algorithms/index.ts and add it to FINANCIAL_ALGORITHMS.`);
} else {
  console.log("Unknown type. Use 'plugin' or 'algo'.");
}
