/**
 * Launch step 9: collections other than the core ones load only when a screen asks for them
 * (src/lib/ledgerCollections.ts). A file that reads one from the store without asking would show
 * an empty list until some other screen happened to load it. This test reads every source file and
 * fails when a file reads an on-demand collection from useLedgerStore / useScenarioStore without
 * calling useLedgerCollections(...) with it.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CORE_KEYS, LEDGER_COLLECTIONS, ON_DEMAND_KEYS, keysToStart } from '../lib/ledgerCollections';

const ROOT = join(process.cwd(), 'src');
const SKIP = new Set(['stores/useLedgerStore.ts', 'hooks/useLedgerData.ts', 'lib/ledgerCollections.ts', 'lib/scenarioStore.ts']);

/**
 * Reads through getState() inside event handlers, run while the screen that asked for the data is
 * open (or that work only with what is loaded and say so). Each needs a reason.
 */
const GET_STATE_ALLOWED: Record<string, string> = {
  'platform/settings/BackupExportSettings.tsx': 'the backup comes from the server; the browser copy is the offline fallback and says it is incomplete',
  'services/LedgerPostService.ts': 'reads the loaded inventory and fetches any invoice item not loaded yet (loadInventory)',
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'tests' || name === 'server' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** The text of each `useLedgerStore(...)` / `useScenarioStore(...)` call, parentheses balanced. */
function storeCalls(text: string): string[] {
  const calls: string[] = [];
  const re = /use(?:Ledger|Scenario)Store\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
    }
    calls.push(text.slice(m.index, i));
  }
  return calls;
}

function readsWithoutAsking(text: string): { subscribed: string[]; viaGetState: string[] } {
  const asked = new Set<string>();
  for (const m of text.matchAll(/useLedgerCollections\(([^)]*)\)/g)) {
    for (const k of m[1].matchAll(/'(\w+)'/g)) asked.add(k[1]);
  }
  const subscribed = new Set<string>();
  for (const call of storeCalls(text)) {
    for (const key of ON_DEMAND_KEYS) if (new RegExp(`\\.${key}\\b`).test(call)) subscribed.add(key);
  }
  // const { invoices, bills } = useLedgerStore();
  for (const m of text.matchAll(/const\s*\{([^}]*)\}\s*=\s*useLedgerStore\(\s*\)/g)) {
    for (const key of ON_DEMAND_KEYS) if (new RegExp(`(^|[\\s,])${key}\\b`).test(m[1])) subscribed.add(key);
  }
  const viaGetState = new Set<string>();
  for (const m of text.matchAll(/use(?:Ledger|Scenario)Store\.getState\(\)\.(\w+)/g)) {
    if ((ON_DEMAND_KEYS as readonly string[]).includes(m[1])) viaGetState.add(m[1]);
  }
  return {
    subscribed: [...subscribed].filter(k => !asked.has(k)).sort(),
    viaGetState: [...viaGetState].filter(k => !asked.has(k)).sort(),
  };
}

describe('On-demand collections are asked for by the files that read them', () => {
  test('every file that reads an on-demand collection asks for it', () => {
    const problems: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      if (SKIP.has(rel)) continue;
      const { subscribed, viaGetState } = readsWithoutAsking(readFileSync(file, 'utf8'));
      if (subscribed.length) problems.push(`${rel}: reads ${subscribed.join(', ')} — add useLedgerCollections(${subscribed.map(k => `'${k}'`).join(', ')})`);
      if (viaGetState.length && !GET_STATE_ALLOWED[rel]) problems.push(`${rel}: getState() reads ${viaGetState.join(', ')} — ask for them with useLedgerCollections in the screen, or explain in GET_STATE_ALLOWED`);
    }
    assert.deepEqual(problems, []);
  });

  test('a screen that loads data on demand and shows an empty state also shows loading (I-05)', () => {
    const problems: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      const text = readFileSync(file, 'utf8');
      if (!/<EmptyState\b/.test(text) || !/useLedgerCollections\(/.test(text)) continue;
      if (!/\{\s*loading\s*\}\s*=\s*useLedgerCollections\(/.test(text) || !/<LoadingState\b/.test(text)) {
        problems.push(`${rel}: shows <EmptyState> but not <LoadingState> while useLedgerCollections is loading`);
      }
    }
    assert.deepEqual(problems, []);
  });

  test('the detector sees selectors, destructuring and getState reads', () => {
    const src = `
      const a = useLedgerStore(s => s.invoices);
      const b = useLedgerStore((state) => (state.bills || []) as Bill[]);
      const { vendors, transactions } = useLedgerStore();
      const c = useLedgerStore.getState().payments;
      useLedgerCollections('bills');
    `;
    assert.deepEqual(readsWithoutAsking(src), { subscribed: ['invoices', 'vendors'], viaGetState: ['payments'] });
  });

  test('core collections start at once; asked ones start once', () => {
    assert.deepEqual(keysToStart([], new Set()), [...CORE_KEYS].sort());
    assert.deepEqual(keysToStart(['invoices', 'invoices', 'nonsense'], new Set(CORE_KEYS)), ['invoices']);
    assert.deepEqual(keysToStart(['invoices'], new Set([...CORE_KEYS, 'invoices'])), []);
    for (const spec of Object.values(LEDGER_COLLECTIONS)) assert.ok(spec.cap > 0);
  });
});
