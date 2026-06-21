# Phase Table Usage Audit

Date: 2026-06-18

Scope: read-only source audit for the production table list supplied by the requester. No database tables were deleted, altered, or migrated.

## Executive Summary

Most production tables are active runtime dependencies. The highest-risk tables are `ak_financial_entries`, `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_expense_cards`, `ak_notifications`, `ak_customers`, `ak_customer_projects`, `ak_projects`, and `ak_project_images`; these feed admin CRUD screens, dashboards, reports, public pages, or notification flows.

Likely cleanup candidates are limited. `ak_profiles` and `ak_user_roles` appear only in migration/import/mapping documentation or legacy Supabase-era material, not active PHP or React runtime code. `ak_media_library` appears in installer/schema and migration assets but not in active frontend consumption; the media page currently reads `ak_project_images` and `ak_projects`. `ak_documents` is read on customer detail but lacks an active document CRUD module in the current PHP/React surface. All four should be investigated with production row counts before removal or archival.

Production row counts are not known from this read-only source audit. Run the follow-up SQL at the end against production or a recent production snapshot.

## Active Runtime Entry Points

- Public project listing/detail:
  - `public_html/api/projects.php` reads `ak_projects`.
  - `public_html/api/project-detail.php` reads `ak_projects` and `ak_project_images`.
  - Frontend consumers: `src/pages/site/Home.tsx`, `src/pages/site/Projects.tsx`, `src/pages/site/ProjectDetail.tsx`, through `src/lib/apiClient.ts`.
- Public contact/cookie/settings:
  - `public_html/api/contact-request.php` writes `ak_contact_requests` and `ak_notifications`.
  - `public_html/api/cookie-consent.php` writes `ak_cookie_consents`.
  - `public_html/api/site-settings.php` reads `ak_site_settings`.
  - Frontend consumers: `src/pages/site/Contact.tsx`, `src/components/site/CookieConsent.tsx`, `src/hooks/useSiteSettings.ts`.
- Admin auth:
  - `public_html/api/admin/login.php` and `public_html/api/auth.php` read `ak_admin_users`.
  - `public_html/create-admin-user.php` writes/updates `ak_admin_users`.
  - Frontend consumers: `src/pages/admin/AdminAuth.tsx`, `src/hooks/useAuth.tsx`, `src/components/admin/AdminLayout.tsx`.
- Admin dashboard:
  - `public_html/api/admin/dashboard.php` reads `ak_projects`, `ak_contact_requests`, `ak_notifications`, `ak_customers`, `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_financial_entries`, `ak_expense_cards`, and `ak_employees`.
  - Frontend consumer: `src/pages/admin/AdminDashboard.tsx` via `getAdminDashboard()` in `src/lib/apiClient.ts`.
- Admin finance/reporting:
  - `public_html/api/admin/finance-summary.php` reads `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_financial_entries`, `ak_customers`, `ak_projects`.
  - `public_html/api/admin/reports.php` reads `ak_customers`, `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_financial_entries`, `ak_projects`, `ak_customer_projects`, `ak_contact_requests`.
  - `public_html/api/admin/financial-statement.php` reads/writes `ak_financial_entries` and reads related owner tables.
  - Frontend consumers: `src/pages/admin/AdminFinance.tsx`, `src/pages/admin/AdminReports.tsx`, `src/components/admin/finance/FinancialStatementPage.tsx`, `src/pages/admin/AdminCustomerFinance.tsx`, `src/pages/admin/AdminProjectFinance.tsx`, `src/pages/admin/AdminEmployeeFinance.tsx`, `src/pages/admin/AdminExpenseCardFinance.tsx`.

## Table Usage Matrix

