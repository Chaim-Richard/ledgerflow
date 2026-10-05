-- Invoice approval (BE-04): the workspace keeps its own rule — invoices over this amount wait for
-- an owner's or an accountant's signature before they may be emailed. Saved in Settings → Emails &
-- Reminders by owners and accountants (the workspaces policy already limits writes to them).
-- The decision itself lives on each invoice (`approval`), and invoices have no allowed-field list.
update public.lf_rules
set allowed_keys = allowed_keys || array['invoiceApproval']
where table_name = 'workspaces' and not ('invoiceApproval' = any(allowed_keys));
