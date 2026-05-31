# Project list publish toggle final fix report

Date: 2026-05-31

Issue:
- The admin project list publish toggle could unpublish a project, but the button and badge did not reliably update to the published state.

Root cause:
- The list and edit page both use `/api/admin/projects.php` and the same `is_published` payload field.
- Backend PDO fetch returns `is_published` as a numeric/string value (`0`/`1`), causing frontend truthiness checks to behave incorrectly in the list view.

Fix applied:
- `src/lib/apiClient.ts`
  - Added `normalizeProject` and `normalizeProjects` helpers.
  - Normalized `is_published` and `is_featured` to boolean values for `getAdminProjects`, `getAdminProject`, `createAdminProject`, and `updateAdminProject`.
- This preserves the same API endpoint and field names as the working edit page logic.
- `src/pages/admin/AdminProjects.tsx` continues to refetch the project list from the server after a successful toggle, so the list button tooltip/action and badge use fresh server state.

Behavior after fix:
- Published projects show "Yayından Kaldır".
- Unpublished projects show "Yayınla".
- Badges switch correctly between "Yayında" and "Yayında Değil".
- Toast messages reflect the action taken.

Files changed:
- `src/lib/apiClient.ts`
- `src/pages/admin/AdminProjects.tsx`
- `docs/project-list-publish-toggle-final-fix-report.md`

Deployment:
- Run `npm run build` and deploy as usual.