| table_name | row_count_from_production_if_known | used_in_backend | used_in_frontend | used_in_dashboard | write_paths | read_paths | relation_to_other_tables | risk_if_deleted | recommendation |
|---|---:|---|---|---|---|---|---|---|---|
| `ak_admin_users` | Unknown | yes | yes | no | yes | yes | Admin identity for PHP session auth; referenced by push subscriptions through admin id. | high | keep |
| `ak_contact_requests` | Unknown | yes | yes | yes | yes | yes | Public contact submissions; admin contact list; dashboard counts; reports aggregate. | high | keep, optionally archive old closed requests later |
| `ak_cookie_consents` | Unknown | yes | yes | no | yes | no active admin read | Public consent log. | medium | keep or archive by retention policy |
| `ak_customer_notes` | Unknown | yes | yes | no | yes | yes | Child records of `ak_customers`; shown on customer detail. | medium | keep |
| `ak_customer_projects` | Unknown | yes | yes | reports only, indirect dashboard context | yes | yes | Many-to-many customer/project links; used by customers, reports, reconciliation docs. | high | keep |
| `ak_customers` | Unknown | yes | yes | yes | yes | yes | Parent for plans, payments, expenses, notes, documents, customer-project links, finance entries. | high | keep |
| `ak_documents` | Unknown | yes | yes | no | no active PHP write found | yes | Customer detail document lookup by `customer_id`. | medium | investigate; keep until row count and UI need are verified |
| `ak_employees` | Unknown | yes | yes | yes | yes | yes | Personnel records; owner table for financial entries and payable plans. | high | keep |
| `ak_expense_cards` | Unknown | yes | yes | yes | yes | yes | Supplier/expense-card records; owner table for financial entries and payable plans. | high | keep |
| `ak_expenses` | Unknown | yes | yes | yes | yes | yes | Legacy/direct expense table; dashboard/reports/finance summary still combine it with canonical entries. | high | keep; do not remove until canonical cutover is complete |
| `ak_financial_entries` | Unknown | yes | yes | yes | yes | yes | Canonical finance ledger linked to projects, customers, employees, expense cards, payment plans/settlements in newer logic. | high | keep |
| `ak_media_library` | Unknown | install/migration only in active scan | no active consumer found | no | no active runtime write found | no active runtime read found | Intended media inventory; current media page uses project images instead. | low/medium | investigate; archive/remove later only after production row check |
| `ak_notifications` | Unknown | yes | yes | yes | yes | yes | Notification center, header bell, contact notification, payment reminders. | high | keep, clean old read/demo rows by retention policy |
| `ak_payment_plans` | Unknown | yes | yes | yes | yes | yes | Receivables/payables plan table; linked to customers/projects/employees/expense cards and payments. | high | keep |
| `ak_payments` | Unknown | yes | yes | yes | yes | yes | Collection records; linked to customers/projects/payment plans. | high | keep |
| `ak_profiles` | Unknown | migration/import/docs only | no active consumer found | no | no active runtime write found | no active runtime read found | Supabase-era profile table; not part of current PHP auth. | low | investigate; likely archive/remove later |
| `ak_project_images` | Unknown | yes | yes | no admin dashboard aggregate, yes public project detail/media | yes | yes | Child images of `ak_projects`; public gallery/admin media/project edit. | high | keep |
| `ak_projects` | Unknown | yes | yes | yes | yes | yes | Parent for project images, customer links, plans, payments, expenses, financial entries. | high | keep |
| `ak_push_subscriptions` | Unknown | yes | yes | no | yes | yes | Browser push subscriptions tied to admin id/session. | medium | keep if push notifications remain enabled; archive expired subscriptions |
| `ak_site_settings` | Unknown | yes | yes | no | yes | yes | Public site settings and admin settings. | high | keep |
| `ak_user_roles` | Unknown | migration/import/docs only | no active consumer found | no | no active runtime write found | no active runtime read found | Supabase-era roles table; current PHP auth reads role from `ak_admin_users`. | low | investigate; likely archive/remove later |

## Per-Table Notes

### `ak_admin_users`

