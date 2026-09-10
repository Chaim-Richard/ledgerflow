import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  decomposeHierarchicalLabel, 
  matchDeepLabel, 
  expandDeepLabels, 
  extractMultiDimensionalLabels 
} from '../lib/dimensionUtils';
import { BayesianClassifier, generateImportIdentity } from '../lib/algorithms';
import { MatchingEngine } from '../lib/MatchingEngine';
import { AutoRule } from '../types';

describe('Deep and Multi-Dimensional Labeling Engine', () => {
  it('correctly decomposes deep hierarchical labels with slashes, arrows, or colons', () => {
    const slashLabel = decomposeHierarchicalLabel('Marketing / Digital / PPC');
    assert.strictEqual(slashLabel.root, 'Marketing');
    assert.deepStrictEqual(slashLabel.segments, ['Marketing', 'Digital', 'PPC']);
    assert.strictEqual(slashLabel.depth, 3);
    assert.strictEqual(slashLabel.parentPath, 'Marketing/Digital');
    assert.strictEqual(slashLabel.fullPath, 'Marketing/Digital/PPC');

    const arrowLabel = decomposeHierarchicalLabel('Expenses > Software > DevTools');
    assert.strictEqual(arrowLabel.root, 'Expenses');
    assert.deepStrictEqual(arrowLabel.segments, ['Expenses', 'Software', 'DevTools']);
    assert.strictEqual(arrowLabel.parentPath, 'Expenses/Software');

    const colonLabel = decomposeHierarchicalLabel('Dept:Engineering:Infra');
    assert.strictEqual(colonLabel.root, 'Dept');
    assert.deepStrictEqual(colonLabel.segments, ['Dept', 'Engineering', 'Infra']);
  });

  it('accurately matches deep labels and subtree hierarchies', () => {
    // Child matches ancestor query
    assert.strictEqual(matchDeepLabel('Engineering/Backend/API', 'Engineering'), true);
    assert.strictEqual(matchDeepLabel('Engineering/Backend/API', 'Engineering/Backend'), true);
    // Ancestor matches child when matchAncestors is enabled
    assert.strictEqual(matchDeepLabel('Engineering', 'Engineering/Backend', true), true);
    // Unrelated branches do not match
    assert.strictEqual(matchDeepLabel('Marketing/SEO', 'Engineering/Backend'), false);
  });

  it('expands multi-tiered tags across every hierarchical level', () => {
    const rawTags = ['marketing/digital/sem', 'dept:ops:warehouse', 'project-apollo'];
    const expanded = expandDeepLabels(rawTags);

    // Checks all ancestor tiers are populated for fast indexing and filtering
    assert.ok(expanded.includes('marketing'));
    assert.ok(expanded.includes('marketing/digital'));
    assert.ok(expanded.includes('marketing/digital/sem'));
    assert.ok(expanded.includes('dept'));
    assert.ok(expanded.includes('dept:ops'));
    assert.ok(expanded.includes('dept:ops:warehouse'));
    assert.ok(expanded.includes('project-apollo'));
  });

  it('extracts multi-dimensional coordinates and hashtags from memo descriptions', () => {
    const memo = 'AWS Cloud Hosting Invoice [Dept:Engineering/Cloud] #project/titan/phase1';
    const extracted = extractMultiDimensionalLabels(memo);

    assert.strictEqual(extracted.dimensions['dept'], 'Engineering/Cloud');
    assert.ok(extracted.tags.includes('dept:Engineering/Cloud'));
    assert.ok(extracted.tags.includes('project/titan/phase1'));
    assert.ok(extracted.tags.includes('project/titan'));
    assert.ok(extracted.tags.includes('project'));
  });

  it('Bayesian classifier trains hierarchical categories and predicts deep labels', () => {
    const bayes = new BayesianClassifier();

    // Train with deep hierarchical categories
    bayes.train('Google Ads search campaign pay per click', 'Marketing / Advertising / PPC', 3.0);
    bayes.train('Facebook instagram social media boost', 'Marketing / Social / Paid', 3.0);
    bayes.train('GitHub Copilot annual developer subscription', 'Software / DevTools / AI', 3.0);

    const result = bayes.classifyHierarchical('Google Search adwords click invoice');
    assert.ok(result !== null);
    assert.strictEqual(result.rootCategory, 'Marketing');
    assert.ok(result.category.includes('Marketing'));
    assert.ok(result.depth >= 1);
  });

  it('MatchingEngine automatically assigns deep multi-dimensional tags and dimensions', () => {
    const rules: AutoRule[] = [
      {
        id: 'rule-slack',
        uid: 'test-user',
        workspaceId: 'ws-test',
        condition: { descriptionContains: 'Slack' },
        action: { 
          targetCategory: 'Software / Collaboration / Chat',
          targetDimensions: { department: 'Engineering/Operations' },
          targetTags: ['comms:internal']
        },
        confidence: 1,
        isHardened: true,
        priority: 10,
        isActive: true,
        createdAt: new Date().toISOString()
      }
    ];

    const engine = new MatchingEngine(rules);
    const resolved = engine.resolveCategory('Monthly Slack Team Subscription [Project:Moonshot/Core]');

    assert.ok(resolved !== null);
    assert.strictEqual(resolved.accountName, 'Software / Collaboration / Chat');
    assert.strictEqual(resolved.dimensions?.['category'], 'Software/Collaboration/Chat');
    assert.strictEqual(resolved.dimensions?.['department'], 'Engineering/Operations');
    assert.strictEqual(resolved.dimensions?.['project'], 'Moonshot/Core');
    assert.ok(resolved.tags?.includes('comms:internal'));
    assert.ok(resolved.tags?.includes('project:Moonshot/Core'));
  });

  describe('Phase 2: Messy Real-World Merchant Descriptors (Tokenizer Verification)', () => {
    it('correctly classifies noisy descriptors with symbols, store numbers, and locations (confidence > 0.6)', () => {
      const bayes = new BayesianClassifier();

      // Training corpus with clean canonical merchant representations
      bayes.train('ShopRite Supermarket Food Groceries', 'Groceries', 2.0);
      bayes.train('Amazon Marketplace US Online Retail', 'Office Supplies', 2.0);
      bayes.train('AMZN Mktplace Purchase', 'Office Supplies', 2.0);
      bayes.train('Shell Oil Petroleum Fuel Gas Station', 'Fuel / Automotive', 2.0);

      const noisyTestCases = [
        { text: 'SHOPRITE', expectedCategory: 'Groceries' },
        { text: 'SHOPRITE#0451', expectedCategory: 'Groceries' },
        { text: 'SHOPRITE #1234 PARAMUS NJ', expectedCategory: 'Groceries' },
        { text: 'AMZN*MKTPLACE', expectedCategory: 'Office Supplies' },
        { text: 'AMAZON.COM*RT4G9', expectedCategory: 'Office Supplies' },
        { text: 'SHELL OIL 57442136', expectedCategory: 'Fuel / Automotive' }
      ];

      for (const tc of noisyTestCases) {
        const result = bayes.classify(tc.text);
        assert.ok(result !== null, `Expected classification for "${tc.text}", but received null (abstained)`);
        assert.strictEqual(result.category, tc.expectedCategory, `Failed on descriptor: "${tc.text}"`);
        assert.ok(
          result.confidence > 0.60,
          `Expected confidence > 0.60 for "${tc.text}", got ${result.confidence}`
        );
      }
    });
  });

  describe('Phase 3: Calibrated Abstention Logic & Boundary Detection', () => {
    it('abstains (returns null) when descriptor has zero discriminative features or matches uniform prior', () => {
      const bayes = new BayesianClassifier({
        abstentionMargin: 0.10,
        abstentionUniformBuffer: 0.05
      });

      bayes.train('ShopRite Supermarket Groceries', 'Groceries', 1.0);
      bayes.train('Shell Oil Petroleum Fuel', 'Fuel / Automotive', 1.0);
      bayes.train('Home Depot Hardware Tools', 'Hardware', 1.0);

      // Completely unseen/ambiguous merchant with zero feature overlap
      const resultUnseen = bayes.classify('XYZZY_UNKNOWN_OUTLET 9999');
      assert.strictEqual(resultUnseen, null, 'Expected classifier to abstain on uninformative descriptor');

      // Detailed breakdown inspects the abstention reason
      const detailed = bayes.classifyDetailed('XYZZY_UNKNOWN_OUTLET 9999');
      assert.ok(detailed !== null);
      assert.strictEqual(detailed.isAbstained, true);
      assert.ok(detailed.abstainReason === 'NEAR_UNIFORM_PRIOR' || detailed.abstainReason === 'NO_FEATURES');
    });

    it('MatchingEngine falls through to Layer 7 Manual Review with calibrated 0.0 confidence when classifier abstains', () => {
      const engine = new MatchingEngine([]);
      
      const debug = engine.debugResolveCategory('Completely Obscure Vendor 987654');
      assert.strictEqual(debug.accountName, 'Manual Review');
      assert.strictEqual(debug.confidence, 0.0);
      assert.ok(debug.layer.includes('Manual'));
    });
  });

  describe('Phase 4: Held-Out Merchant Evaluation & Trigram Benchmark', () => {
    it('benchmarks baseline classifier vs trigram-augmented classifier on noisy and fragmented test sets', async () => {
      const { evaluateClassifier } = await import('../lib/algorithms');

      // 1. Setup training corpus
      const baselineClassifier = new BayesianClassifier({ enableTrigrams: false });
      const trigramClassifier = new BayesianClassifier({ enableTrigrams: true, trigramMultiplier: 0.30 });

      const trainingCorpus = [
        { text: 'ShopRite Supermarket Food Groceries', cat: 'Groceries' },
        { text: 'Amazon Marketplace Retail Goods', cat: 'Office Supplies' },
        { text: 'Shell Oil Gas Station Gasoline', cat: 'Fuel / Automotive' },
        { text: 'Uber Trip Rideshare Transportation', cat: 'Travel' },
        { text: 'Slack Technologies Monthly Software Subscription', cat: 'Software' }
      ];

      for (const item of trainingCorpus) {
        baselineClassifier.train(item.text, item.cat, 2.0);
        trigramClassifier.train(item.text, item.cat, 2.0);
      }

      // 2. Held-out test set containing clean, noisy, fragmented, and typo descriptors
      const heldOutTestSet = [
        { text: 'SHOPRITE #0451', expectedCategory: 'Groceries' },
        { text: 'AMZN*MKTPLACE', expectedCategory: 'Office Supplies' },
        { text: 'SHELL OIL 57442136', expectedCategory: 'Fuel / Automotive' },
        { text: 'UBER TRIP 0914', expectedCategory: 'Travel' },
        { text: 'SLACK TECH', expectedCategory: 'Software' },
        // Fragmented / split spacing typo: "SHOPRIT E"
        { text: 'SHOPRIT E', expectedCategory: 'Groceries' }
      ];

      const baselineMetrics = evaluateClassifier(baselineClassifier, heldOutTestSet, 0.70);
      const trigramMetrics = evaluateClassifier(trigramClassifier, heldOutTestSet, 0.70);

      // Baseline should succeed on clean/standard noisy merchants (4/6 = 66.7%)
      assert.ok(baselineMetrics.accuracy >= 0.60, `Baseline accuracy should be >= 0.60, got ${baselineMetrics.accuracy}`);
      assert.strictEqual(baselineMetrics.unknownRate, 0.3333, 'Baseline should safely abstain on fragmented/abbreviated tokens');
      
      // Zero false confidence across both models (no misclassifications claiming high confidence)
      assert.strictEqual(baselineMetrics.falseConfidenceRate, 0.0, 'Baseline false confidence rate must be 0');
      assert.strictEqual(trigramMetrics.falseConfidenceRate, 0.0, 'Trigram false confidence rate must be 0');

      // Character trigrams should correctly identify fragmented descriptor "SHOPRIT E" and abbreviated "AMZN*MKTPLACE"
      const trigramShopritResult = trigramMetrics.results.find(r => r.text === 'SHOPRIT E');
      assert.ok(trigramShopritResult !== undefined);
      assert.strictEqual(trigramShopritResult.predictedCategory, 'Groceries', 'Trigrams should bridge "SHOPRIT E" to Groceries');
      assert.strictEqual(trigramShopritResult.correct, true);

      const trigramAmznResult = trigramMetrics.results.find(r => r.text === 'AMZN*MKTPLACE');
      assert.ok(trigramAmznResult !== undefined);
      assert.strictEqual(trigramAmznResult.predictedCategory, 'Office Supplies', 'Trigrams should bridge "MKTPLACE" to Office Supplies');
      assert.strictEqual(trigramAmznResult.correct, true);

      // Trigram accuracy should strictly exceed baseline accuracy on typo/fragmented set (100% vs 66.7%)
      assert.ok(
        trigramMetrics.accuracy > baselineMetrics.accuracy,
        `Trigram accuracy (${trigramMetrics.accuracy}) should exceed baseline (${baselineMetrics.accuracy})`
      );
      assert.strictEqual(trigramMetrics.accuracy, 1.0, 'Trigram model should reach 100% accuracy on this evaluation set');
    });
  });

  describe('Import Identity & Idempotency Engine', () => {
    it('generates deterministic fingerprint based on source, kind, date, amount, description, and occurrence', () => {
      const fp1 = generateImportIdentity('statement_csv', 'line', {
        date: '2026-03-01',
        amountCents: 4500,
        description: 'Shoprite #0451'
      }, 0);

      const fp2 = generateImportIdentity('statement_csv', 'line', {
        date: '2026-03-01',
        amountCents: 4500,
        description: 'SHOPRITE #0451 '
      }, 0);

      assert.strictEqual(fp1, fp2, 'Normalized identical transactions must produce identical fingerprints');
      assert.ok(fp1.startsWith('statement_csv:line:'), 'Fingerprint must follow <source>:<kind>:<hash> format');

      // Occurrence index disambiguation for multiple identical transactions in same batch
      const fpOccurrence1 = generateImportIdentity('statement_csv', 'line', {
        date: '2026-03-01',
        amountCents: 4500,
        description: 'Shoprite #0451'
      }, 1);

      assert.notStrictEqual(fp1, fpOccurrence1, 'Different occurrence indices must produce distinct fingerprints');
    });
  });
});
