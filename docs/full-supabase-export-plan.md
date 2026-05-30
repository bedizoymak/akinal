# Full Supabase to MySQL Export Plan

## Executive Summary

The safest path for `akinalinsaat.com` is a controlled table-by-table export from Supabase into JSON or CSV, followed by conversion into MySQL-compatible imports for the existing `ak_` tables. A raw PostgreSQL dump should not be imported directly into MySQL because PostgreSQL DDL, data types, enum syntax, JSON syntax, schema names, RLS policies, functions, triggers, storage metadata, and auth schema objects are not MySQL-compatible.

## Recommended Export Methods

### A. Supabase CLI DB Dump

Command shape:

```bash
supabase db dump --data-only --schema public > supabase-public-data.sql
```

Pros:
- Captures all public table data in one operation.
- Good archival snapshot.
- Useful for auditing source rows and row counts.

Cons:
- Output is PostgreSQL SQL, not MySQL SQL.
- Includes PostgreSQL-specific quoting, casts, COPY format, sequences, and schema-qualified names.
- Requires conversion before MySQL import.
- Easy to accidentally include data that should be excluded, such as demo rows.

### B. CSV Export Per Table

Use Supabase dashboard table export or `psql \copy` for each table.

Pros:
- Simple, transparent, and easy to inspect.
- Works well for flat tables.
- Spreadsheet-friendly for manual cleanup.

Cons:
- Relationships and import order must be managed manually.
- JSON and array fields need careful encoding.
- Type conversion still required for booleans and timestamps.
- File naming and column consistency are easy to get wrong.

### C. JSON Export Through Existing/Admin Tooling

Use existing app/admin export logic or scripts to produce JSON grouped by table.

Pros:
- Best fit for a controlled converter/import pipeline.
- Preserves UUID IDs and nested project/image data naturally.
- Easier to validate schema names and skip `DEMO_DATA_` rows.
- Easier to rewrite URL fields before import.

Cons:
- Requires export tooling discipline.
- Large JSON files should not be committed.
- Must verify all needed tables are included.

## Why Direct PostgreSQL Dump Cannot Be Imported Into MySQL

PostgreSQL and MySQL use different dialects and runtime features. The Supabase schema includes PostgreSQL-specific constructs such as `uuid`, `timestamptz`, `jsonb`, enums, schemas like `public` and `auth`, RLS policies, functions, triggers, and Supabase Storage policies. MySQL cannot interpret these directly. Even data-only dumps can contain PostgreSQL-specific `COPY`, casts, escaped literals, schema qualification, and boolean/timestamp formatting that need conversion.

## Tables To Migrate

Migrate these public/application tables into their `ak_` MySQL targets:

- `projects` -> `ak_projects`
- `project_images` -> `ak_project_images`
- `media_library` -> `ak_media_library`
- `site_settings` -> `ak_site_settings`
- `contact_requests` -> `ak_contact_requests`
- `customers` -> `ak_customers`
- `customer_projects` -> `ak_customer_projects`
- `payment_plans` -> `ak_payment_plans`
- `payments` -> `ak_payments`
- `expenses` -> `ak_expenses`
- `customer_notes` -> `ak_customer_notes`
- `documents` -> `ak_documents`
- `notifications` -> `ak_notifications`
- `employees` -> `ak_employees`
- `expense_cards` -> `ak_expense_cards`
- `financial_entries` -> `ak_financial_entries`
- `cookie_consents` -> `ak_cookie_consents`
- `profiles` -> `ak_profiles` only if needed for legacy display data
- `user_roles` -> `ak_user_roles` only if needed after local admin users are created

## Tables Not To Migrate

Do not migrate:

- `auth.users`
- Supabase auth/session/identity tables
- Supabase Storage metadata tables such as `storage.objects`
- RLS policies
- PostgreSQL functions
- PostgreSQL triggers
- Supabase migration metadata
- Demo/test tables or generated temporary data

## Handling DEMO_DATA Rows

Rows containing values that start with `DEMO_DATA_` should be skipped by default. This includes titles, names, notes, descriptions, and other text fields. The converter in `migration-tools/convert-supabase-json-to-mysql.mjs` skips rows with any string value starting with `DEMO_DATA_` unless `--include-demo` is passed.

## Handling Supabase Auth Users

Do not copy Supabase Auth passwords or auth schema records. Create fresh PHP admin users in `ak_admin_users` using `password_hash()`. If legacy profile display data is useful, migrate `profiles` only after mapping `user_id` to the new `ak_admin_users.id` values. See `docs/admin-user-migration-note.md`.

## Handling Supabase Storage Buckets

Storage files must be exported separately from database rows.

Source buckets:

- `project-images`
- `customer-documents`
- `payment-documents`
- `expense-documents`

Target folders:

- `public_html/uploads/projects/`
- `public_html/uploads/customers/`
- `public_html/uploads/payments/`
- `public_html/uploads/expenses/`

After files are copied, DB URL fields must be rewritten from Supabase public/signed URLs to local paths such as `/uploads/projects/file.jpg`.

Fields likely requiring rewrite:

- `ak_projects.cover_image_url`
- `ak_project_images.image_url`
- `ak_project_images.thumbnail_url`
- `ak_media_library.image_url`
- `ak_media_library.thumbnail_url`
- `ak_payments.document_url`
- `ak_expenses.document_url`
- `ak_documents.file_url`
- `ak_financial_entries.document_url`

## Storage Export Plan

1. Download each Supabase Storage bucket using the Supabase dashboard, CLI, or a small script using the service role key locally.
2. Preserve subfolder/file names where possible.
3. Upload files to the matching `public_html/uploads/...` folder.
4. Generate a URL rewrite map from old Supabase URL to new `/uploads/...` path.
5. Apply URL rewrites in JSON before conversion or in generated SQL before import.
6. Verify uploaded files are readable and non-executable where appropriate.

## Final Recommended Path

1. Export public schema tables to JSON, grouped by table.
2. Export Supabase Storage buckets separately.
3. Rewrite storage URLs to `/uploads/...` paths.
4. Run:

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs \
  --input migration-tools/exports/full-export.json \
  --output migration-tools/output/import.sql
```

5. Review warnings and generated SQL.
6. Import into a staging MySQL database first.
7. Verify public endpoints and admin row counts.
8. Import into production during a short maintenance window.
9. Create fresh PHP admin users.
10. Keep Supabase available until all public writes, admin CRUD, auth, storage, and chatbot flows are migrated.

## Safety Rules

- Do not commit real exports.
- Do not commit generated SQL containing production data.
- Do not commit Supabase service role keys.
- Do not run imports directly against production without reviewing output.
- Do not touch `public_html/api/config.php`.
- Do not modify production credentials.
