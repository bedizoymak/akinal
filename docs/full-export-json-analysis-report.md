# Full Export JSON Analysis Report

## Summary

The real Supabase export was analyzed locally with the hardened converter. The export and generated SQL/report files are intentionally ignored by Git and must not be committed.

Supabase is not removed yet because admin/auth/write APIs, storage/uploads, contact form, cookie consent, finance/admin CRUD, and related replacement flows are not fully migrated and verified.

## Actual Export Shape Detected

Detected shape:

`array[0].full_export.tables`

This matches the real export structure:

```json
[
  {
    "full_export": {
      "exported_at": "...",
      "source": "supabase_full_public_export",
      "tables": {}
    }
  }
]
```

## Recommended Current Import Mode

`public-launch` is now the preferred mode for the first controlled production import. It imports only the public website data needed by the current PHP API/frontend cutover:

- `site_settings` -> `ak_site_settings`
- `projects` -> `ak_projects`
- `project_images` -> `ak_project_images`
- `media_library` -> `ak_media_library`

All other exported data remains intentionally unimported for now, including contact requests, cookie consents, customers, finance data, notifications, profiles, roles, and admin users. The 20 `ak_` tables stay in MySQL; most simply remain empty until the matching PHP admin/API work is implemented.

## Actual Table List and Public-Launch Counts

| Source table | Target table | Source rows | Expected imported rows | Skipped DEMO_DATA | Skipped not public | Skipped orphan FK | Warnings |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `admin_users` | `ak_admin_users` | 0 | 0 | 0 | 0 | 0 | 0 |
| `projects` | `ak_projects` | 23 | 3 | 20 | 0 | 0 | 3 |
| `project_images` | `ak_project_images` | 0 | 0 | 0 | 0 | 0 | 0 |
| `media_library` | `ak_media_library` | 0 | 0 | 0 | 0 | 0 | 0 |
| `site_settings` | `ak_site_settings` | 1 | 1 | 0 | 0 | 0 | 0 |
| `contact_requests` | `ak_contact_requests` | 2 | 0 | 0 | 0 | 0 | 0 |
| `customers` | `ak_customers` | 21 | 0 | 0 | 0 | 0 | 0 |
| `customer_projects` | `ak_customer_projects` | 61 | 0 | 0 | 0 | 0 | 0 |
| `payment_plans` | `ak_payment_plans` | 400 | 0 | 0 | 0 | 0 | 0 |
| `payments` | `ak_payments` | 164 | 0 | 0 | 0 | 0 | 0 |
| `expenses` | `ak_expenses` | 120 | 0 | 0 | 0 | 0 | 0 |
| `customer_notes` | `ak_customer_notes` | 40 | 0 | 0 | 0 | 0 | 0 |
| `documents` | `ak_documents` | 0 | 0 | 0 | 0 | 0 | 0 |
| `notifications` | `ak_notifications` | 5560 | 0 | 0 | 0 | 0 | 0 |
| `employees` | `ak_employees` | 20 | 0 | 0 | 0 | 0 | 0 |
| `expense_cards` | `ak_expense_cards` | 21 | 0 | 0 | 0 | 0 | 0 |
| `financial_entries` | `ak_financial_entries` | 761 | 0 | 0 | 0 | 0 | 0 |
| `cookie_consents` | `ak_cookie_consents` | 8 | 0 | 0 | 0 | 0 | 0 |
| `profiles` | `ak_profiles` | 1 | 0 | 0 | 0 | 0 | 0 |
| `user_roles` | `ak_user_roles` | 1 | 0 | 0 | 0 | 0 | 0 |

Public-launch generated:

- `migration-tools/output/import-public-launch.sql`
- `migration-tools/output/import-public-launch-report.json`
- `migration-tools/output/import-public-launch-summary.md`

These files are ignored by Git and must not be committed.

## Broader Production-Clean Counts

`production-clean` remains available for later backend phases, but it is not the recommended first import because it includes CRM/contact/finance-like rows before the replacement PHP admin workflows are ready.

