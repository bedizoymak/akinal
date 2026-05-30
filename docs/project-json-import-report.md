# Project JSON Import Report

## Summary

Added a one-time PHP import utility for the exported Akinal projects JSON. The script imports real project rows into `ak_projects` and optional image rows into `ak_project_images` through the existing shared-hosting PHP/PDO configuration.

## Files Created

- `public_html/import-projects.php`
- `public_html/import-data/.gitkeep`
- `docs/project-json-import-report.md`

## Files Updated

- `.gitignore`

The `.gitignore` update ignores `public_html/import-data/*.json` so exported data files are not committed accidentally, while keeping the folder in the repo with `.gitkeep`.

## Import Behavior

- Requires `?confirm=IMPORT_AKINAL_PROJECTS`.
- Reads `public_html/import-data/akinal-projeler-export-2026-05-30-07-11.json`.
- Uses `public_html/api/db.php` for PDO connection and server-only DB credentials.
- Uses prepared statements.
- Inserts or updates projects by existing `id` or `slug`.
- Inserts or updates project images by image `id`.
- Skips projects whose title starts with `DEMO_DATA_`.
- Imports only real projects.
- Converts ISO timestamps such as `2026-05-04T08:58:01.707494+00:00` to MySQL `DATETIME`.
- Sets project `cover_image_url` to `NULL` and logs a warning when it starts with `/src/assets/`.
- Skips image rows whose `image_url` starts with `/src/assets/`, because those local development assets do not exist in production.

## Preserved Project Fields

- `id`
- `title`
- `slug`
- `short_description`
- `detailed_description`
- `project_type`
- `project_status`
- `location`
- `city`
- `district`
- `start_year`
- `delivery_year`
- `land_area`
- `construction_area`
- `apartment_count`
- `floor_count`
- `block_count`
- `is_featured`
- `is_published`
- `sort_order`
- `seo_title`
- `seo_description`
- `created_at`
- `updated_at`

## Deployment Steps

1. Upload `public_html/import-projects.php` to the server.
2. Upload the JSON export to:
   `public_html/import-data/akinal-projeler-export-2026-05-30-07-11.json`
3. Confirm `public_html/api/config.php` exists on the server and contains the working MySQL credentials.
4. Run:
   `https://akinalinsaat.com/import-projects.php?confirm=IMPORT_AKINAL_PROJECTS`
5. Review the report output:
   - total projects in JSON
   - imported projects count
   - skipped demo projects count
   - image rows imported count
   - warnings
6. Test:
   `https://akinalinsaat.com/api/projects.php`
7. Confirm real projects appear in the public frontend.
8. Delete `import-projects.php` and the uploaded import-data JSON immediately after success.

## Safety Notes

- Do not commit real credentials.
- Do not commit the JSON export unless intentionally reviewed and approved.
- Keep this as a temporary one-time utility only.
- Delete the importer and JSON from the server immediately after a successful import.
- If warnings mention `/src/assets/`, upload real production images later and update those project/image URLs through the admin flow or SQL.

## Validation

- PHP CLI validation was not run because `php` is not available in this workspace.
- Run this on the server or another PHP-enabled environment before importing:
  `php -l public_html/import-projects.php`
- The importer was not run against production from this workspace.
