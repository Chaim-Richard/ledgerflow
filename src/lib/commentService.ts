export interface RecordComment {
  id: string;
  workspaceId: string;
  entityType: 'transaction' | 'invoice' | 'bill' | 'customer' | 'vendor' | 'project';
  entityId: string;
  authorEmail: string;
  authorName?: string;
  comment: string;
  createdAt: string;
  isInternalOnly?: boolean;
  attachments?: string[];
}

const commentsStore: RecordComment[] = [];

export function addComment(commentData: Omit<RecordComment, 'id' | 'createdAt'>): RecordComment {
  const comment: RecordComment = {
    ...commentData,
    id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString()
  };
  commentsStore.push(comment);
  return comment;
}

export function getCommentsForEntity(entityType: RecordComment['entityType'], entityId: string): RecordComment[] {
  return commentsStore.filter(c => c.entityType === entityType && c.entityId === entityId);
}

export function deleteComment(id: string): boolean {
  const idx = commentsStore.findIndex(c => c.id === id);
  if (idx !== -1) {
    commentsStore.splice(idx, 1);
    return true;
  }
  return false;
}
