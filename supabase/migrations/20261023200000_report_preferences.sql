-- D-47: recent reports and pinned pages are private navigation preferences, not ledger data.
-- Keep one independently updated, hash-keyed record per workspace inside the user's existing profile.
-- The existing own-user RLS, personal-data export, and account deletion therefore apply unchanged.
-- Reads normalize every nested value; a user can never affect another user's or the workspace's data.
update public.lf_rules
set allowed_keys = allowed_keys || array['reportPreferences']
where table_name = 'users' and not ('reportPreferences' = any(allowed_keys));
