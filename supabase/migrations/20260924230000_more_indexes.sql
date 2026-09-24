-- The remaining ordered lists from firestore.indexes.json (Postgres answers these queries
-- without an index too; these keep them fast as workspaces grow).
create index if not exists estimates_ws_date_idx on public.estimates (workspace_id, (data->>'date'));
create index if not exists "creditNotes_ws_date_idx" on public."creditNotes" (workspace_id, (data->>'date'));
create index if not exists "vendorCredits_ws_date_idx" on public."vendorCredits" (workspace_id, (data->>'date'));
create index if not exists "supportTickets_ws_last_idx" on public."supportTickets" (workspace_id, (data->>'lastMessageAt'));
create index if not exists "supportTickets_status_last_idx" on public."supportTickets" ((data->>'status'), (data->>'lastMessageAt'));
create index if not exists "supportMessages_ticket_created_idx" on public."supportMessages" ((data->>'ticketId'), (data->>'createdAt'));