- Backend files:
  - `public_html/api/admin/login.php` authenticates admin login by email/password hash.
  - `public_html/api/auth.php` reloads session user by id and role.
  - `public_html/create-admin-user.php` creates or updates admin users.
  - `public_html/install-schema.php` defines the table.
- Frontend files:
  - `src/pages/admin/AdminAuth.tsx` handles login.
  - `src/hooks/useAuth.tsx` manages admin session state.
  - `src/components/admin/AdminLayout.tsx` guards admin routes.
- Screens/forms: `/admin/giris`; guarded admin layout.
- Recommendation: keep. Removing breaks all admin access.

### `ak_contact_requests`

- Backend files:
  - `public_html/api/contact-request.php` inserts public form requests and creates a notification.
  - `public_html/api/admin/contact-requests.php` lists, updates status, and deletes requests.
  - `public_html/api/admin/dashboard.php` counts total/new requests.
  - `public_html/api/admin/reports.php` includes contact requests in report payload/aggregates.
- Frontend files:
  - `src/pages/site/Contact.tsx` submits requests.
  - `src/pages/admin/AdminContacts.tsx` manages requests.
  - `src/pages/admin/AdminDashboard.tsx` shows request counts.
  - `src/pages/admin/AdminReports.tsx` consumes report payload.
- Dashboard/cards/charts: admin summary cards `total_contact_requests` and `new_contact_requests`.
- Recommendation: keep; archive old closed requests only after retention decision.

### `ak_cookie_consents`

- Backend files:
  - `public_html/api/cookie-consent.php` inserts consent events.
  - `public_html/install-schema.php` defines the table.
- Frontend files:
  - `src/components/site/CookieConsent.tsx` posts consent.
- Screens/forms: public cookie consent component.
- Recommendation: keep unless a privacy retention policy says old rows should be purged/archive-exported.

### `ak_customer_notes`

- Backend files:
  - `public_html/api/admin/customers.php` reads notes for customer detail, inserts notes, deletes notes.
  - `public_html/install-schema.php` defines the table.
- Frontend files:
  - `src/pages/admin/AdminCustomerDetail.tsx` displays and manages notes through API client functions.
  - `src/lib/apiClient.ts` exposes `createAdminCustomerNote()` and `deleteAdminCustomerNote()`.
- Screens/forms: customer detail notes area.
- Recommendation: keep.

### `ak_customer_projects`

- Backend files:
  - `public_html/api/admin/customers.php` reads/writes project links.
  - `public_html/api/admin/reports.php` returns links for report calculations.
  - `docs/sql/phase_3a_reconciliation_inventory.sql` uses it for relationship checks.
- Frontend files:
  - `src/pages/admin/AdminCustomers.tsx`, `src/pages/admin/AdminCustomerEdit.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminReports.tsx`.
- Screens/forms: customer create/edit project assignment; customer detail linked projects; report project/customer matching.
- Recommendation: keep.

### `ak_customers`

- Backend files:
  - `public_html/api/admin/customers.php` full CRUD and detail payload.
  - `public_html/api/admin/dashboard.php` counts customers and builds customer financial cards.
  - `public_html/api/admin/payments.php`, `payment-plans.php`, `expenses.php`, `financial-statement.php`, `finance-summary.php`, `reports.php` read it for lookups/reporting.
- Frontend files:
  - `src/pages/admin/AdminCustomers.tsx`, `AdminCustomerEdit.tsx`, `AdminCustomerDetail.tsx`, `AdminCollections.tsx`, `AdminExpenses.tsx`, `AdminReports.tsx`, finance statement pages.
- Dashboard/cards/charts: total customer count, risky customers, collection priority, customer financial cards, overdue/remaining receivable cards.
- Recommendation: keep.

### `ak_documents`

- Backend files:
  - `public_html/api/admin/customers.php` reads customer documents in detail payload.
  - `public_html/install-schema.php` defines the table.
- Frontend files:
  - `src/pages/admin/AdminCustomerDetail.tsx` can display document data from the customer detail response.
