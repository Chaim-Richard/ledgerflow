-- Customers can be left out of the monthly statement emails (Y-28), like "no reminders".
update public.lf_rules
set allowed_keys = allowed_keys || array['noStatements']
where table_name = 'customers' and not ('noStatements' = any(allowed_keys));

-- Set only by the daily job (the month statements were last sent): listed so a workspace that has it
-- can still be saved, and unchangeable by users.
update public.lf_rules
set allowed_keys = allowed_keys || array['lastStatementsMonth'],
    immutable_keys = immutable_keys || array['lastStatementsMonth']
where table_name = 'workspaces' and not ('lastStatementsMonth' = any(allowed_keys));
