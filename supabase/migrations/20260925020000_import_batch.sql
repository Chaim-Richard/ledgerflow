-- Bulk import (K-01): every imported customer / vendor / item / account carries the import's
-- batch id so the import can be undone. Records are created by the server; the browser must
-- still be able to edit them later, so the field is allowed, and it may not be changed.
-- (vendors and inventory have no allowed-field list.)

update public.lf_rules
set allowed_keys = allowed_keys || array['importBatchId'],
    immutable_keys = immutable_keys || array['importBatchId']
where table_name = 'customers' and not ('importBatchId' = any(allowed_keys));

update public.lf_rules
set allowed_keys = allowed_keys || array['importBatchId'],
    immutable_keys = immutable_keys || array['importBatchId']
where table_name = 'chartAccounts' and not ('importBatchId' = any(allowed_keys));