- Write paths: no active PHP insert/update/delete endpoint found in current scan.
- Recommendation: investigate. Keep for now because customer detail reads it; if production row count is zero and no document UI is planned, archive/remove later.

### `ak_employees`

- Backend files:
  - `public_html/api/admin/employees.php` CRUD.
  - `public_html/api/admin/financial-statement.php` reads employees and writes related `ak_financial_entries`.
  - `public_html/api/admin/dashboard.php` builds personnel cards and personnel drilldowns.
  - `public_html/api/admin/payment-plans.php` supports employee payable plans.
- Frontend files:
  - `src/pages/admin/AdminEmployees.tsx`, `src/pages/admin/AdminEmployeeFinance.tsx`, `src/components/admin/finance/FinancialStatementPage.tsx`, `src/pages/admin/AdminDashboard.tsx`.
- Dashboard/cards/charts: personnel cost total, personnel cost centers, upcoming personnel payments.
- Recommendation: keep.

### `ak_expense_cards`

- Backend files:
  - `public_html/api/admin/expense-cards.php` CRUD.
  - `public_html/api/admin/financial-statement.php` reads expense cards and writes related `ak_financial_entries`.
  - `public_html/api/admin/dashboard.php` builds supplier cards, payment priority, category intelligence.
  - `public_html/api/admin/payment-plans.php` supports supplier/expense-card payable plans.
- Frontend files:
  - `src/pages/admin/AdminExpenseCards.tsx`, `src/pages/admin/AdminExpenseCardFinance.tsx`, `src/components/admin/finance/FinancialStatementPage.tsx`, `src/pages/admin/AdminDashboard.tsx`.
- Dashboard/cards/charts: supplier liabilities, highest supplier debt, top spending categories.
- Recommendation: keep.

### `ak_expenses`

- Backend files:
  - `public_html/api/admin/expenses.php` CRUD.
  - `public_html/api/admin/dashboard.php` includes legacy expenses in recent movements, monthly financials, current cash, project cards, and expense intelligence.
  - `public_html/api/admin/finance-summary.php` and `reports.php` read it.
  - `public_html/api/admin/financial-statement.php` merges legacy expense rows into statements.
- Frontend files:
  - `src/pages/admin/AdminExpenses.tsx`, `AdminFinance.tsx`, `AdminReports.tsx`, `AdminDashboard.tsx`, finance statement pages.
- Dashboard/cards/charts: total expenses, monthly expenses, recent movements, project expense/profitability, top categories.
- Recommendation: keep; this is still an active legacy/direct expense source.

### `ak_financial_entries`

- Backend files:
  - `public_html/api/admin/financial-statement.php` CRUD for finance entries.
  - `public_html/api/admin/canonical-transaction-service.php` inserts/reverses canonical ledger entries.
  - `public_html/api/admin/dashboard.php`, `backend-canonical-read-model.php`, `canonical-read-flags.php`, `finance-summary.php`, `reports.php` read it heavily.
- Frontend files:
  - `src/components/admin/finance/FinancialStatementPage.tsx`, `src/pages/admin/AdminFinance.tsx`, `AdminReports.tsx`, `AdminDashboard.tsx`, `AdminCustomerFinance.tsx`, `AdminProjectFinance.tsx`, `AdminEmployeeFinance.tsx`, `AdminExpenseCardFinance.tsx`.
- Dashboard/cards/charts: canonical realized/planned income/expense, recent movements, monthly financials, unified financial cards, official/unofficial split, net cash forecast.
- Recommendation: keep. This is the canonical ledger direction; do not clean without reconciliation/cutover.

### `ak_media_library`

- Backend files:
  - Present in `public_html/install-schema.php`, migration tooling, and import outputs.
  - No active runtime PHP endpoint read/write found in this scan.
  - `public_html/api/admin/media.php` uses `ak_project_images` and `ak_projects`, not `ak_media_library`.
