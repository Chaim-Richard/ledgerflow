# 1. Top-Level Firestore Collections Architecture

## Status
Accepted

## Context
Initial design iterations considered nesting user financial transactions under `workspaces/{workspaceId}/transactions/{transactionId}`. However, cross-workspace security rules, top-level collection group indexing, and server-side aggregation pipelines require top-level scope query performance.

## Decision
All core financial collections (`transactions`, `invoices`, `bills`, `chartAccounts`, `projects`, `auditLogs`) are strictly top-level Firestore collections. Each document contains a top-level `workspaceId: string` field.

## Consequences
- Guarantees predictable Firestore security rule enforcement (`resource.data.workspaceId`).
- Prevents deeply nested collection path confusion.
- Simplifies composite index declarations in `firestore.indexes.json`.
