-- Workspace fields the app writes but the rules did not list. The guard rejects a workspace
-- document that has any field outside allowed_keys, so saving the time zone failed, the fiscal
-- year could not be set, and one server-written field (e.g. a scheduled purge date) made every
-- later settings save for that workspace fail.
--
-- Settings owners/accountants may change: timezone, fiscal year, saved CSV column maps.
-- Written only by the server (listed, but immutable for users and refused when a user creates a
-- workspace): deletion/purge dates, billing multipliers and limits set by platform admins.

update public.lf_rules
set allowed_keys = allowed_keys || array[
      'timezone', 'fiscalYearStartMonth', 'fiscalYearStartDay', 'fiscalYearEnd', 'importColumnMaps',
      'isClosed', 'computeLimit', 'lastUpgradedAt', 'deletedAt', 'scheduledPurgeAt',
      'creditCostMultiplier', 'quotaCentsMultiplier', 'customKeyCreditCharge', 'customKeyCentsCharge',
      'freeWorkspaceTxCap'
    ],
    immutable_keys = immutable_keys || array[
      'isClosed', 'computeLimit', 'lastUpgradedAt', 'deletedAt', 'scheduledPurgeAt',
      'creditCostMultiplier', 'quotaCentsMultiplier', 'customKeyCreditCharge', 'customKeyCentsCharge',
      'freeWorkspaceTxCap'
    ]
where table_name = 'workspaces';

create or replace function public.lf_guard_special() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  newd jsonb := case when tg_op in ('INSERT', 'UPDATE') then new.data end;
  oldd jsonb := case when tg_op in ('UPDATE', 'DELETE') then old.data end;
  k text;
begin
  if not public.lf_is_client() then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'chartAccounts' and tg_op = 'UPDATE'
     and coalesce((oldd->>'isSystem')::boolean, false) then
    foreach k in array array['type', 'code', 'classification'] loop
      if (oldd->k) is distinct from (newd->k) then
        raise exception 'System accounts cannot change "%"', k using errcode = '42501';
      end if;
    end loop;
  end if;

  if tg_table_name = 'workspaces' then
    if tg_op = 'INSERT' then
      if char_length(coalesce(newd->>'name', '')) >= 128
         or char_length(coalesce(newd->>'description', '')) >= 1000
         or (newd ? 'plan' and newd->>'plan' not in ('starter', 'free'))
         or (newd ? 'computeCreditBalance' and (newd->>'computeCreditBalance')::numeric > 100)
         or (newd ? 'bypassBilling' and newd->'bypassBilling' <> 'false'::jsonb)
         or (newd ? 'maxSeats' and (newd->>'maxSeats')::numeric > 5)
         -- fields only the server or a platform admin sets
         or newd ?| array[
              'isClosed', 'computeLimit', 'lastUpgradedAt', 'deletedAt', 'scheduledPurgeAt',
              'creditCostMultiplier', 'quotaCentsMultiplier', 'customKeyCreditCharge', 'customKeyCentsCharge',
              'freeWorkspaceTxCap', 'stripeCustomerId', 'stripeSubscriptionId', 'apiQuotaTotalCentsUsed',
              'apiQuotaMonthlyLimitCents', 'lockedUntilDate', 'billingLedgerChain', 'allowedWorldPaths',
              'totalQueriesThisMonth', 'computeHardnessScore', 'concurrentUserLimit', 'seatCount'
            ] then
        raise exception 'Workspace values not allowed' using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' and not public.lf_is_platform_admin() then
      if (oldd->'lockDate') is distinct from (newd->'lockDate') and not public.lf_can_admin(old.id) then
        raise exception 'Only owners and accountants can change the lock date' using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_table_name = 'supportTickets' and tg_op = 'UPDATE' and not public.lf_is_platform_admin() then
    if (newd->>'status') is distinct from (oldd->>'status')
       and coalesce(newd->>'status', '') not in ('closed', 'resolved') then
      raise exception 'Users can only close or resolve a ticket' using errcode = '42501';
    end if;
  end if;

  return coalesce(new, old);
end $$;

revoke execute on function public.lf_guard_special() from public, anon, authenticated;
