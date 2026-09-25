-- More fields the app writes but the rules did not list (the guard refuses the whole write):
-- - customers.status: the customer form saves active/inactive, so adding a customer failed.
-- - chartAccounts.role: the business templates' FX rounding account carries role 'fx_rounding'
--   (resolveAccountRole reads it), so applying a template failed. accountType and bankId are
--   older names still on the ChartAccount type.

update public.lf_rules set allowed_keys = allowed_keys || array['status']
where table_name = 'customers';

update public.lf_rules set allowed_keys = allowed_keys || array['role', 'accountType', 'bankId']
where table_name = 'chartAccounts';

-- On the Workspace model and set only by billing on the server: listed so a workspace that has
-- them can still be edited, immutable for users (and refused when a user creates a workspace).
update public.lf_rules
set allowed_keys = allowed_keys || array['paymentStatus', 'trialEndsAt'],
    immutable_keys = immutable_keys || array['paymentStatus', 'trialEndsAt']
where table_name = 'workspaces';
