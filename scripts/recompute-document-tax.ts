/**
 * Tax recompute (AE-04): lists the posted invoices and bills whose tax in the ledger differs from
 * the document's tax, and with --apply posts one adjusting entry per document (never edits the
 * old entry). Dry run by default.
 *
 *   npx tsx scripts/recompute-document-tax.ts --workspace <id> --uid <owner uid> [--apply] [--date YYYY-MM-DD]
 */
import { getDb } from '../src/server/db/firestore';
import { recomputeDocumentTax } from '../src/server/services/taxRecomputeService';
import { logger } from '../src/server/utils/logger';

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
}

async function run() {
  const args = process.argv.slice(2);
  const workspaceId = arg(args, '--workspace');
  const uid = arg(args, '--uid');
  const apply = args.includes('--apply');
  if (!workspaceId || (apply && !uid)) {
    process.stderr.write('Usage: npx tsx scripts/recompute-document-tax.ts --workspace <workspaceId> [--apply --uid <uid>] [--date YYYY-MM-DD]\n');
    process.exit(1);
  }

  const db = getDb();
  const result = await recomputeDocumentTax(db, { workspaceId, uid: uid || 'script', apply, date: arg(args, '--date') });
  for (const d of result.differences) {
    logger.info('tax differs', { kind: d.kind, id: d.id, number: d.number, postedTaxCents: d.postedTaxCents, expectedTaxCents: d.expectedTaxCents, differenceCents: d.differenceCents });
  }
  logger.info(apply ? 'tax recompute applied' : 'tax recompute dry run (add --apply to post adjusting entries)', {
    workspaceId, differences: result.differences.length, posted: result.posted.length, failed: result.failed.length,
  });
  for (const f of result.failed) logger.warn('not adjusted', f);
  await db.terminate();
  process.exit(result.failed.length ? 2 : 0);
}

run().catch(err => {
  logger.error('tax recompute failed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
