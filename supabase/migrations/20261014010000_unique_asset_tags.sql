-- A-8 handoff (AI #3 → AI #1): an asset tag is used once per workspace, enforced by the database
-- so two browsers saving the same tag at the same moment cannot both succeed. Tags are compared
-- trimmed and case-folded (Code 128-B tags are ASCII), like the screen's own check.
-- If a workspace already has duplicates, the index is not created and a notice says so: the
-- duplicates must be renamed first (the screen refuses new ones in the meantime).
do $$
begin
  if exists (
    select 1 from public."assets"
    where coalesce(btrim(data->>'assetTag'), '') <> ''
    group by workspace_id, lower(btrim(data->>'assetTag'))
    having count(*) > 1
  ) then
    raise notice 'assets_workspace_tag_uq not created: some workspace has duplicate asset tags';
  else
    create unique index if not exists assets_workspace_tag_uq
      on public."assets" (workspace_id, lower(btrim(data->>'assetTag')))
      where coalesce(btrim(data->>'assetTag'), '') <> '';
  end if;
end $$;
