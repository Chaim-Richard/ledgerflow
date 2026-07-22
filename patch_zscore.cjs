const fs = require('fs');

// Patch 1: localized-forensics.ts
let locFor = fs.readFileSync('src/lib/algorithms/localized-forensics.ts', 'utf8');
locFor = locFor.replace('const zScoreSpike = (maxAmt - mean) / stdDev;', 'const zScoreSpike = stdDev === 0 ? 0 : (maxAmt - mean) / stdDev;');
fs.writeFileSync('src/lib/algorithms/localized-forensics.ts', locFor);

// Patch 2: algorithms.ts
let algo = fs.readFileSync('src/lib/algorithms.ts', 'utf8');
algo = algo.replace('.map((v, i) => ({ index: i, zScore: Math.abs((v - mean) / stdDev) }))', '.map((v, i) => ({ index: i, zScore: stdDev === 0 ? 0 : Math.abs((v - mean) / stdDev) }))');
fs.writeFileSync('src/lib/algorithms.ts', algo);

