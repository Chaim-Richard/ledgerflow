import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { defineEntity, getEntityRegistry, generateEntitySql } from '../lib/entityFramework';

describe('Entity Framework Guard Suite (Shortcut 3)', () => {
  it('registering an entity generates schema, collection metadata, and its database table + rules', () => {
    const ProductSchema = z.object({
      id: z.string(),
      workspaceId: z.string(),
      sku: z.string(),
      priceCents: z.number().int().nonnegative(),
      name: z.string()
    });

    const productEntity = defineEntity({
      name: 'Product',
      collection: 'products',
      schema: ProductSchema,
      indexes: [
        { fields: [{ fieldPath: 'workspaceId', order: 'ASCENDING' }, { fieldPath: 'sku', order: 'ASCENDING' }] }
      ]
    });

    assert.equal(productEntity.name, 'Product');
    assert.equal(productEntity.collection, 'products');

    const registry = getEntityRegistry();
    assert.ok(registry.has('Product'));

    const sql = generateEntitySql();
    assert.ok(sql.includes('create table public."products"'));
    assert.ok(sql.includes("insert into public.lf_rules (table_name, allowed_keys) values ('products', '{id,workspaceId,sku,priceCents,name}');"));
    assert.ok(sql.includes('create policy writer_insert on public."products"'));
    assert.ok(sql.includes('create policy two_step_login on public."products" as restrictive'));
  });
});
