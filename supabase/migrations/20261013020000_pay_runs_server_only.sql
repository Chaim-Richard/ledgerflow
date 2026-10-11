-- Pay runs (U-02, U-10) are posted, approved, sent back and undone only by the server
-- (src/server/services/payRunService.ts: roles, the owner's approval, the balanced entry, audit).
-- Members still read them; nobody writes them from the browser, so a run cannot be marked
-- approved or posted there.
drop policy if exists writer_insert on public."payRuns";
drop policy if exists writer_update on public."payRuns";
drop policy if exists writer_delete on public."payRuns";
revoke insert, update, delete on public."payRuns" from authenticated;
