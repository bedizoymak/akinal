# Public Launch Import Runbook

## Purpose

Use `public_html/import-public-launch.php` once to import reviewed public-launch SQL into shared hosting MySQL. This runner imports only the SQL placed at:

`public_html/import-data/import-public-launch.sql`

Do not commit that SQL file. It may contain production website data.

## Files To Upload

Upload these files by FTP or the hosting file manager:

- `public_html/import-public-launch.php`
- `public_html/import-data/import-public-launch.sql`

The SQL should come from the local ignored output:

`migration-tools/output/import-public-launch.sql`

Do not upload local credentials. Do not edit `public_html/api/config.php` during this import.

## Pre-Run Checks

Before uploading the SQL, confirm locally:

```bash
rg -n "ak_customers|ak_payments|ak_financial_entries|ak_notifications|ak_contact_requests|ak_cookie_consents|ak_admin_users|ak_profiles|ak_user_roles|DROP TABLE|TRUNCATE|DELETE|DEMO_DATA" migration-tools/output/import-public-launch.sql
```

Expected result: no matches.

The importer also refuses to run if the uploaded SQL contains:

- `DROP`
- `TRUNCATE`
- `DELETE`
- `DEMO_DATA`
- `ak_customers`
- `ak_payments`
- `ak_financial_entries`
- `ak_notifications`
- `ak_contact_requests`
- `ak_cookie_consents`
- `ak_admin_users`
- `ak_profiles`
- `ak_user_roles`

## Run Once

Open this URL in the browser:

```text
https://akinalinsaat.com/import-public-launch.php?confirm=IMPORT_PUBLIC_LAUNCH
```

Expected output includes:

```text
Connected DB: akinalin_wp282
Import started.
Import finished.
Affected statement count: ...
Affected row count: ...
Delete public_html/import-public-launch.php and public_html/import-data/import-public-launch.sql immediately.
```

## Verify

After the import finishes, test:

```text
https://akinalinsaat.com/api/site-settings.php
https://akinalinsaat.com/api/projects.php
https://akinalinsaat.com/api/project-detail.php?slug=kadikoy-kentsel-donusum-projesi
```

Then check the public site:

- Home page loads settings and featured projects.
- `/projelerimiz` lists imported projects.
- `/projeler` still works as the alias.
- Project detail opens for a real imported slug.

## Delete Immediately

After successful verification, delete both files from the server:

- `public_html/import-public-launch.php`
- `public_html/import-data/import-public-launch.sql`

Leaving one-time import tools or SQL files on shared hosting is unnecessary risk.

## If It Fails

If the importer refuses to run:

- Check that the URL includes `?confirm=IMPORT_PUBLIC_LAUNCH`.
- Check that `public_html/import-data/import-public-launch.sql` exists.
- Check whether the SQL contains a forbidden token.
- Check that the deployed API `config.php` still connects through `public_html/api/db.php`.

Do not weaken the forbidden-token checks for production. Regenerate or manually review the SQL instead.
