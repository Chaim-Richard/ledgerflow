/**
 * Tasks (BG-02 assign a record, BG-03 task list): "Follow up the overdue invoice INV-12" given to a
 * person in the workspace, optionally about one record (an invoice, a bill, an entry, an account, an
 * item), with an optional due date. The person is told; ticking it done tells whoever made it.
 * Kept with the workspace's documents (kind "task", no `uid`, so they never show in anyone's Vault)
 * and written by the server only (src/server/services/taskService.ts).
 */
import type { RecordRef, RecordType } from './recordLinks';

export const TASK_KIND = 'task';
export const MAX_TASK_TITLE = 200;
export const MAX_TASK_NOTE = 2000;
export const MAX_OPEN_TASKS = 1000;

export type TaskStatus = 'open' | 'done';

export interface Task {
  id: string;
  kind: typeof TASK_KIND;
  workspaceId: string;
  title: string;
  note?: string;
  assignee: string;
  createdBy: string;
  createdByEmail?: string;
  createdAt: string;
  due?: string;
  /** the record it is about, with what the list shows for it ("Invoice INV-12") */
  record?: RecordRef & { label: string };
  status: TaskStatus;
  doneAt?: string;
  doneBy?: string;
}

/** Records a task can be about (all that open in a screen, src/lib/recordLinks.ts). */
export const TASK_RECORD_TYPES: Array<{ value: RecordType; label: string }> = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'bill', label: 'Bill' },
  { value: 'transaction', label: 'Entry' },
  { value: 'account', label: 'Account' },
  { value: 'item', label: 'Item' },
];

export interface TaskInput { title?: unknown; note?: unknown; assignee?: unknown; due?: unknown; record?: unknown }

/** What a new task needs; null when it is fine. Who may be given it is checked by the server. */
export function taskProblem(input: TaskInput): string | null {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (title.length < 3 || title.length > MAX_TASK_TITLE) return `Say what is to be done (3 to ${MAX_TASK_TITLE} characters)`;
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > MAX_TASK_NOTE)) return `Keep the note under ${MAX_TASK_NOTE} characters`;
  if (typeof input.assignee !== 'string' || !input.assignee) return 'Choose who does it';
  if (input.due !== undefined && input.due !== '' && (typeof input.due !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.due))) return 'Choose a due date, or none';
  if (input.record !== undefined && input.record !== null) {
    const r = input.record as Partial<RecordRef & { label: string }>;
    if (!TASK_RECORD_TYPES.some(t => t.value === r.type) || typeof r.id !== 'string' || !r.id || r.id.length > 200 || typeof r.label !== 'string' || r.label.length > 200) return 'Choose the record the task is about, or none';
  }
  return null;
}

/** Open first (earliest due first, no due date last), then done, newest first. */
export function sortTasks(tasks: Task[]): Task[] {
  const dueKey = (t: Task) => t.due || '9999-12-31';
  return [...tasks].sort((a, b) => (a.status === b.status
    ? (a.status === 'open' ? dueKey(a).localeCompare(dueKey(b)) || a.createdAt.localeCompare(b.createdAt) : String(b.doneAt).localeCompare(String(a.doneAt)))
    : a.status === 'open' ? -1 : 1));
}

export const isLate = (task: Pick<Task, 'status' | 'due'>, today: string) => task.status === 'open' && Boolean(task.due) && String(task.due) < today;
