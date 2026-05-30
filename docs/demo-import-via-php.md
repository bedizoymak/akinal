# Demo Import Via PHP

This is a temporary fallback for importing demo data when direct MySQL access is not available locally.

## Files

- Import endpoint: `public_html/api/admin/run-demo-import.php`
- SQL source: `migration-tools/output/import-demo-data.sql`
- Config placeholder: `DEMO_IMPORT_TOKEN` in `public_html/api/config.example.php`

## Security Rules

- The endpoint requires an existing admin session.
- The endpoint requires a server-side `DEMO_IMPORT_TOKEN`.
- The endpoint reads only the fixed server-side SQL file.
- The endpoint does not accept SQL from request body, query string, headers, or uploads.
- The endpoint uses a transaction when PDO/MySQL allows it.

## Production Setup

1. Upload the current code and `migration-tools/output/import-demo-data.sql` to the same repository layout on the server.
2. In production `public_html/api/config.php`, add:

```php
define('DEMO_IMPORT_TOKEN', 'REPLACE_WITH_LONG_RANDOM_SECRET');
```

3. Log in to the admin panel in the same browser/session.
4. Run one POST request:

```bash
curl -X POST "https://example.com/api/admin/run-demo-import.php?token=REPLACE_WITH_LONG_RANDOM_SECRET" \
  --cookie "PHPSESSID=YOUR_ADMIN_SESSION_COOKIE"
```

Or send the token as a header:

```bash
curl -X POST "https://example.com/api/admin/run-demo-import.php" \
  -H "X-Demo-Import-Token: REPLACE_WITH_LONG_RANDOM_SECRET" \
  --cookie "PHPSESSID=YOUR_ADMIN_SESSION_COOKIE"
```

The response returns:

- `success`
- `statements_run`
- `errors`
- `delete_this_file_immediately`

## After Successful Import

Delete this file from production immediately:

```text
public_html/api/admin/run-demo-import.php
```

Then remove `DEMO_IMPORT_TOKEN` from production `config.php`.

Do not leave the importer deployed after use.

## Notes

- The current demo SQL caps `ak_notifications` to the newest 10 related records.
- The SQL uses `ON DUPLICATE KEY UPDATE`, so it is intended to be idempotent.
- Make a database backup before running the import.
- Do not run the import automatically from deployment scripts.
