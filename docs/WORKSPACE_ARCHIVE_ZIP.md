# E-21 Workspace archive ZIP

In Settings → Backup & Export, the workspace owner can download a ZIP based on the existing server JSON backup. The archive is read-only and uses the existing authenticated export endpoint. The source SHA-256 digest, schema version, workspace, record scope and reported counts are checked first. The screen refuses missing, altered or partial source data.

The archive contains a manifest, original backup.json, workspace.json, and a JSON and CSV copy for each collection included in the server backup. Empty collections are retained. The CSV is encoded as UTF-8 with the original Record JSON column for nested fields and the shared spreadsheet-safe quoting.

ZIP entries use the stored method, UTF-8 filenames and CRC32. The ZIP32 size limit is enforced. No additional package, migration, posting operation or server route is introduced.

## Coverage (BK-10)

The server backup (exportWorkspaceBackup in workspaceRestoreService) now holds every workspace record table: the ledger, the documents, the contacts, the settings tables (tax rates, dimensions, numbering, periods), and since BK-10 also invoice templates, learned bank-rule patterns, forecast scenarios, loans, filed tax returns, the fixed-asset table, client queries and the `documents` rows that are records (tasks, time entries, stage and rate settings). The workspace document (workspace.json) carries the settings; on restore the lock dates come back only forward (a backup never reopens a closed month) and the opening-balance date only where none is set.

Uploaded files: the archive carries the attachment list (`collections/attachments`: name, size, type, the record it belongs to, the SHA-256 of the stored file), not the file bytes. The restore never deletes or replaces a stored file, and its result lists any listed file that is not in the workspace (`attachments.missing`).

Left out on purpose (`NOT_IN_BACKUP`): members and invitations, API keys, bank connections and their tokens, the audit trail, notifications and e-mail logs, support tickets, derived training data and system tables.

A table added by BK-10 is replaced only when the backup has its key, so a backup made before BK-10 leaves those tables as they are.

## Restore

Settings → Backup & Export → Restore Workspace accepts the ZIP as well as backup.json. backupFromWorkspaceArchive checks each entry's CRC32, the manifest and the backup's SHA-256, then sends backup.json, exactly as archived, to the same restore endpoint. The restore puts the backup back into the workspace it was made from (the backup's workspace id must match); after a workspace is deleted, it is restored into the workspace made again under that id.

## Verification

Unit tests inspect the binary ZIP directory and checksums, preserve Hebrew text and exact source JSON, check CSV formula escaping, and refuse altered snapshots or wrong workspaces. Screen tests check owner access, server refusal and workspace changes. Complete repository CI is required before merge.

src/tests/bk10-archive-restore.test.ts (database) archives a seeded workspace, wipes it, restores the ZIP and checks the trial balance, profit and loss, balance sheet, record counts, settings and attachment list against hand-worked figures.
