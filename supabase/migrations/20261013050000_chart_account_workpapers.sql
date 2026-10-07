-- Workpapers (BD-04): per account and month, the note and the review mark kept on Month-End
-- Close. Owners and accountants save them on the account document (the chartAccounts policy
-- already limits writes to them); nothing about money is written, and the field is not dated,
-- so a workpaper can be kept after the month is closed. Safe to run twice.
update public.lf_rules
set allowed_keys = allowed_keys || array['workpapers']
where table_name = 'chartAccounts' and not ('workpapers' = any(allowed_keys));
