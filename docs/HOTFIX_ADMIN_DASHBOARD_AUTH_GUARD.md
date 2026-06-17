# Hotfix Admin Dashboard Auth Guard

## Problem

Production showed `api/admin/me.php 401` followed by a React crash in the admin dashboard:

`Cannot read properties of undefined (reading 'summary')`

The dashboard could still attempt to render financial fields when the admin session was invalid or when the dashboard API returned missing/empty data.

## Implemented

- Added HTTP-status-aware `ApiError` handling in the frontend API client.
- Redirect dashboard users to `/admin/giris` when dashboard data requests return `401` or `403`.
- Added safe dashboard response normalization before rendering.
- Added null-safe defaults for `summary` and nested dashboard sections.
- Added graceful error state with retry for non-auth API failures.
- Preserved all verified financial formulas and cashflow logic unchanged.
- Deployed rebuilt frontend bundle only.

## Validation

| Check | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run test` | PASS |
| `npm run build` | PASS |
| Frontend deploy | PASS |
| Live index asset | `assets/index-pGJFnL7z.js` |
| Live dashboard asset | `assets/AdminDashboard-7iOwNpRY.js` |
| Live auth guard markers | PASS |

## Safety

- DB writes: none
- Schema changes: none
- Migrations: none
- Config or `.env` changes: none
- Settlement activation: none
- Financial formula changes: none
- `public_html/api/config.php` upload/overwrite: none

## Files Changed

- `src/lib/apiClient.ts`
- `src/pages/admin/AdminDashboard.tsx`
- `src/test/admin-dashboard-auth-guard.test.ts`
- `docs/HOTFIX_ADMIN_DASHBOARD_AUTH_GUARD.md`

## Decision

AUTH_GUARD_FIXED
