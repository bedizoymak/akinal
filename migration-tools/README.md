# Supabase to MySQL Migration Tools

This folder contains local-only tooling for converting Supabase public schema JSON exports into MySQL-compatible SQL for the `ak_` tables.

Do not put production credentials here. Do not commit production exports.

## Folders

- `exports/`: local working folder for Supabase JSON exports. Ignored by Git.
- `output/`: generated SQL output. Ignored by Git.

## Exact Commands For The Real Export

Copy the export into the ignored local tooling folder:

```powershell
copy full_export.json migration-tools\exports\full_export.json
```

Run the recommended public website launch dry run:

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs --input migration-tools/exports/full_export.json --mode public-launch --dry-run
```

Generate public website launch SQL and reports:

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs --input migration-tools/exports/full_export.json --mode public-launch --output migration-tools/output/import-public-launch.sql
```

This mode imports only:

- `site_settings` -> `ak_site_settings`
- `projects` -> `ak_projects`
- `project_images` -> `ak_project_images`
- `media_library` -> `ak_media_library`

It skips `DEMO_DATA`, unpublished projects, project images without an included project, and media rows that point at excluded projects. It does not import contact requests, cookie consents, admin users, profiles, CRM, finance, documents, employees, or notifications.

Run a broader production-clean dry run only after the public launch is stable:

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs --input migration-tools/exports/full_export.json --mode production-clean --dry-run
```

Generate broader production-clean SQL and reports only when CRM/admin API migration is ready:

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs --input migration-tools/exports/full_export.json --mode production-clean --output migration-tools/output/import-production-clean.sql
```

Optional full demo export for local testing only:

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs --input migration-tools/exports/full_export.json --mode full-with-demo --output migration-tools/output/import-full-with-demo.sql
```

Do not commit files from `migration-tools/exports/` or `migration-tools/output/` except `.gitkeep`.

## Expected JSON Inputs

The converter accepts either:

- the real full export shape:

```json
[
  {
    "full_export": {
      "exported_at": "...",
      "source": "supabase_full_public_export",
      "tables": {
        "projects": [],
        "customers": []
      }
    }
  }
]
```

- an object containing `full_export.tables`.
- an object containing `tables`.

- one JSON object containing table arrays:

```json
{
  "projects": [],
  "project_images": []
}
```

- one JSON object with a `data` wrapper:

```json
{
  "schema": "akinal-full-supabase-export-v1",
  "data": {
    "projects": []
  }
}
```

- a folder containing per-table files named like `projects.json`, `customers.json`, etc.

## Older Generic Usage

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs \
  --input migration-tools/exports/full-export.json \
  --output migration-tools/output/import.sql
```

or:

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs \
  --input migration-tools/exports \
  --output migration-tools/output/import.sql
```

Default mode is `public-launch`, which imports only public website launch data. `production-clean` skips demo data and filters orphan child rows for the broader schema. Use `--mode full-with-demo` only for local testing.

## Output

The converter writes:

- `SET NAMES utf8mb4;`
- `INSERT ... ON DUPLICATE KEY UPDATE` statements
- source/import row-count comments per table
- `*-report.json`
- `*-summary.md`

Review generated SQL before importing into MySQL.
