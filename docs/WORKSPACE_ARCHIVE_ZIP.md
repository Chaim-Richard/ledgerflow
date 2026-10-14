# E-21 Workspace archive ZIP

In Settings → Backup & Export, the workspace owner can download a ZIP based on the existing server JSON backup. The archive is read-only and uses the existing authenticated export endpoint. The source SHA-256 digest, schema version, workspace, record scope and reported counts are checked first. The screen refuses missing, altered or partial source data.

The archive contains a manifest, original backup.json, workspace.json, and a JSON and CSV copy for each collection included in the server backup. Empty collections are retained. The CSV is encoded as UTF-8 with the original Record JSON column for nested fields and the shared spreadsheet-safe quoting.

ZIP entries use the stored method, UTF-8 filenames and CRC32. The ZIP32 size limit is enforced. No additional package, migration, posting operation or server route is introduced.

## Coverage limitation

The server backup includes the collections read by exportWorkspaceBackup in workspaceRestoreService. That list is smaller than WORKSPACE_PURGE_ORDER in constants/collections.ts. Therefore this ZIP is complete only for the existing server backup collection scope. Additional operational tables and externally stored attachments are not represented. The UI clearly describes this limitation. A full database-and-files archive needs a separately reviewed server contract and permission design.

## Verification

Unit tests inspect the binary ZIP directory and checksums, preserve Hebrew text and exact source JSON, check CSV formula escaping, and refuse altered snapshots or wrong workspaces. Screen tests check owner access, server refusal and workspace changes. Complete repository CI is required before merge.

Restore requires extracting backup.json and using the existing JSON restore flow.
