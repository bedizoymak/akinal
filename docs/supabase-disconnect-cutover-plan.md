# Supabase Disconnect Cutover Plan

## Current Safe Path

The current controlled path is to keep Supabase installed and configured while the public frontend reads from PHP API + MySQL. Supabase should not be physically deleted until every runtime read/write/auth/storage dependency has been replaced and tested.

For the first data import, use the `public-launch` converter mode. It imports only the rows needed by the public website launch:

- `ak_site_settings`
- `ak_projects`
- `ak_project_images`, only when valid exported rows exist
- `ak_media_library`, only when valid exported rows exist

The existing 20 MySQL `ak_` tables stay intact. Public-launch does not drop, truncate, delete, or alter tables. It only generates reviewed `INSERT ... ON DUPLICATE KEY UPDATE` statements for allowed public tables.

## Manual Review Before Import

Before importing SQL into production:

1. Generate the SQL locally:

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs --input migration-tools/exports/full_export.json --mode public-launch --output migration-tools/output/import-public-launch.sql
```

2. Confirm the SQL contains only expected public tables.
3. Confirm there are no `DROP`, `TRUNCATE`, or `DELETE` statements.
4. Confirm no `DEMO_DATA` rows are present.
5. Review warnings in `import-public-launch-report.json`.
6. Import through phpMyAdmin or another controlled hosting tool.
7. Test:
   - `/api/site-settings.php`
   - `/api/projects.php`
   - `/api/project-detail.php?slug=<real-slug>`
   - Home page
   - Projects page
   - Project detail page

## Supabase Storage

Public-launch preserves `/uploads/...` paths and converts `/src/assets/...` project cover paths to `NULL` with warnings, because Vite source asset paths do not exist in production hosting.

If exported rows contain Supabase Storage URLs, download those files separately and rewrite DB fields to same-domain upload paths before depending on them:

- project images -> `public_html/uploads/projects/`
- customer documents -> `public_html/uploads/customers/`
- payment documents -> `public_html/uploads/payments/`
- expense documents -> `public_html/uploads/expenses/`

## What Stays Deferred

These areas stay connected to Supabase or un-migrated until their PHP replacements exist:

- contact request writes
- cookie consent writes
- admin login/session flow
- admin project/customer/finance/media/settings CRUD
- Supabase Storage upload and download replacement
- Supabase Auth user replacement
- Edge functions, if any runtime usage remains

Admin users must be created fresh in `ak_admin_users` with PHP `password_hash()`. Do not copy Supabase Auth passwords.

## Recommended Next Steps

1. Import reviewed `public-launch` SQL.
2. Verify public PHP endpoints and public pages against production MySQL data.
3. Migrate public writes: contact request and cookie consent.
4. Implement PHP admin auth against `ak_admin_users`.
5. Migrate admin CRUD one area at a time.
6. Export/download storage files and rewrite URL fields.
7. Remove frontend Supabase runtime calls.
8. Remove Supabase packages and client files only after code search confirms no runtime dependency remains.
9. Disconnect/delete Supabase project only after a final production smoke test and backup.
