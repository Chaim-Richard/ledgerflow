import type { Firestore } from '../db/firestore';
import { mentionedPeople } from '../../lib/mentions';
import { notify } from './notificationService';

/**
 * Tells the people named with @ in what someone wrote (BG-01, src/lib/mentions.ts). Never breaks the
 * save it follows: a failure only means nobody is told. Returns who was told.
 */
export async function notifyMentions(db: Firestore, input: { workspaceId: string; text: string; actorUid: string; actorEmail?: string; where: string; recordId: string; eventKey: string; kind: 'mention.query' | 'mention.task' }): Promise<string[]> {
  if (!input.text.includes('@')) return [];
  try {
    const ws = (await db.collection('workspaces').doc(input.workspaceId).get()).data();
    if (!ws) return [];
    const uids = [...new Set([...(Array.isArray(ws.members) ? ws.members.map(String) : []), ...(ws.uid ? [String(ws.uid)] : [])])];
    const people = await Promise.all(uids.map(async uid => ({ uid, email: (await db.collection('users').doc(uid).get()).data()?.email as string | undefined })));
    const named = mentionedPeople(input.text, people, input.actorUid);
    if (!named.length) return [];
    await notify(db, {
      workspaceId: input.workspaceId, workspace: ws, kind: input.kind, title: `${input.actorEmail || 'A teammate'} mentioned you`,
      message: `${input.where}: ${input.text.length > 200 ? `${input.text.slice(0, 199)}…` : input.text}`,
      eventKey: `mention:${input.eventKey}`, recordId: input.recordId, actorUid: input.actorUid, onlyUids: named,
    });
    return named;
  } catch {
    return [];
  }
}
