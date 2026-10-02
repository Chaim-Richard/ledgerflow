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

export interface EntityDefinition<T extends z.ZodObject<z.ZodRawShape>> {
  name: string;
  collection: string;
  schema: T;
  indexes?: EntityIndexDef[];
  listColumns?: ColumnDef<z.infer<T>>[];
  permissions?: EntityPermissionDef;
}

const entityRegistry = new Map<string, EntityDefinition<z.ZodObject<z.ZodRawShape>>>();

export function defineEntity<T extends z.ZodObject<z.ZodRawShape>>(
  config: EntityDefinition<T>
): EntityDefinition<T> {
  entityRegistry.set(config.name, config);
  return config;
}

export function getEntityRegistry(): Map<string, EntityDefinition<z.ZodObject<z.ZodRawShape>>> {
  return entityRegistry;
}

export function getEntityDefinition(name: string): EntityDefinition<z.ZodObject<z.ZodRawShape>> | undefined {
  return entityRegistry.get(name);
}

/**
 * SQL for each defined entity's collection, to paste into a new supabase/migrations file:
 * the document table, its allowed fields (browser writes may only use the schema's keys) and
 * the standard policies (members read; owner / accountant / bookkeeper write; two-step login).
 */
export function generateEntitySql(): string {
  const parts: string[] = [];

  entityRegistry.forEach((entity) => {
    const table = `public."${entity.collection}"`;
    const keys = Object.keys(entity.schema.shape);
    parts.push([
      `-- Entity: ${entity.name}`,
      `create table ${table} (`,
      `  id text primary key check (char_length(id) between 1 and 1500 and id !~ '[[:cntrl:]]'),`,
      `  data jsonb not null default '{}'::jsonb,`,
      `  workspace_id text generated always as (data->>'workspaceId') stored,`,
      `  created_at timestamptz not null default now(),`,
      `  updated_at timestamptz not null default now()`,
      `);`,
      `create index on ${table} (workspace_id);`,
      `alter table ${table} enable row level security;`,
      `create trigger lf_guard before insert or update or delete on ${table} for each row execute function public.lf_guard();`,
      `insert into public.lf_rules (table_name, allowed_keys) values ('${entity.collection}', '{${keys.join(',')}}');`,
      `create policy member_read on ${table} for select to authenticated using (public.lf_is_member(workspace_id));`,
      `create policy writer_insert on ${table} for insert to authenticated with check (public.lf_can_write(workspace_id));`,
      `create policy writer_update on ${table} for update to authenticated using (public.lf_can_write(workspace_id)) with check (public.lf_can_write(workspace_id));`,
      `create policy writer_delete on ${table} for delete to authenticated using (public.lf_can_write(workspace_id));`,
      `create policy two_step_login on ${table} as restrictive for all to authenticated using ((select public.lf_mfa_ok())) with check ((select public.lf_mfa_ok()));`,
      `grant select, insert, update, delete on ${table} to authenticated;`,
      '',
    ].join('\n'));
  });

  return parts.join('\n');
}
