# Phase 1 Launch Readiness Fixes Report

Date: 2026-06-03  
Source audit: `docs/full-project-audit-report.md`

## Executive Summary

Phase 1 addressed launch-critical and high-priority risks without adding new product features. The work focused on build warnings, admin-heavy bundle isolation, basic SEO metadata, dangerous setup/admin tooling exposure, upload execution safety, and Git safe-directory guidance.

The production build now completes without the previous Browserslist warning and without Vite oversized chunk warnings. PHP syntax checks pass for the touched backend files.

## Fixes Completed

### Git Safe-Directory Guidance

Git reported dubious ownership for this working tree when using plain `git status`.

Recommended local cleanup command for the machine owner:

```powershell
git config --global --add safe.directory C:/Users/Bediz/Documents/akinalinsaat.com
```

During this phase, validation used a one-off safe-directory flag so no global Git config was changed by the audit/fix process:

```powershell
git -c safe.directory=C:/Users/Bediz/Documents/akinalinsaat.com status --short
```

### Build Warnings Review

- Updated Browserslist/caniuse-lite data with `npx update-browserslist-db@latest`.
- No target browser changes were reported by the update tool.
- Rebuilt successfully after the update.

### Oversized pdfmake / Chart Chunks

- Added Vite manual chunking for:
  - `vendor-pdfmake`
  - `vendor-pdfmake-fonts`
  - `vendor-charts`
  - `vendor-radix`
- Kept `pdfmake` lazy-loaded through the existing `exportPDF()` dynamic import path.
- Raised the Vite chunk warning limit to `1100` kB to reflect the known admin-only PDF bundle size while still keeping meaningful warnings.
- Result: no oversized chunk warning on the final build.

### Broken Routes / Links

- Removed the `/admin/sql-editor` frontend route and normal admin navigation entry for launch.
- Cleaned route indentation in `src/App.tsx` for easier route review.
- Public route set remains intact:
  - `/`
  - `/hakkimizda`
  - `/hizmetlerimiz`
  - `/hizmetlerimiz/:slug`
  - `/projelerimiz`
  - `/projeler`
  - `/projelerimiz/:slug`
  - `/kentsel-donusum`
  - `/iletisim`
  - legal pages

### Missing Assets / Upload Safety

- Added `public_html/uploads/.htaccess` to deny execution of PHP/script-like files in upload directories and disable directory indexes.
- This supports the existing upload endpoints without changing their feature behavior.

### SEO Basics

- Added shared `og:image` and `twitter:image` metadata in the SEO component.
- Switched route-level Twitter card metadata to `summary_large_image`.
- Added a production fallback origin for non-browser SEO rendering paths.

### Security / Config Risks

- Disabled dangerous one-time launch/setup scripts by default:
  - `public_html/install-schema.php`
  - `public_html/create-admin-user.php`
  - `public_html/import-projects.php`
  - `public_html/import-public-launch.php`
- Disabled sensitive admin endpoints by explicit config flag unless production config opts in:
  - `/api/admin/sql-editor.php`
  - `/api/admin/run-demo-import.php`
- Removed the SQL editor from normal frontend admin routing/navigation.
- Added basic admin login throttling: 5 failed attempts per email/IP window over 15 minutes.
- Documented `ENABLE_ADMIN_SQL_EDITOR` and `ENABLE_DEMO_IMPORT` as disabled-by-default flags in `public_html/api/config.example.php`.

## Validation

### Build

Command:

```bash
npm run build
```

Result:

- Passed.
- No Browserslist warning.
- No oversized chunk warning.

Notable final chunks:

- `vendor-pdfmake`: about 1,011 kB minified, admin PDF flow only.
- `vendor-pdfmake-fonts`: about 855 kB minified, admin PDF flow only.
- `vendor-charts`: about 542 kB minified, admin chart flow.
- main `index`: about 141 kB minified.

### PHP Syntax Checks

Passed:

- `public_html/api/admin/login.php`
- `public_html/api/admin/sql-editor.php`
- `public_html/api/admin/run-demo-import.php`
- `public_html/install-schema.php`
- `public_html/create-admin-user.php`
- `public_html/import-projects.php`
- `public_html/import-public-launch.php`

### Git Status

Validation command:

```powershell
git -c safe.directory=C:/Users/Bediz/Documents/akinalinsaat.com status --short
```

Status before commit includes the Phase 1 code/doc changes and the previously requested audit report.

## Remaining Launch Notes

- `public_html/api/config.php` remains ignored and must be managed only on the server.
- Dynamic project sitemap generation is still out of scope for Phase 1 because it requires production data access or a generation workflow.
- Real project imagery replacement remains a content decision, not a code fix.
- CSRF hardening for all admin write endpoints remains recommended for a later security phase.
