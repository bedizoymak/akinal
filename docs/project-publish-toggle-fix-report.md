# Project publish toggle fix report

Date: 2026-05-31

Summary:
- Fixed the publish/unpublish toggle in the admin `Projeler` list so the button state and badge update immediately after user action.

Changes made:
- `src/pages/admin/AdminProjects.tsx`:
  - Toggle now updates local UI state immediately before calling the API.
  - Toast messaging now reflects the new state (`"Yayınlandı"` or `"Yayından kaldırıldı"`).
  - On API error, local state is reverted and a destructive toast shown.
  - Badge text changed from `"Taslak"` to `"Yayında Değil"` to match requested wording.

Behavioral notes:
- The UI optimistically updates; this preserves responsiveness and aligns button/tooltips immediately with action.
- On API failure the UI rolls back to the previous state and informs the user.

Files touched:
- [src/pages/admin/AdminProjects.tsx](src/pages/admin/AdminProjects.tsx#L1-L999)
- [docs/project-publish-toggle-fix-report.md](docs/project-publish-toggle-fix-report.md)

Deployment:
- Run `npm run build` and deploy the updated `dist/` as usual.
