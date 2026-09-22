import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { defineEntity, getEntityRegistry, generateEntityFirestoreRules } from '../lib/entityFramework';

describe('Entity Framework Guard Suite (Shortcut 3)', () => {
  it('registering an entity generates schema, collection metadata, and Firestore rules', () => {
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

    const rules = generateEntityFirestoreRules();
    assert.ok(rules.includes('match /products/{docId}'));
    assert.ok(rules.includes("request.resource.data.keys().hasOnly(['id', 'workspaceId', 'sku', 'priceCents', 'name'])"));
  });
});