- Frontend files: no active consumer found.
- Recommendation: investigate. If production rows are only demo/import residue, archive/remove later.

### `ak_notifications`

- Backend files:
  - `public_html/api/contact-request.php` inserts contact notifications.
  - `public_html/api/admin/notifications.php` lists, marks read, deletes, and generates payment reminders.
  - `public_html/api/admin/dashboard.php` counts unread notifications.
  - push helper endpoints use notification/push infrastructure.
- Frontend files:
  - `src/hooks/useNotifications.ts`, `src/components/admin/NotificationBell.tsx`, `src/pages/admin/AdminNotifications.tsx`, `src/pages/admin/AdminDashboard.tsx`.
- Dashboard/cards/charts: unread notification count.
- Recommendation: keep; clean old read/demo rows by retention policy only.

### `ak_payment_plans`

- Backend files:
  - `public_html/api/admin/payment-plans.php` CRUD and status recalculation.
  - `public_html/api/admin/payments.php` reads plans for collection allocation/status.
  - `public_html/api/admin/dashboard.php`, `backend-canonical-read-model.php`, `canonical-read-flags.php`, `finance-summary.php`, `reports.php`, `notifications.php` read it.
  - `public_html/api/admin/canonical-transaction-service.php` reads/locks plans for canonical operations.
- Frontend files:
  - `src/pages/admin/AdminCustomerDetail.tsx`, `AdminCollections.tsx`, `AdminFinance.tsx`, `AdminReports.tsx`, `AdminDashboard.tsx`.
- Dashboard/cards/charts: planned income, expected payments, overdue collections/count, upcoming plans, receivable/payable obligations, customer/project cards.
- Recommendation: keep.

### `ak_payments`

- Backend files:
  - `public_html/api/admin/payments.php` CRUD.
  - `public_html/api/admin/dashboard.php`, `backend-canonical-read-model.php`, `canonical-read-flags.php`, `finance-summary.php`, `reports.php`, `customers.php`, `payment-plans.php`, `notifications.php` read it.
- Frontend files:
  - `src/pages/admin/AdminCollections.tsx`, `AdminCustomers.tsx`, `AdminCustomerDetail.tsx`, `AdminFinance.tsx`, `AdminReports.tsx`, `AdminDashboard.tsx`.
- Dashboard/cards/charts: total income/collections, month income, recent movements, customer payment performance, planned-vs-actual allocation.
- Recommendation: keep.

### `ak_profiles`

- Backend files: no active PHP runtime read/write found. Present in `migration-tools/supabase-table-map.json`, import scripts/output, installer/schema/docs.
- Frontend files: no active consumer found.
- Recommendation: investigate. Likely Supabase legacy table; archive/remove later only after production row and dependency check.

### `ak_project_images`

- Backend files:
  - `public_html/api/project-detail.php` reads published project images.
  - `public_html/api/admin/project-images.php` CRUD.
  - `public_html/api/admin/media.php` lists/deletes media based on project images.
  - `public_html/import-projects.php` imports project image rows.
- Frontend files:
  - `src/pages/site/ProjectDetail.tsx`, `src/pages/admin/AdminProjectEdit.tsx`, `src/pages/admin/AdminMedia.tsx`, `src/features/admin/projects/projectImportExport.ts`.
- Screens/forms: public project gallery; admin project image manager; admin media library.
- Recommendation: keep.

### `ak_projects`

- Backend files:
  - `public_html/api/projects.php`, `project-detail.php`, `public_html/api/admin/projects.php`, `dashboard.php`, `reports.php`, `finance-summary.php`, `customers.php`, `payments.php`, `expenses.php`, `financial-statement.php`.
