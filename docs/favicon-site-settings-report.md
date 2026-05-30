# Favicon Site Settings Report

## Result

Admin Site Settings now supports favicon management. Admin users can upload an ICO, PNG, SVG, or WEBP favicon, preview it, save the resulting URL in `ak_site_settings`, and the frontend updates the browser favicon from the configured value.

## Files Changed

- `src/pages/admin/AdminSettings.tsx`
- `src/hooks/useSiteSettings.ts`
- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`
- `public_html/api/admin/site-settings.php`
- `public_html/api/site-settings.php`
- `public_html/api/admin/upload-site-asset.php`
- `docs/favicon-site-settings-report.md`

## Endpoint Changes

- Added `POST /api/admin/upload-site-asset.php`
  - Requires admin session.
  - Uploads to `/uploads/site/`.
  - Accepts `.ico`, `.png`, `.svg`, and `.webp`.
  - Returns the uploaded URL/path.

- Updated `GET/PATCH /api/admin/site-settings.php`
  - Includes and saves `favicon_url`.
  - Adds `favicon_url` column to `ak_site_settings` if missing.

- Updated `GET /api/site-settings.php`
  - Public settings response includes `favicon_url` when available.
  - Falls back safely if schema migration is not possible.

## DB/Settings Fields Used

- `ak_site_settings.favicon_url`

Expected values:

- `/favicon.png`
- `/uploads/site/example.png`
- `/uploads/site/example.ico`
- `/uploads/site/example.svg`
- `/uploads/site/example.webp`
- Full `https://...` image URL, if needed.

## Frontend Behavior

- Admin Settings has a favicon field under Firma Bilgileri.
- Admin Settings shows a favicon preview.
- Uploading a favicon fills `favicon_url`; saving persists it.
- Runtime site settings apply the configured favicon to the document `<link rel="icon">`.
- If no configured favicon exists, `/favicon.png` remains the default.

## Validation Steps

1. Open `/admin/ayarlar`.
2. Upload `.ico`, `.png`, `.svg`, or `.webp` from the Favicon field.
3. Confirm preview changes.
4. Save settings.
5. Refresh the public site.
6. Confirm browser tab uses the configured favicon.
7. Confirm `/api/site-settings.php` returns `favicon_url`.
8. Confirm `/uploads/site/...` uploaded file opens publicly.

## Known Limitations

- Search engines may cache favicons for a while; Google/browser search results can lag after deployment.
- The initial static HTML still points to `/favicon.png`; the configured favicon is applied after the app loads and settings are fetched.
- Production hosting must allow PHP to create/write `public_html/uploads/site`.
- PHP lint was not available locally unless PHP is installed in the shell.
