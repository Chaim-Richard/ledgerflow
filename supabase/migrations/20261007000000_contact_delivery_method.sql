-- Contacts choose how their documents are delivered (Y-27): Email (the default, and what happened
-- before anyone could choose), Print, Post, or Nothing automatic. Only the sends that happen by
-- themselves look at it — the daily payment reminders, the monthly statement batch and emailing an
-- invoice when it is saved as sent. A person pressing "Email" still sends, and the send log says it
-- went against the preference.
--
-- Vendors have no allowed-field list (see 20261003000000_contact_fields.sql), so only the customer
-- list needs the key.
update public.lf_rules
set allowed_keys = allowed_keys || array['deliveryMethod']
where table_name = 'customers' and not ('deliveryMethod' = any(allowed_keys));