- Frontend files:
  - Public: `src/pages/site/Home.tsx`, `Projects.tsx`, `ProjectDetail.tsx`.
  - Admin: `AdminProjects.tsx`, `AdminProjectEdit.tsx`, `AdminMedia.tsx`, `AdminCustomers.tsx`, `AdminCollections.tsx`, `AdminExpenses.tsx`, `AdminFinance.tsx`, `AdminReports.tsx`, `AdminDashboard.tsx`, finance statement pages.
- Dashboard/cards/charts: total/active/published/draft projects, active projects list, project financial cards, profitability and cashflow risk.
- Recommendation: keep.

### `ak_push_subscriptions`

- Backend files:
  - `public_html/api/admin/push-subscribe.php`, `push-unsubscribe.php`, `push-utils.php`, `push-debug.php`, `send-push-test.php`.
- Frontend files:
  - `src/components/admin/AdminPushNotificationsPanel.tsx` and notification-related UI.
- Screens/forms: admin push notification subscription/test controls.
- Recommendation: keep if browser push remains supported; archive expired endpoints later.

### `ak_site_settings`

- Backend files:
  - `public_html/api/site-settings.php` public read.
  - `public_html/api/admin/site-settings.php` admin read/update.
- Frontend files:
  - `src/hooks/useSiteSettings.ts`, `src/pages/admin/AdminSettings.tsx`, public layout/site pages using settings.
- Screens/forms: `/admin/ayarlar`, public header/footer/meta settings.
- Recommendation: keep.

### `ak_user_roles`

- Backend files: no active PHP runtime read/write found. Present in migration/import/schema/docs.
- Frontend files: no active consumer found.
- Recommendation: investigate. Current PHP auth reads role from `ak_admin_users`, so this appears removable later after row/dependency verification.

## Dashboard Formula Dependencies

### Total income / collections

- Admin dashboard endpoint: `public_html/api/admin/dashboard.php`.
- Legacy summary path: `canonical_read_legacy_dashboard_summary()` in `public_html/api/admin/canonical-read-flags.php`.
  - Reads `ak_payments` for realized collection totals.
  - Reads `ak_expenses` for realized expense totals.
  - Reads `ak_payment_plans` and `ak_payments` for overdue/upcoming remaining amounts.
- Canonical summary path: `canonical_read_dashboard_summary()` in `public_html/api/admin/backend-canonical-read-model.php`.
  - Reads `ak_financial_entries` where `direction = 'Gelir'`, `status = 'Gerçekleşti'`, and `currency_tag` is normalized through canonical helpers.
  - Also adds legacy `ak_payments` totals where canonical ledger is not complete.
- Frontend display: `src/pages/admin/AdminDashboard.tsx` summary cards and management sections; `src/pages/admin/AdminFinance.tsx` finance summary.

### Expenses

- Direct expense CRUD/read path: `public_html/api/admin/expenses.php`.
- Dashboard legacy/direct path: `ak_expenses` is read by `dashboard.php`, `finance-summary.php`, `reports.php`, and `financial-statement.php`.
- Canonical path: `ak_financial_entries` with `direction = 'Gider'` and posted/realized statuses is used by `backend-canonical-read-model.php` and dashboard financial cards.
- Frontend display: `AdminDashboard.tsx`, `AdminFinance.tsx`, `AdminReports.tsx`, `AdminExpenses.tsx`.

### Planned vs actual

- Planned receivables/payables:
  - `ak_payment_plans.amount`, `paid_amount`, `due_date`, `status`, `account_type`, and owner ids.
  - `ak_financial_entries` with planned status in newer payable/forecast paths.
- Actual collections/payments:
  - `ak_payments.amount`, `payment_plan_id`, `customer_id`, `account_type`.
  - `ak_financial_entries` with `status = 'Gerçekleşti'`.
- Main calculation helpers:
  - `canonical_read_customer_plan_buckets()` in canonical read code derives paid/remaining/status buckets.
  - `fetch_receivable_obligations()` and `fetch_payable_obligations()` in `dashboard.php` build forecast obligations.
  - `fetch_net_cash_forecast()` in `dashboard.php` combines current cash, expected collections, and upcoming payments.

