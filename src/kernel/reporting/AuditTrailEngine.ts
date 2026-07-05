export interface AuditEvent {
  actorId: string;
  timestamp: string;
  objectId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'VOID' | 'RECONCILE';
  oldValue?: any;
  newValue?: any;
}

export class AuditTrailEngine {
  private static auditLogs: AuditEvent[] = [];

  static log(event: AuditEvent): void {
    // Deep clone state to preserve history accurately
    this.auditLogs.push({
      ...event,
      oldValue: event.oldValue ? JSON.parse(JSON.stringify(event.oldValue)) : undefined,
      newValue: event.newValue ? JSON.parse(JSON.stringify(event.newValue)) : undefined,
    });
  }

  static getLogsForObject(objectId: string): AuditEvent[] {
    return this.auditLogs.filter(log => log.objectId === objectId);
  }

  static getLogsByActor(actorId: string): AuditEvent[] {
    return this.auditLogs.filter(log => log.actorId === actorId);
  }

  static getLogsByDateRange(startDate: string, endDate: string): AuditEvent[] {
    return this.auditLogs.filter(log => log.timestamp >= startDate && log.timestamp <= endDate);
  }

  static getAllLogs(limit?: number, offset?: number): AuditEvent[] {
    let logs = this.auditLogs;
    if (offset !== undefined) logs = logs.slice(offset);
    if (limit !== undefined) logs = logs.slice(0, limit);
    return logs;
  }
}
