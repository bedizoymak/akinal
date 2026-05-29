# MySQL Migration Notes

This project is moving from Supabase/PostgreSQL to MySQL on shared hosting. The installer at `public_html/install-schema.php` converts the existing migration schema into `ak_`-prefixed MySQL tables for database `akinalin_wp282`.

## Converted Tables

- `public.admin_users` became `ak_admin_users`.
- `public.profiles` became `ak_profiles`, with `user_id` referencing `ak_admin_users.id` instead of `auth.users.id`.
- `public.user_roles` became `ak_user_roles`, with `user_id` referencing `ak_admin_users.id`.
- App/content tables became `ak_projects`, `ak_project_images`, `ak_media_library`, `ak_site_settings`, `ak_contact_requests`.
- CRM/finance tables became `ak_customers`, `ak_customer_projects`, `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_customer_notes`, `ak_documents`, `ak_notifications`, `ak_employees`, `ak_expense_cards`, `ak_financial_entries`.
- Cookie tracking became `ak_cookie_consents`.

## Type Mapping

- `uuid` -> `CHAR(36)`.
- `gen_random_uuid()` -> `UUID()` in MySQL, or generated in PHP before insert.
- `timestamptz` -> `DATETIME`.
- `jsonb` -> `JSON`.
- `boolean` -> `TINYINT(1)`.
- `text[]` -> `JSON`.
- PostgreSQL enum `app_role` -> `VARCHAR(50)`.

## Supabase Features That Need PHP Replacements

- Supabase Auth is removed. PHP must authenticate admins against `ak_admin_users`, verify `password_hash`, check `is_active`, and store the admin session securely.
- `auth.users` no longer exists. Any code that previously used Supabase user IDs should use `ak_admin_users.id`.
- RLS policies are not available in MySQL. PHP routes/controllers must enforce public versus admin-only access:
  - Public reads: published projects, project images for published projects, site settings.
  - Public writes: contact requests and cookie consents.
  - Admin-only management: projects, media, CRM, finance, notifications, documents, employees, expense cards, and settings.
- Supabase Storage buckets are removed. PHP must handle uploads and permissions for:
  - `project-images`
  - `customer-documents`
  - `payment-documents`
  - `expense-documents`
- Supabase Storage URLs should become local file paths or CDN URLs stored in the existing URL columns.
- Supabase Edge Functions must be replaced by PHP endpoints:
  - `submit-contact-request` should validate Turnstile, insert into `ak_contact_requests`, and optionally create a notification.
  - `sales-chatbot` needs a PHP endpoint or separate service if the feature remains active.
- Database triggers that created notifications were not recreated. PHP should insert into `ak_notifications` after creating contacts, customers, projects, or expenses.
- `updated_at` triggers were replaced with MySQL `ON UPDATE CURRENT_TIMESTAMP` columns where those columns exist.
- The `financial_entries_validate_card_reference` trigger was not recreated. PHP should validate that:
  - `card_type = customer` requires `customer_id`.
  - `card_type = employee` requires `employee_id`.
  - `card_type = expense` requires `expense_card_id`.
- `has_role()` and private schema functions are removed. PHP should check `ak_admin_users.role` and/or `ak_user_roles`.
- Turnstile protection for contact submissions must be enforced in PHP before inserts.

## Installer Notes

- Before running `public_html/install-schema.php`, replace `MYSQL_USERNAME_HERE` and `MYSQL_PASSWORD_HERE`.
- The installer is rerunnable and uses `CREATE TABLE IF NOT EXISTS`.
- It reports each table as `Created` or `Already existed`.
- Remove or protect the installer after a successful production run.
