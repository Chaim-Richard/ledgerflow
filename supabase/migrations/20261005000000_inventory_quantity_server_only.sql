-- Stock on hand changes only through the server (Adjust stock, stock counts, sales and their
-- reversals), which posts the matching ledger entry in the same database transaction. Browsers
-- may still create items and edit names, prices and costs, but no longer change quantityAtHand
-- of an existing item (L-173), so the quantity and the Inventory account cannot drift apart.
update public.lf_rules
   set immutable_keys = immutable_keys || array['quantityAtHand']
 where table_name = 'inventory' and not ('quantityAtHand' = any (immutable_keys));
