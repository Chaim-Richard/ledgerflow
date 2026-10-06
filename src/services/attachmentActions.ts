import { addDoc, collection, getDocs, query, where } from '../lib/db/firestore';
import { db, getIdToken } from '../firebase';
import { type Attachment, type AttachmentTarget, MAX_FILES_AT_ONCE, attachmentProblem, attachmentRecord, attachmentsOf } from '../lib/attachments';

/** The file as a data address ("data:application/pdf;base64,…"), the way the Vault keeps files. */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error(`${file.name} could not be read`));
    reader.readAsDataURL(file);
  });
}

export interface AttachResult {
  saved: Attachment[];
  /** files not kept, each with the reason */
  refused: Array<{ name: string; reason: string }>;
}

/**
 * Keep files with a record (K-07). Each file is checked (size), read and saved on its own, so one
 * refused file doesn't stop the others; nothing is reported as saved unless the database took it.
 */
export async function attachFiles(workspaceId: string, uid: string, target: AttachmentTarget, files: File[]): Promise<AttachResult> {
  const result: AttachResult = { saved: [], refused: [] };
  for (const [i, file] of files.entries()) {
    if (i >= MAX_FILES_AT_ONCE) { result.refused.push({ name: file.name, reason: `at most ${MAX_FILES_AT_ONCE} files at once` }); continue; }
    const problem = attachmentProblem(file);
    if (problem) { result.refused.push({ name: file.name, reason: problem }); continue; }
    try {
      const record = attachmentRecord(file, await readAsDataUrl(file), target, { uid, workspaceId });
      const ref = await addDoc(collection(db, 'documents'), record);
      result.saved.push({ ...record, id: ref.id });
    } catch (err) {
      result.refused.push({ name: file.name, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

/** The files kept with one record, newest first. */
export async function loadAttachments(workspaceId: string, target: Pick<AttachmentTarget, 'collection' | 'id'>): Promise<Attachment[]> {
  const snap = await getDocs(query(collection(db, 'documents'), where('workspaceId', '==', workspaceId), where('linkedId', '==', target.id)));
  return attachmentsOf(snap.docs.map(d => ({ ...(d.data() as Omit<Attachment, 'id'>), id: d.id })), target);
}

/** Remove a file (through the server: it checks who may, and keeps an audit line). */
export async function removeAttachment(workspaceId: string, attachmentId: string): Promise<void> {
  const token = await getIdToken().catch(() => null);
  const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/attachments/${encodeURIComponent(attachmentId)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'The file could not be removed');
  }
}

/** One line saying what happened, for a toast. */
export function attachSummary(result: AttachResult): { ok: boolean; message: string } {
  const saved = result.saved.length;
  const refused = result.refused.map(r => `${r.name}: ${r.reason}`).join('; ');
  if (!result.refused.length) return { ok: true, message: `${saved} file${saved === 1 ? '' : 's'} attached` };
  return { ok: false, message: saved ? `${saved} attached; not attached: ${refused}` : `Not attached: ${refused}` };
}
