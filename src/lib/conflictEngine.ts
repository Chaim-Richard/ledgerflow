export interface VersionedEntity {
  id: string;
  updatedAt?: string;
  expectedUpdatedAt?: string;
  _version?: number;
}

export interface ConflictCheckResult<T> {
  hasConflict: boolean;
  serverEntity?: T;
  clientEntity?: T;
  resolvedEntity?: T;
  reason?: string;
}

/**
 * Checks if a client update conflicts with the current server state.
 */
export function checkVersionConflict<T extends VersionedEntity>(
  clientEntity: T,
  serverEntity: T
): ConflictCheckResult<T> {
  if (clientEntity.expectedUpdatedAt && serverEntity.updatedAt) {
    if (new Date(clientEntity.expectedUpdatedAt).getTime() < new Date(serverEntity.updatedAt).getTime()) {
      return {
        hasConflict: true,
        serverEntity,
        clientEntity,
        reason: 'Server document has been modified since client read'
      };
    }
  }

  if (clientEntity._version !== undefined && serverEntity._version !== undefined) {
    if (clientEntity._version < serverEntity._version) {
      return {
        hasConflict: true,
        serverEntity,
        clientEntity,
        reason: 'Client version is behind server version'
      };
    }
  }

  return {
    hasConflict: false,
    resolvedEntity: clientEntity
  };
}

/**
 * Resolves conflict by taking Last-Write-Wins (LWW) or field merge strategy.
 */
export function resolveConflictLWW<T extends VersionedEntity>(
  clientEntity: T,
  serverEntity: T
): T {
  const clientTime = new Date(clientEntity.updatedAt || 0).getTime();
  const serverTime = new Date(serverEntity.updatedAt || 0).getTime();

  if (clientTime >= serverTime) {
    return {
      ...clientEntity,
      _version: (serverEntity._version || 0) + 1,
      updatedAt: new Date().toISOString()
    };
  }

  return serverEntity;
}
