import { getIdToken } from '../firebase';
import type { JournalTemplate, JournalTemplateInput } from '../lib/journalTemplates';

/** Journal entry templates (BD-09 / CA-27) through the server, which checks who may save or remove. */
async function call(workspaceId: string, path: string, init: { method: string; body?: unknown }) {
  const token = await getIdToken().catch(() => null);
  const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/journal-templates${path}`, {
    method: init.method,
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'The templates could not be reached');
  return data.data;
}

export async function listJournalTemplates(workspaceId: string): Promise<JournalTemplate[]> {
  const data = await call(workspaceId, '', { method: 'GET' });
  return Array.isArray(data?.templates) ? data.templates as JournalTemplate[] : [];
}

/** Saves the template; one already under that name (any case) is replaced. */
export async function saveJournalTemplate(workspaceId: string, input: JournalTemplateInput): Promise<{ template: JournalTemplate; replaced: boolean }> {
  return call(workspaceId, '', { method: 'POST', body: input });
}

export async function removeJournalTemplate(workspaceId: string, templateId: string): Promise<void> {
  await call(workspaceId, `/${encodeURIComponent(templateId)}`, { method: 'DELETE' });
}
