-- Postgres RLS (Layer 2 Isolation)
-- Enables Row Level Security on all tables to ensure tenant isolation at the database level.

-- 1. Enable RLS on core tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_lines ENABLE ROW LEVEL SECURITY;

-- 2. Create policies relying on current_setting('app.workspace_id')
CREATE POLICY isolation_transactions 
    ON transactions 
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

CREATE POLICY isolation_accounts 
    ON accounts 
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

CREATE POLICY isolation_ledger_lines 
    ON ledger_lines 
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- To use this in the app code, you would wrap your queries:
-- BEGIN;
-- SET LOCAL app.workspace_id = 'tenant-123';
-- SELECT * FROM transactions;
-- COMMIT;
