import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  decomposeHierarchicalLabel, 
  matchDeepLabel, 
  expandDeepLabels, 
  extractMultiDimensionalLabels 
} from '../lib/dimensionUtils';
import { BayesianClassifier } from '../lib/algorithms';
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

  it('recovers merchant tokens from noisy bank descriptors (punctuation, store numbers, trigrams)', () => {
    const bayes = new BayesianClassifier();

    // Train on clean merchant names across distinct categories
    bayes.train('SHOPRITE', 'Groceries', 5.0);
    bayes.train('AMZN MKTPLACE', 'Office Supplies', 5.0);
    bayes.train('SHELL OIL', 'Fuel', 5.0);

    // 1. SHOPRITE#0451 - punctuation + store number should cleanly recover 'shoprite'
    const shopriteNum = bayes.classify('SHOPRITE#0451');
    assert.ok(shopriteNum !== null);
    assert.strictEqual(shopriteNum.category, 'Groceries');
    assert.ok(shopriteNum.confidence > 0.6, `Expected confidence > 0.6, got ${shopriteNum.confidence}`);

    // 2. SHOPRITE #1234 PARAMUS NJ - store number stripped + branch location
    const shopriteBranch = bayes.classify('SHOPRITE #1234 PARAMUS NJ');
    assert.ok(shopriteBranch !== null);
    assert.strictEqual(shopriteBranch.category, 'Groceries');
    assert.ok(shopriteBranch.confidence > 0.6, `Expected confidence > 0.6, got ${shopriteBranch.confidence}`);

    // 3. AMZN*MKTPLACE US*2H45L - asterisk separated descriptor
    const amzn = bayes.classify('AMZN*MKTPLACE US*2H45L');
    assert.ok(amzn !== null);
    assert.strictEqual(amzn.category, 'Office Supplies');
    assert.ok(amzn.confidence > 0.6, `Expected confidence > 0.6, got ${amzn.confidence}`);

    // 4. Character trigram OCR split typo resilience (SHOPRIT E 1234 -> Groceries)
    const ocrTypo = bayes.classify('SHOPRIT E 1234');
    assert.ok(ocrTypo !== null);
    assert.strictEqual(ocrTypo.category, 'Groceries');
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
});
