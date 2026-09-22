import { z } from 'zod';
import { ColumnDef } from '@tanstack/react-table';

export interface EntityIndexDef {
  fields: { fieldPath: string; order: 'ASCENDING' | 'DESCENDING' }[];
  queryScope?: 'COLLECTION' | 'COLLECTION_GROUP';
}

export interface EntityPermissionDef {
  read?: string[];
  write?: string[];
  delete?: string[];
}

export interface EntityDefinition<T extends z.ZodObject<any>> {
  name: string;
  collection: string;
  schema: T;
  indexes?: EntityIndexDef[];
  listColumns?: ColumnDef<z.infer<T>>[];
  permissions?: EntityPermissionDef;
}

const entityRegistry = new Map<string, EntityDefinition<any>>();

export function defineEntity<T extends z.ZodObject<any>>(
  config: EntityDefinition<T>
): EntityDefinition<T> {
  entityRegistry.set(config.name, config);
  return config;
}

export function getEntityRegistry(): Map<string, EntityDefinition<any>> {
  return entityRegistry;
}

export function getEntityDefinition(name: string): EntityDefinition<any> | undefined {
  return entityRegistry.get(name);
}

/**
 * Helper to generate firestore.rules security rule fragments for defined entities
 */
export function generateEntityFirestoreRules(): string {
  const rules: string[] = [];

  entityRegistry.forEach((entity) => {
    const keys = Object.keys(entity.schema.shape);
    const affectedKeysExpr = `request.resource.data.keys().hasOnly([${keys.map(k => `'${k}'`).join(', ')}])`;

    rules.push(`    // Entity: ${entity.name}`);
    rules.push(`    match /${entity.collection}/{docId} {`);
    rules.push(`      allow read: if isWorkspaceMember(resource.data.workspaceId);`);
    rules.push(`      allow create: if isWorkspaceMember(request.resource.data.workspaceId) && ${affectedKeysExpr};`);
    rules.push(`      allow update: if isWorkspaceMember(resource.data.workspaceId) && ${affectedKeysExpr};`);
    rules.push(`      allow delete: if isWorkspaceAdmin(resource.data.workspaceId);`);
    rules.push(`    }\n`);
  });

  return rules.join('\n');
}
