-- Customer extras (Y-21, Y-25): the people to deal with at a customer (`contacts`) and a notes
-- timeline (`noteLog`) are saved by the customer form and page. currency, tags and address were
-- already allowed; vendors have no allowed-field list.
update public.lf_rules set allowed_keys = allowed_keys || array['contacts', 'noteLog']
where table_name = 'customers' and not ('contacts' = any(allowed_keys));
