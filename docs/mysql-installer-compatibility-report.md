# MySQL Installer Compatibility Report

## 1. Executive Summary

The MySQL installer was hardened for shared-hosting MySQL/MariaDB environments. The patch removes newer or inconsistently supported SQL features from `public_html/install-schema.php`, moves UUID generation into PHP, adds an explicit execution confirmation guard, checks for the `pdo_mysql` extension before connecting, and improves final installer reporting.

No UI, TypeScript, Supabase frontend integration, package files, or production data were changed.

## 2. Files Changed

- `public_html/install-schema.php`
- `docs/mysql-migration-notes.md`
- `docs/mysql-installer-compatibility-report.md`

## 3. Exact Compatibility Fixes Applied

- Removed every `DEFAULT (UUID())` column default from `CHAR(36)` primary keys.
- Added a PHP `uuidv4()` helper using `random_bytes()`.
- Updated `seedSiteSettings()` to generate its ID in PHP.
- Updated `seedSiteSettings()` to use a prepared statement with bound parameters.
- Removed `UUID()` from the seed SQL.
- Replaced the generated `email_lower` column with a normal `VARCHAR(255) NOT NULL` column.
- Kept the unique index on `email_lower`.
- Added an installer code comment requiring PHP/API code to write `strtolower(email)` into `email_lower`.
- Replaced `DATE NOT NULL DEFAULT (CURRENT_DATE)` with `DATE NOT NULL` for date columns.
- Removed `CHECK` constraints from `ak_financial_entries`.
- Removed the `CHECK` constraint from `ak_cookie_consents`.
- Replaced `KEY idx_notifications_created_at (created_at DESC)` with `KEY idx_notifications_created_at (created_at)`.
- Preserved foreign key constraints and table creation order.
- Added the `?confirm=INSTALL_AKINAL_SCHEMA` execution guard.
- Added a `pdo_mysql` extension guard before connection.
- Kept placeholder credentials: `MYSQL_USERNAME_HERE` and `MYSQL_PASSWORD_HERE`.
- Kept `CREATE TABLE IF NOT EXISTS` and created/already-existing table reporting.
- Added final output for connected database, created table count, already-existing table count, expected table count, site settings seed status, and installer deletion reminder.

## 4. Why These Were Risky on Shared Hosting

`DEFAULT (UUID())`:
Some shared-hosting MySQL/MariaDB versions do not allow expression defaults or function defaults in the same way as modern MySQL. Generating UUIDs in PHP is more portable and avoids version-specific DDL failures.

Generated columns:
`GENERATED ALWAYS AS ... STORED` can fail on older MariaDB/MySQL versions, restricted hosting configurations, or hosts with limited feature support. A normal `email_lower` column is simpler and portable, with PHP responsible for keeping it synchronized.

`DATE DEFAULT (CURRENT_DATE)`:
Expression defaults for `DATE` columns have inconsistent support across MySQL and MariaDB versions. Requiring PHP to provide `payment_date`, `expense_date`, and `entry_date` avoids installer failures.

`CHECK` constraints:
Older MySQL versions parse but ignore `CHECK`; some MariaDB/MySQL combinations enforce them differently. Moving these validations to PHP gives predictable behavior across hosts.

Descending indexes:
`created_at DESC` in index definitions is not portable across older MySQL/MariaDB versions. A normal ascending index on `created_at` is widely supported and still useful for filtering and sorting.

## 5. Final Expected Table List and Count

Expected table count: 20

- `ak_admin_users`
- `ak_profiles`
- `ak_user_roles`
- `ak_projects`
- `ak_project_images`
- `ak_media_library`
- `ak_site_settings`
- `ak_contact_requests`
- `ak_customers`
- `ak_customer_projects`
- `ak_payment_plans`
- `ak_payments`
- `ak_expenses`
- `ak_customer_notes`
- `ak_documents`
- `ak_notifications`
- `ak_employees`
- `ak_expense_cards`
- `ak_financial_entries`
- `ak_cookie_consents`

## 6. What Was Intentionally Not Changed

- No visual design or UI files were changed.
- No TypeScript or React files were changed.
- Supabase frontend calls were not removed.
- Supabase packages or integration files were not removed.
- No real database credentials were added.
- The installer was not run against production.
- Data migration from Supabase was not implemented.
- PHP API endpoints were not implemented.
- Admin login/session behavior was not implemented.

## 7. Remaining Supabase-to-PHP Migration Work

Auth/session replacement:
Implement PHP admin authentication using `ak_admin_users`, `password_hash`, `password_verify`, `is_active`, server-side sessions, and route guards.

Public API endpoints:
Replace public Supabase reads/writes with PHP endpoints for published projects, project images, site settings, contact requests, and cookie consents.

Admin API endpoints:
Create authenticated PHP CRUD endpoints for projects, media, CRM, finance, notifications, documents, employees, expense cards, and settings.

Storage/upload replacement:
Replace Supabase Storage buckets with PHP upload handling for project images, customer documents, payment documents, and expense documents.

Turnstile/contact request replacement:
Move Turnstile verification into the PHP contact submission endpoint before inserting into `ak_contact_requests`.

Notification trigger replacement:
The Supabase notification triggers were not recreated. PHP should insert into `ak_notifications` after creating contacts, customers, projects, or expenses.

Financial validation replacement:
PHP must enforce former database validations for `ak_financial_entries`, including card type, required related IDs, currency, group, direction, status, and positive amount.

## 8. Security Checklist Before Production

- Do not commit credentials.
- Upload `install-schema.php` only temporarily.
- Run the installer only with `?confirm=INSTALL_AKINAL_SCHEMA`.
- Delete `install-schema.php` immediately after success.
- Protect upload folders from executable scripts and direct unsafe access.
- Validate all admin routes server-side.
- Use `password_hash()` and `password_verify()`.
- Use secure PHP sessions with HTTPS-only cookies in production.

## 9. Bediz Verification Steps

1. Pull latest `main`.
2. Open `public_html/install-schema.php`.
3. Confirm `MYSQL_USERNAME_HERE` and `MYSQL_PASSWORD_HERE` placeholders still exist.
4. Upload `public_html/install-schema.php` to hosting `public_html`.
5. Replace placeholders only on the server copy.
6. Run `https://akinalinsaat.com/install-schema.php?confirm=INSTALL_AKINAL_SCHEMA`.
7. Confirm all 20 `ak_` tables are created or reported as already existing.
8. Delete `install-schema.php` from FTP immediately.

## 10. Known Limitations

- This does not migrate data from Supabase.
- This does not remove Supabase frontend calls.
- This does not implement PHP APIs yet.
- This does not implement admin login yet.

## Validation

- PHP CLI validation was not run because `php` is not available in this workspace.
- Run `php -l public_html/install-schema.php` on the hosting or another PHP-enabled environment before production use.
- TypeScript/build validation was not required because this task did not touch TypeScript files.
