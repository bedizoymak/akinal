# Supabase to MySQL Migration Tools

This folder contains local-only tooling for converting Supabase public schema JSON exports into MySQL-compatible SQL for the `ak_` tables.

Do not put production credentials here. Do not commit production exports.

## Folders

- `exports/`: local working folder for Supabase JSON exports. Ignored by Git.
- `output/`: generated SQL output. Ignored by Git.

## Expected JSON Inputs

The converter accepts either:

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

## Usage

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

Default behavior skips rows that appear to be demo data. To include demo rows:

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs --input migration-tools/exports --output migration-tools/output/import.sql --include-demo
```

## Output

The converter writes:

- `SET NAMES utf8mb4;`
- `INSERT ... ON DUPLICATE KEY UPDATE` statements
- warnings as SQL comments at the top of the output

Review generated SQL before importing into MySQL.
