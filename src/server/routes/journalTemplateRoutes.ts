import express from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { getDb } from '../db/firestore';
import { writeServerAuditLog } from '../services/auditLogService';
import { JOURNAL_TEMPLATE_KIND, MAX_TEMPLATE_LINES, templateProblem, type JournalTemplate } from '../../lib/journalTemplates';

/**
 * Journal entry templates (BD-09 / CA-27), mounted at /api/v1/workspaces/:workspaceId/journal-templates
 * (workspaceRoutes.ts, every member may read). Owners, accountants and bookkeepers save and remove
 * them; saving under a name already used replaces that template. Kept with the workspace's documents
 * (kind "journalTemplate", no `uid`, so they never show in anyone's Vault); every change is in the
 * audit trail. A template posts nothing: it only fills the journal form.
 */
export const journalTemplateRouter = express.Router({ mergeParams: true });

type AuthedRequest = express.Request & { user: { uid: string; email?: string }; userRole?: string };
const WRITERS = new Set(['owner', 'accountant', 'bookkeeper']);

const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const saveSchema = z.object({
  name: z.string().max(60),
  description: z.string().max(200).optional(),
  adjusting: z.boolean().optional(),
  lines: z.array(z.object({
    accountId: z.string().min(1).max(127),
    debitCents: cents,
    creditCents: cents,
    dimensions: z.record(z.string().max(64), z.string().max(120)).optional(),
  }).strict()).max(MAX_TEMPLATE_LINES),
}).strict();

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

async function templatesOf(workspaceId: string): Promise<JournalTemplate[]> {
  const snap = await getDb().collection('documents').where('workspaceId', '==', workspaceId).where('kind', '==', JOURNAL_TEMPLATE_KIND).get();
  return snap.docs.map(d => ({ ...(d.data() as JournalTemplate), id: d.id })).sort((a, b) => a.name.localeCompare(b.name));
}

journalTemplateRouter.get('/', async (req, res) => {
  try {
    res.json({ status: 'success', data: { templates: await templatesOf((req.params as Record<string, string>).workspaceId) } });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'The templates could not be read', details: err instanceof Error ? err.message : String(err) });
  }
});

journalTemplateRouter.post('/', async (req, res) => {
  const { workspaceId } = req.params as Record<string, string>;
  const { user, userRole } = req as unknown as AuthedRequest;
  if (!WRITERS.has(String(userRole))) return res.status(403).json({ status: 'error', message: 'Only owners, accountants and bookkeepers save templates' });
  try {
    const input = saveSchema.parse(req.body);
    const db = getDb();
    const accounts = await db.collection('chartAccounts').where('workspaceId', '==', workspaceId).get();
    const problem = templateProblem(input, new Set(accounts.docs.map(d => d.id)));
    if (problem) return res.status(400).json({ status: 'error', message: problem });
    const existing = (await templatesOf(workspaceId)).find(t => sameName(t.name, input.name));
    const now = new Date().toISOString();
    const id = existing?.id || `jt_${crypto.randomBytes(8).toString('hex')}`;
    const template: JournalTemplate = {
      id, workspaceId, kind: JOURNAL_TEMPLATE_KIND,
      name: input.name.trim(), description: (input.description || '').trim(), adjusting: Boolean(input.adjusting), lines: input.lines,
      createdBy: existing?.createdBy || user.uid, createdAt: existing?.createdAt || now, updatedAt: now,
    };
    await db.runTransaction(async t => {
      t.set(db.collection('documents').doc(id), template);
      await writeServerAuditLog({
        workspaceId, uid: user.uid, email: user.email, action: existing ? 'journalTemplate.replaced' : 'journalTemplate.saved',
        entityType: 'journalTemplates', entityId: id,
        details: { description: `${existing ? 'Replaced' : 'Saved'} the journal template "${template.name}" (${template.lines.length} lines)`, name: template.name },
      }, { db, tx: t });
    });
    res.json({ status: 'success', data: { template, replaced: Boolean(existing) } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ status: 'error', message: 'Invalid template', details: err.issues });
    res.status(500).json({ status: 'error', message: 'The template could not be saved', details: err instanceof Error ? err.message : String(err) });
  }
});

journalTemplateRouter.delete('/:templateId', async (req, res) => {
  const { workspaceId, templateId } = req.params as Record<string, string>;
  const { user, userRole } = req as unknown as AuthedRequest;
  if (!WRITERS.has(String(userRole))) return res.status(403).json({ status: 'error', message: 'Only owners, accountants and bookkeepers remove templates' });
  try {
    const db = getDb();
    const ref = db.collection('documents').doc(templateId);
    const removed = await db.runTransaction(async t => {
      const snap = await t.get(ref);
      const template = snap.exists ? snap.data() as Partial<JournalTemplate> : undefined;
      if (!template || template.workspaceId !== workspaceId || template.kind !== JOURNAL_TEMPLATE_KIND) return false;
      t.delete(ref);
      await writeServerAuditLog({
        workspaceId, uid: user.uid, email: user.email, action: 'journalTemplate.removed', entityType: 'journalTemplates', entityId: templateId,
        details: { description: `Removed the journal template "${template.name || templateId}"`, name: template.name || null },
      }, { db, tx: t });
      return true;
    });
    if (!removed) return res.status(404).json({ status: 'error', message: 'That template is not in this workspace (already removed?)' });
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'The template could not be removed', details: err instanceof Error ? err.message : String(err) });
  }
});