| Source table | Target table | Source rows | Expected imported rows | Skipped DEMO_DATA | Skipped orphan FK | Warnings |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `admin_users` | `ak_admin_users` | 0 | 0 | 0 | 0 | 0 |
| `projects` | `ak_projects` | 23 | 3 | 20 | 0 | 3 |
| `project_images` | `ak_project_images` | 0 | 0 | 0 | 0 | 0 |
| `media_library` | `ak_media_library` | 0 | 0 | 0 | 0 | 0 |
| `site_settings` | `ak_site_settings` | 1 | 1 | 0 | 0 | 0 |
| `contact_requests` | `ak_contact_requests` | 2 | 2 | 0 | 0 | 0 |
| `customers` | `ak_customers` | 21 | 1 | 20 | 0 | 0 |
| `customer_projects` | `ak_customer_projects` | 61 | 1 | 0 | 60 | 60 |
| `payment_plans` | `ak_payment_plans` | 400 | 0 | 400 | 0 | 0 |
| `payments` | `ak_payments` | 164 | 1 | 160 | 3 | 3 |
| `expenses` | `ak_expenses` | 120 | 0 | 120 | 0 | 0 |
| `customer_notes` | `ak_customer_notes` | 40 | 0 | 0 | 40 | 40 |
| `documents` | `ak_documents` | 0 | 0 | 0 | 0 | 0 |
| `notifications` | `ak_notifications` | 5560 | 8 | 5552 | 0 | 0 |
| `employees` | `ak_employees` | 20 | 0 | 20 | 0 | 0 |
| `expense_cards` | `ak_expense_cards` | 21 | 1 | 20 | 0 | 0 |
| `financial_entries` | `ak_financial_entries` | 761 | 0 | 760 | 1 | 1 |
| `cookie_consents` | `ak_cookie_consents` | 8 | 8 | 0 | 0 | 0 |
| `profiles` | `ak_profiles` | 1 | 0 | 0 | 0 | 0 |
| `user_roles` | `ak_user_roles` | 1 | 0 | 0 | 0 | 0 |

## Intentionally Not Imported

In `production-clean` mode, these tables are not imported:

- `admin_users`
- `profiles`
- `user_roles`

Reason: PHP admin accounts must be created locally with fresh password hashes, and Supabase Auth data must not be copied.

## DEMO_DATA Filtering

Production-clean mode skips rows when important text fields contain `DEMO_DATA`. The converter checks fields such as title, slug, descriptions, names, email, phone, notes, message, SEO fields, file/image/document URLs, name, and category.

This removes demo projects, demo customers, demo finance rows, demo notifications, demo employees, and demo expense cards from the production import.

## Orphan FK Filtering

Production-clean mode first decides which parent rows are included, then filters child rows whose parent references would violate MySQL foreign keys.

Examples:

- `customer_projects` rows are imported only when both customer and project are included.
- `payments` rows are imported only when customer, project, and payment plan references are included or nullable.
- `customer_notes` rows are imported only when the customer is included.
- `financial_entries` rows are imported only when project/customer/employee/expense-card references are included or nullable.

This prevents generated SQL from creating foreign-key failures.

## Storage URL Warnings

The converter handles URL fields as follows:

- `/src/assets/...` is converted to `NULL` and logged as a warning because those paths do not exist in production.
- `/uploads/...` is preserved.
- Supabase Storage public URLs are preserved for now but logged as warnings: storage files must be downloaded and URLs rewritten later.
- Empty values become `NULL`.

No storage files were downloaded in this task.

## Dry Run Command

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs --input migration-tools/exports/full_export.json --mode production-clean --dry-run
```

## Generate SQL Command

```bash
node migration-tools/convert-supabase-json-to-mysql.mjs --input migration-tools/exports/full_export.json --mode production-clean --output migration-tools/output/import-production-clean.sql
```

This creates ignored local files:

- `migration-tools/output/import-production-clean.sql`
- `migration-tools/output/import-production-clean-report.json`
- `migration-tools/output/import-production-clean-summary.md`

## Inspect Generated SQL Safely

Open the generated SQL locally and check:

- SQL starts with `SET NAMES utf8mb4;`.
- Table comments show expected source/import row counts.
- `ak_admin_users`, `ak_profiles`, and `ak_user_roles` are absent in production-clean SQL.
- No unwanted demo records are present.
- `/src/assets/` values are not present.
- Supabase Storage URLs are reviewed and scheduled for rewrite.

Do not commit generated SQL because it may contain real customer/contact/finance data.

## Later Import Options

Option 1: phpMyAdmin

1. Open phpMyAdmin for `akinalin_wp282`.
2. Import `migration-tools/output/import-production-clean.sql`.
3. Review row counts.
4. Test `/api/projects.php`, `/api/site-settings.php`, and admin data after admin APIs exist.

Option 2: one-time PHP importer

1. Upload a reviewed SQL/importer utility temporarily.
2. Require a strong confirmation token.
3. Run once.
4. Delete the importer and generated SQL immediately.

## Safety Warning

Never commit:

- `full_export.json`
- `migration-tools/exports/full_export.json`
- `migration-tools/output/import-production-clean.sql`
- `migration-tools/output/import-production-clean-report.json`
- `migration-tools/output/import-production-clean-summary.md`
- Any generated file containing real customer/contact/finance data.

Generated SQL must be manually reviewed before any production import.
