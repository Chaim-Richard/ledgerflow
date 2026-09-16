export interface JobRunRecord {
  id: string;
  jobName: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'failed';
  itemsProcessed: number;
  error?: string;
  workspaceId?: string;
  details?: any;
}

export interface JobResult {
  jobName: string;
  status: 'success' | 'failed';
  itemsProcessed: number;
  error?: string;
  details?: any;
}

export type JobHandler = () => Promise<JobResult>;
