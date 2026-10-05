import type { Transaction } from '../types';
/** Older imports can link by name. Renaming must not strand those observed references. */
export function assertProjectRenameSafe(oldName: string, transactions: Transaction[], incomplete: boolean) {
  if (incomplete) throw new Error('Load complete project history before renaming a project.');
  if (oldName && transactions.some(tx => tx.project === oldName || tx.lines?.some(line => line.project === oldName || line.dimensions?.project === oldName))) throw new Error('Older entries use this project name. Re-link them by project ID before renaming.');
}