### Overdue payments

- Source tables:
  - Customer receivables: `ak_payment_plans` plus `ak_payments`.
  - Supplier/personnel payables: `ak_payment_plans` for employee/expense-card owners plus planned `ak_financial_entries`.
- Formula:
  - Remaining amount = plan amount minus linked/unlinked allocated payments, with manual `paid_amount` fallback.
  - Overdue if remaining > 0 and `due_date` is before the current date.
- Main functions:
  - `canonical_read_customer_plan_buckets()` in `backend-canonical-read-model.php` / `canonical-read-flags.php`.
  - `fetch_payable_state()`, `fetch_upcoming_action_payments()`, `fetch_payment_priority_actions()` in `dashboard.php`.
  - `notifications.php` uses payment plan due dates and remaining amounts to generate reminders.

### Official vs unofficial amounts

- Source columns:
  - Legacy: `ak_payment_plans.account_type`, `ak_payments.account_type`.
  - Canonical: `ak_financial_entries.group_tag` where `Gayri Resmi` maps to `gayri_resmi`; otherwise treated as `resmi`.
- Dashboard functions:
  - `fetch_customer_financial_cards()` splits official/unofficial contract, collected, and remaining receivables.
  - `fetch_project_financial_cards()` splits official/unofficial revenue, expenses, profit, and cash exposure.
  - `fetch_supplier_financial_cards()` and `fetch_personnel_financial_cards()` split official/unofficial paid and remaining payable.
  - `fetch_net_cash_forecast()` and management decision helpers surface official/unofficial cash risk actions.

## Legacy/Demo/Dead Candidates

| table | evidence | recommendation |
|---|---|---|
| `ak_profiles` | Only migration/import/schema/docs references found; no active PHP endpoint or React consumer. | Investigate, then archive/remove later. |
| `ak_user_roles` | Only migration/import/schema/docs references found; current auth role comes from `ak_admin_users`. | Investigate, then archive/remove later. |
| `ak_media_library` | Schema/import references exist, but active media endpoint reads `ak_project_images`/`ak_projects`. | Investigate, archive/remove later if production rows are unused. |
| `ak_documents` | Active read in customer detail, but no active write module found. | Keep for now; decide after row count and UI/product decision. |
| Old read notifications/contact rows/cookie consents | Active tables may contain historical/demo rows. | Keep tables; clean/archive rows only under retention rules. |

## Follow-Up SQL Needed From Production

Run read-only on production or a recent backup:

```sql
SELECT 'ak_admin_users' AS table_name, COUNT(*) AS row_count FROM ak_admin_users
UNION ALL SELECT 'ak_contact_requests', COUNT(*) FROM ak_contact_requests
UNION ALL SELECT 'ak_cookie_consents', COUNT(*) FROM ak_cookie_consents
UNION ALL SELECT 'ak_customer_notes', COUNT(*) FROM ak_customer_notes
UNION ALL SELECT 'ak_customer_projects', COUNT(*) FROM ak_customer_projects
UNION ALL SELECT 'ak_customers', COUNT(*) FROM ak_customers
UNION ALL SELECT 'ak_documents', COUNT(*) FROM ak_documents
UNION ALL SELECT 'ak_employees', COUNT(*) FROM ak_employees
UNION ALL SELECT 'ak_expense_cards', COUNT(*) FROM ak_expense_cards
UNION ALL SELECT 'ak_expenses', COUNT(*) FROM ak_expenses
UNION ALL SELECT 'ak_financial_entries', COUNT(*) FROM ak_financial_entries
UNION ALL SELECT 'ak_media_library', COUNT(*) FROM ak_media_library
UNION ALL SELECT 'ak_notifications', COUNT(*) FROM ak_notifications
UNION ALL SELECT 'ak_payment_plans', COUNT(*) FROM ak_payment_plans
UNION ALL SELECT 'ak_payments', COUNT(*) FROM ak_payments
UNION ALL SELECT 'ak_profiles', COUNT(*) FROM ak_profiles
UNION ALL SELECT 'ak_project_images', COUNT(*) FROM ak_project_images
UNION ALL SELECT 'ak_projects', COUNT(*) FROM ak_projects
UNION ALL SELECT 'ak_push_subscriptions', COUNT(*) FROM ak_push_subscriptions
UNION ALL SELECT 'ak_site_settings', COUNT(*) FROM ak_site_settings
UNION ALL SELECT 'ak_user_roles', COUNT(*) FROM ak_user_roles;
```

