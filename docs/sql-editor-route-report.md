# SQL Editor Route Report

Date: 2026-06-03

## Executive Summary

The SQL Editor frontend route no longer exists in the active React route table, and there is no current admin sidebar/menu entry for it. The SQL Editor page component still exists in the source tree, and the backend SQL editor API endpoint still exists under `public_html`, but both are effectively outside normal admin navigation.

Current state: SQL editor route removed from the frontend; component and backend endpoint retained.

## Component File Path

- Component: `src/pages/admin/AdminSqlEditor.tsx`
- Export: default `AdminSqlEditor`
- API client used by component: `executeAdminSql` from `src/lib/apiClient.ts`
- API type used by client: `AdminSqlEditorResult` from `src/lib/apiTypes.ts`

The component still contains SQL execution UI behavior, including query text input, query history, confirmation controls, SELECT-style result rendering, and stricter handling for destructive operations.

## Route Path

- Historical route path: `/admin/sql-editor`
- Current frontend route declaration: not present
- Current import/lazy declaration in `src/App.tsx`: not present
- Current menu/sidebar entry in `src/components/admin/AdminLayout.tsx`: not present
- Current page metadata in `src/components/admin/AdminLayout.tsx`: not present

Whether the route still exists: No. The active frontend app does not currently register `/admin/sql-editor`.

## Route Guards

The SQL editor page is not currently mounted by a route. If it were re-added under the existing `/admin` route group, it would inherit the admin layout guard from `src/components/admin/AdminLayout.tsx`:

- Waits for auth loading to finish.
- Redirects users without a session to `/admin/giris`.
- Redirects users without admin role to `/admin/giris`.
- Allows access only when `useAuth()` reports an authenticated admin user.

The backend endpoint has its own guard in `public_html/api/admin/sql-editor.php`:

- Requires an authenticated admin session via `require_admin()`.
- Requires HTTP `POST`.
- Requires `ENABLE_ADMIN_SQL_EDITOR === true`.
- Rejects empty SQL.
- Normalizes and limits execution to a single statement.
- Requires explicit confirmation for non-read queries.
- Requires extra destructive-operation confirmation for `DROP`, `TRUNCATE`, and `ALTER`.

## Current Access Requirements

Frontend access:

- No active frontend route exists, so normal users and admins cannot reach the SQL editor through the app route table or admin menu.
- Unauthenticated navigation to `/admin/sql-editor` would still pass through the `/admin` layout guard and redirect to `/admin/giris`.
- Authenticated admin navigation to `/admin/sql-editor` has no matching child page route in the current route table.

Backend API access:

- Endpoint: `/api/admin/sql-editor.php`
- Server file: `public_html/api/admin/sql-editor.php`
- Requires authenticated admin session.
- Requires `POST`.
- Requires server-side feature flag `ENABLE_ADMIN_SQL_EDITOR` to be defined and set to `true`.
- Disabled state returns the Turkish error message: `SQL editör üretim ortamında devre dışı.`

## SQL Editor Menu Entries

No current SQL Editor or database tools menu entry was found in `src/components/admin/AdminLayout.tsx`.

The current `Sistem` admin navigation group only includes:

- `/admin/ayarlar`

No `Database`, `SQL Editor`, `Veritabanı`, or equivalent database tools page is currently exposed in the active admin navigation.

## Database Tools Pages

Current database-tool related source artifacts:

- `src/pages/admin/AdminSqlEditor.tsx`
- `public_html/api/admin/sql-editor.php`
- `src/lib/apiClient.ts` function `executeAdminSql`
- `src/lib/apiTypes.ts` type `AdminSqlEditorResult`

No active database tools page route was found in the current frontend route table.

## Historical References

Older documentation still references the SQL editor route and its removal:

- `docs/admin-sql-editor-page-report.md` documents the original `/admin/sql-editor` page.
- `docs/full-project-audit-report.md` lists `/admin/sql-editor` among prior admin routes.
- `docs/phase-1-launch-readiness-fixes-report.md` states that the `/admin/sql-editor` frontend route and normal admin navigation entry were removed for launch readiness.
- `docs/reusable-admin-panel-blueprint.md` still contains reusable blueprint references to `/admin/sql-editor`.

These references are historical or blueprint documentation, not proof of an active route in the current application.

## Conclusion

The SQL Editor route does not currently exist in the live frontend routing configuration. The implementation remains present as a dormant component and protected backend endpoint. Current launch posture appears intentional: the UI route and menu entry are removed, while the backend endpoint is additionally protected by admin authentication, POST-only access, and a disabled-by-default feature flag.
