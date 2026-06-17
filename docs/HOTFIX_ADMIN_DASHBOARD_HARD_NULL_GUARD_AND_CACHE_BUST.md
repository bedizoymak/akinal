# Hotfix Admin Dashboard Hard Null Guard And Cache Bust

## Problem

Production still white-screened at `/admin` with:

- `api/admin/me.php 401`
- `Cannot read properties of undefined (reading 'summary')`
- stale loaded asset: `AdminDashboard-7iOwNpRY.js`

## Implemented

- Added top-level dashboard render gates:
  - loading renders only the loading state
  - `401` / `403` dashboard API errors redirect to `/admin/giris` and return `null`
  - missing/undefined dashboard payload renders a controlled error state
- Changed dashboard state so the main dashboard cannot render until normalized dashboard data exists.
- Added complete default dashboard sections for all nested render paths.
- Removed the remaining direct render-time `data.summary` access.
- Kept all financial formulas and verified cashflow logic unchanged.
- Added hard-null/auth regression tests.
- Added a cache-bust marker so Vite emitted a new dashboard chunk.
- Deployed rebuilt frontend `dist` only.

## Validation

| Check | Result |
| --- | --- |
| `php -l public_html/api/admin/dashboard.php` | PASS |
| `npx tsc --noEmit` | PASS |
| `npm run test` | PASS, 26 tests |
| `npm run build` | PASS |
| Old dashboard asset | `AdminDashboard-7iOwNpRY.js` |
| New local dashboard asset | `AdminDashboard-DHhG5q0_.js` |
| Frontend deploy | PASS |
| Live index asset | `assets/index-Om8gZDfO.js` |
| Live dashboard asset | `assets/AdminDashboard-DHhG5q0_.js` |
| Live hard guard markers | PASS |
| Stale dashboard asset referenced by live index | NO |

## Browser Cache Note

The in-app browser was unavailable in this session, so I could not clear that browser cache directly. Server-side verification confirms production now serves the new dashboard asset hash. A user browser still holding `AdminDashboard-7iOwNpRY.js` should hard refresh or clear site cache.

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
- `src/test/admin-dashboard-hard-null-guard.test.tsx`
- `docs/HOTFIX_ADMIN_DASHBOARD_HARD_NULL_GUARD_AND_CACHE_BUST.md`

## Decision

WHITE_SCREEN_FIXED