Relationship/orphan checks:

```sql
SELECT 'customer_projects_missing_customer' AS check_name, COUNT(*) AS row_count
FROM ak_customer_projects cp LEFT JOIN ak_customers c ON c.id = cp.customer_id
WHERE c.id IS NULL
UNION ALL
SELECT 'customer_projects_missing_project', COUNT(*)
FROM ak_customer_projects cp LEFT JOIN ak_projects p ON p.id = cp.project_id
WHERE p.id IS NULL
UNION ALL
SELECT 'payment_plans_missing_customer', COUNT(*)
FROM ak_payment_plans pp LEFT JOIN ak_customers c ON c.id = pp.customer_id
WHERE pp.customer_id IS NOT NULL AND c.id IS NULL
UNION ALL
SELECT 'payments_missing_customer', COUNT(*)
FROM ak_payments p LEFT JOIN ak_customers c ON c.id = p.customer_id
WHERE p.customer_id IS NOT NULL AND c.id IS NULL
UNION ALL
SELECT 'payments_missing_plan', COUNT(*)
FROM ak_payments p LEFT JOIN ak_payment_plans pp ON pp.id = p.payment_plan_id
WHERE p.payment_plan_id IS NOT NULL AND pp.id IS NULL
UNION ALL
SELECT 'expenses_missing_project', COUNT(*)
FROM ak_expenses e LEFT JOIN ak_projects p ON p.id = e.project_id
WHERE e.project_id IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'financial_entries_missing_project', COUNT(*)
FROM ak_financial_entries fe LEFT JOIN ak_projects p ON p.id = fe.project_id
WHERE fe.project_id IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'financial_entries_missing_customer', COUNT(*)
FROM ak_financial_entries fe LEFT JOIN ak_customers c ON c.id = fe.customer_id
WHERE fe.customer_id IS NOT NULL AND c.id IS NULL
UNION ALL
SELECT 'financial_entries_missing_employee', COUNT(*)
FROM ak_financial_entries fe LEFT JOIN ak_employees e ON e.id = fe.employee_id
WHERE fe.employee_id IS NOT NULL AND e.id IS NULL
UNION ALL
SELECT 'financial_entries_missing_expense_card', COUNT(*)
FROM ak_financial_entries fe LEFT JOIN ak_expense_cards ec ON ec.id = fe.expense_card_id
WHERE fe.expense_card_id IS NOT NULL AND ec.id IS NULL;
```

Candidate cleanup validation:

```sql
SELECT id, created_at FROM ak_profiles ORDER BY created_at DESC LIMIT 20;
SELECT id, created_at FROM ak_user_roles ORDER BY created_at DESC LIMIT 20;
SELECT * FROM ak_media_library ORDER BY created_at DESC LIMIT 20;
SELECT id, customer_id, created_at FROM ak_documents ORDER BY created_at DESC LIMIT 20;
```

If any of those queries fail because a column does not exist, inspect schema with `SHOW COLUMNS FROM table_name;` before making cleanup decisions.

## Validation

- Codebase table search completed with `rg` across source, PHP, scripts, migration tools, and SQL docs.
- Runtime references were separated from migration/import/demo references.
- No schema/data modifications were made.
- `npm run build` was run after the previous frontend change and passed. This documentation-only audit does not affect typecheck/build output.

