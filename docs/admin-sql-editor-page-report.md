# Admin SQL Editor Page Report

## Summary

Added an admin-only SQL Editor at `/admin/sql-editor` for running one raw MySQL statement per request from the admin panel.

The editor supports read and write statements, shows SELECT-style results in a table, shows affected rows for write queries, stores local query history in the browser, and requires explicit confirmation before any non-SELECT query can run.

## Files Changed

- `src/App.tsx`
- `src/components/admin/AdminLayout.tsx`
- `src/pages/admin/AdminSqlEditor.tsx`
- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`
- `public_html/api/admin/sql-editor.php`
- `docs/admin-sql-editor-page-report.md`

## Frontend Changes

- Added `/admin/sql-editor` route.
- Added `SQL Editor` item to the admin sidebar under `Sistem`.
- Added warning banner:
  - `Canlı veritabanında yapılan işlemler geri alınamaz.`
- Added SQL textarea with default sample query.
- Added one-statement validation before submit.
- Added confirmation checkbox for non-SELECT queries.
- Added destructive confirmation input for:
  - `DROP`
  - `TRUNCATE`
  - `ALTER`
- Added SELECT result table rendering.
- Added affected row display for write queries.
- Added browser-side query history using `localStorage`.

## Backend Endpoint

Added:

- `POST /api/admin/sql-editor.php`

The endpoint:

- Uses existing admin session authentication through `require_admin()`.
- Accepts SQL only from JSON request body.
- Allows one SQL statement per request.
- Allows a trailing semicolon, but rejects additional statement separators.
- Supports read statements:
  - `SELECT`
  - `SHOW`
  - `DESCRIBE`
  - `DESC`
  - `EXPLAIN`
- Supports write/schema statements through PDO execution:
  - `INSERT`
  - `UPDATE`
  - `DELETE`
  - `CREATE`
  - `ALTER`
  - `DROP`
  - `TRUNCATE`
  - other single-statement SQL supported by MySQL/PDO

## Safety Rules

- Admin session is required.
- DB credentials are never returned to the frontend.
- Non-SELECT queries require the frontend and backend confirmation flag.
- Destructive queries require typing `UYGULA`.
- SQL execution errors are logged server-side, while the frontend receives a safe generic error message.
- Only one statement is accepted per request.

## Server-Side Logging

No dedicated audit-log table was found in the existing admin helpers.

Executed SQL is logged with `error_log()` including:

- UTC date
- admin id
- admin email
- statement type
- normalized SQL snippet

## Validation

- `npm run build` passed.
- PHP lint was attempted but the local `php` command is not installed in this environment.

## Known Limitations

- This is a powerful production database tool and should be restricted to trusted admins only.
- Query history is browser-local and not shared between devices.
- Server-side SQL logs use PHP/server error logs rather than a structured database audit table.
- Result tables intentionally truncate long cell text in the UI to prevent layout overflow.

## Result

Admin users now have a Supabase-like SQL editor inside the admin panel, backed by the existing PHP/MySQL stack and protected by admin authentication plus confirmation controls for risky operations.
