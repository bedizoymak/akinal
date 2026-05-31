# Project publish toggle refetch fix report

Date: 2026-05-31

Issue:
- The publish/unpublish eye button remained showing the previous tooltip/action after toggling — UI was not guaranteed to reflect the server state.

What I inspected:
- Frontend `updateAdminProject` implementation in `src/lib/apiClient.ts` returns the updated `project` object from `/api/admin/projects.php`.
- Server endpoint `public_html/api/admin/projects.php` updates `is_published` and returns the full project row (`SELECT * FROM ak_projects WHERE id = :id`). The DB field is `is_published`.

Fix applied:
- `src/pages/admin/AdminProjects.tsx`:
  - Perform an optimistic UI change immediately for responsiveness.
  - Call `updateAdminProject` and capture the returned project.
  - After a successful API response, call `load()` to refetch the fresh projects list from the server so button tooltip/icon/action and badge derive from authoritative data.
  - On API error, revert the optimistic update and show a destructive toast.

Why this fixes it:
- The server is the source of truth for `is_published`. Refetching prevents race conditions and ensures the UI uses the exact server value for tooltip/icon/action.

Files changed:
- `src/pages/admin/AdminProjects.tsx` — refetch logic added (optimistic update retained).
- `docs/project-publish-toggle-refetch-fix-report.md` — this report.

Deployment:
- Run `npm run build` and deploy the updated `dist/` as usual.
