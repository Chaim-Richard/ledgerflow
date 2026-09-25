-- Email templates (K-08) and payment reminder settings (BE-01, K-26) are workspace settings that
-- owners and accountants edit (the workspace update policy already limits who can write).

update public.lf_rules
set allowed_keys = allowed_keys || array['emailTemplates', 'reminderSettings']
where table_name = 'workspaces' and not ('emailTemplates' = any(allowed_keys));
