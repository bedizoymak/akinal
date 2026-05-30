# Admin Migration Priority Plan

Source: `docs/current-architecture-audit.md`  
Audit date: 2026-05-30  
Scope: admin routes in the current repository only.

## Summary

The admin panel is partially migrated. Admin authentication is on PHP sessions and MySQL, but almost every post-login admin feature still reads or writes Supabase. If Supabase is paused, those pages are effectively broken even though the PHP session gate itself works.

The most urgent issue is data ownership drift: public pages now read MySQL for projects and site settings, public contact requests write MySQL, but the matching admin pages still use Supabase. Those admin pages either fail when Supabase is paused or, if Supabase is resumed, operate on the wrong source of truth.

## 1. Broken Because Supabase Is Paused

These pages directly depend on Supabase database, Supabase Storage, or a shared Supabase-backed hook/component. They should be treated as broken while Supabase is paused.

| Admin page | Route | Current data source | Target data source | Required PHP endpoints | Complexity |
| --- | --- | --- | --- | --- | --- |
| Dashboard | `/admin` | Supabase tables: `projects`, `customers`, `payment_plans`, `payments`, `expenses`, `financial_entries`, `contact_requests`; notification bell also uses `notifications` | MySQL via PHP | `GET /api/admin/dashboard.php`, `GET/PATCH/DELETE /api/admin/notifications.php` | High |
| Projects | `/admin/projeler` | Supabase `projects` | MySQL `ak_projects` | `GET/POST/PATCH/DELETE /api/admin/projects.php`, optional `PATCH /api/admin/projects-order.php` | Medium |
| New/Edit Project | `/admin/projeler/yeni`, `/admin/projeler/:id` | Supabase `projects`, `project_images`; Supabase Storage `project-images` | MySQL `ak_projects`, `ak_project_images`; PHP upload storage | `GET/POST/PATCH /api/admin/projects.php`, `GET/POST/PATCH/DELETE /api/admin/project-images.php`, `POST /api/admin/uploads/project-images.php` | High |
| Project Finance | `/admin/projeler/:id/finans` | Shared Supabase `FinancialStatementPage`: `projects`, `customers`, `employees`, `expense_cards`, `financial_entries` | MySQL finance tables | `GET /api/admin/projects/:id/statement.php` or `GET /api/admin/financial-statements.php?kind=project&id=...`, `POST/PATCH/DELETE /api/admin/financial-entries.php` | High |
| Media | `/admin/medya` | Supabase `project_images` with joined `projects` | MySQL `ak_project_images`, `ak_projects`, optional `ak_media_library` | `GET/DELETE /api/admin/media.php`, `GET/POST/PATCH/DELETE /api/admin/project-images.php` | Medium |
| Contacts | `/admin/talepler` | Supabase `contact_requests` | MySQL `ak_contact_requests` | `GET/PATCH/DELETE /api/admin/contact-requests.php` | Low |
| Settings | `/admin/ayarlar` | Supabase `site_settings` | MySQL `ak_site_settings` | `GET/PATCH /api/admin/site-settings.php` | Low |
| Customers | `/admin/musteriler` | Supabase `customers`, `payment_plans`, `payments`, `customer_projects`, `projects` | MySQL `ak_customers`, `ak_payment_plans`, `ak_payments`, `ak_customer_projects`, `ak_projects` | `GET/DELETE /api/admin/customers.php`, `GET /api/admin/customer-summaries.php`, `GET /api/admin/projects.php` | Medium |
| New/Edit Customer | `/admin/musteriler/yeni`, `/admin/musteriler/:id/duzenle` | Supabase `customers`, `customer_projects`, `projects` | MySQL `ak_customers`, `ak_customer_projects`, `ak_projects` | `GET/POST/PATCH /api/admin/customers.php`, `PUT /api/admin/customer-projects.php`, `GET /api/admin/projects.php` | Medium |
| Customer Detail | `/admin/musteriler/:id` | Supabase `customers`, `customer_projects`, `projects`, `payment_plans`, `payments`, `expenses`, `customer_notes`, `documents` | MySQL matching `ak_` tables | `GET /api/admin/customers/:id.php`, `GET/POST/DELETE /api/admin/customer-notes.php`, `GET /api/admin/customer-documents.php` | High |
| Customer Finance | `/admin/musteriler/:id/finans` | Shared Supabase `FinancialStatementPage`: `customers`, `projects`, `employees`, `expense_cards`, `financial_entries` | MySQL finance tables | `GET /api/admin/financial-statements.php?kind=customer&id=...`, `POST/PATCH/DELETE /api/admin/financial-entries.php` | High |
| Employees | `/admin/personeller` | Supabase via `financeSupabase`: `employees` | MySQL `ak_employees` | `GET/POST/PATCH/DELETE /api/admin/employees.php` | Low |
| Employee Finance | `/admin/personeller/:id/finans` | Shared Supabase `FinancialStatementPage`: `employees`, `financial_entries`, lookup tables | MySQL finance tables | `GET /api/admin/financial-statements.php?kind=employee&id=...`, `POST/PATCH/DELETE /api/admin/financial-entries.php` | High |
| Payment Plans | `/admin/odeme-planlari` | Supabase `payment_plans`, `customers`, `projects`, `payments` | MySQL `ak_payment_plans`, `ak_customers`, `ak_projects`, `ak_payments` | `GET/POST/PATCH/DELETE /api/admin/payment-plans.php`, `GET /api/admin/customers.php`, `GET /api/admin/projects.php` | Medium |
| Collections | `/admin/tahsilatlar` | Supabase `payments`, `customers`, `projects`, `payment_plans`; Supabase Storage `payment-documents` | MySQL `ak_payments`, related tables; PHP document upload | `GET/POST/PATCH/DELETE /api/admin/payments.php`, `POST /api/admin/uploads/payment-documents.php`, `GET /api/admin/payment-lookups.php` | High |
| Expenses | `/admin/giderler` | Supabase `expenses`, `customers`, `projects`; Supabase Storage `expense-documents` | MySQL `ak_expenses`, `ak_customers`, `ak_projects`; PHP document upload | `GET/POST/PATCH/DELETE /api/admin/expenses.php`, `POST /api/admin/uploads/expense-documents.php`, `GET /api/admin/expense-lookups.php` | High |
| Expense Cards | `/admin/gider-kartlari` | Supabase via `financeSupabase`: `expense_cards` | MySQL `ak_expense_cards` | `GET/POST/PATCH/DELETE /api/admin/expense-cards.php` | Low |
| Expense Card Finance | `/admin/gider-kartlari/:id/finans` | Shared Supabase `FinancialStatementPage`: `expense_cards`, `financial_entries`, lookup tables | MySQL finance tables | `GET /api/admin/financial-statements.php?kind=expense&id=...`, `POST/PATCH/DELETE /api/admin/financial-entries.php` | High |
| Finance Dashboard | `/admin/finans-dashboard` | Supabase `payment_plans`, `payments`, `expenses`, `financial_entries`, `customers`, `projects` | MySQL finance tables | `GET /api/admin/finance-summary.php`, `GET /api/admin/financial-entries.php` | Medium |
| Notifications | `/admin/bildirimler` | Supabase hook `useNotifications`: `notifications`, `payment_plans` | MySQL `ak_notifications`, `ak_payment_plans` | `GET/PATCH/DELETE /api/admin/notifications.php`, `POST /api/admin/notifications/generate-payment-reminders.php` | Medium |
| Reports | `/admin/raporlar` | Supabase hook `useFinanceAll`: `customers`, `payment_plans`, `payments`, `expenses`, `financial_entries`, `projects`, `customer_projects` | MySQL finance/reporting tables | `GET /api/admin/reports.php`, or `GET /api/admin/finance-all.php` | Medium |

## 2. Working But Reading Wrong Source

No admin route is safely in this category while Supabase is paused, because the pages that read the wrong source also depend on Supabase and therefore break.

If Supabase is temporarily resumed, these pages become the highest-priority "working but wrong source" pages because their public counterpart already uses MySQL:

| Admin page | Route | Current data source | Target data source | Required PHP endpoints | Complexity |
| --- | --- | --- | --- | --- | --- |
| Projects | `/admin/projeler` | Supabase `projects` | MySQL `ak_projects` | `GET/POST/PATCH/DELETE /api/admin/projects.php` | Medium |
| New/Edit Project | `/admin/projeler/yeni`, `/admin/projeler/:id` | Supabase `projects`, `project_images`, `project-images` storage | MySQL `ak_projects`, `ak_project_images`, PHP upload storage | `GET/POST/PATCH /api/admin/projects.php`, `GET/POST/PATCH/DELETE /api/admin/project-images.php`, `POST /api/admin/uploads/project-images.php` | High |
| Media | `/admin/medya` | Supabase `project_images` | MySQL `ak_project_images`, optional `ak_media_library` | `GET/DELETE /api/admin/media.php` | Medium |
| Contacts | `/admin/talepler` | Supabase `contact_requests` | MySQL `ak_contact_requests` | `GET/PATCH/DELETE /api/admin/contact-requests.php` | Low |
| Settings | `/admin/ayarlar` | Supabase `site_settings` | MySQL `ak_site_settings` | `GET/PATCH /api/admin/site-settings.php` | Low |
| Notifications | `/admin/bildirimler` and header bell | Supabase `notifications` | MySQL `ak_notifications` | `GET/PATCH/DELETE /api/admin/notifications.php` | Medium |

Reasoning:

- Public project lists/details read MySQL, but admin project management writes Supabase.
- Public contact form writes MySQL, but admin contact inbox reads Supabase.
- Public settings read MySQL, but admin settings reads/writes Supabase.
- Public contact submission creates MySQL notifications, but admin notifications read Supabase.

## 3. Working And Already Migrated

These admin-facing routes/features use PHP session auth and MySQL-backed admin lookup rather than Supabase.

| Admin page | Route | Current data source | Target data source | Required PHP endpoints | Complexity |
| --- | --- | --- | --- | --- | --- |
| Admin Login | `/admin/giris` | PHP API + MySQL `ak_admin_users`; PHP session | Already target: PHP API + MySQL | Existing: `POST /api/admin/login.php`, `GET /api/admin/me.php`, `POST /api/admin/logout.php` | Low |
| Admin Layout/Auth Guard | `/admin/*` wrapper | PHP API session check via `useAuth` | Already target: PHP API session | Existing: `GET /api/admin/me.php`, `POST /api/admin/logout.php` | Low |

Important caveat: the admin layout includes `NotificationBell`, which still uses Supabase. The auth guard itself is migrated, but the header notification widget is not.

## Recommended Migration Order

1. **Admin settings**
   - Build `GET/PATCH /api/admin/site-settings.php`.
   - Reason: public site settings already read MySQL; this is low complexity and fixes immediate source drift.

2. **Admin contacts**
   - Build `GET/PATCH/DELETE /api/admin/contact-requests.php`.
   - Reason: public contact form already writes MySQL; admin inbox currently cannot see the new source of truth.

3. **Admin notifications and notification bell**
   - Build `GET/PATCH/DELETE /api/admin/notifications.php`.
   - Reason: PHP contact submission already writes `ak_notifications`; the Supabase-backed bell affects every admin page.

4. **Admin projects list**
   - Build basic project list/toggle/duplicate/delete endpoints.
   - Reason: public project pages already read MySQL, so admin project changes must land in MySQL.

5. **Admin project edit without upload replacement**
   - Build create/update project and project image metadata endpoints first.
   - Reason: separates database migration from the harder storage migration.

6. **Project image upload and media**
   - Build PHP upload/delete endpoints and migrate `AdminProjectEdit` plus `AdminMedia`.
   - Reason: removes `project-images` Supabase Storage dependency.

7. **Customers and customer detail**
   - Build customer CRUD, customer-project linking, notes, and detail endpoints.
   - Reason: customers are a central dependency for payment plans, payments, expenses, reports, and finance.

8. **Payment plans**
   - Build payment plan CRUD and lookup endpoints.
   - Reason: collections, notifications, finance summaries, and reports depend on payment plan data.

9. **Payments/collections and payment document upload**
   - Build payments CRUD and payment document upload endpoints.
   - Reason: medium business impact plus storage dependency.

10. **Expenses and expense document upload**
   - Build expenses CRUD and expense document upload endpoints.
   - Reason: needed for finance dashboard and reports.

11. **Employees and expense cards**
   - Build simple CRUD endpoints.
   - Reason: low complexity, but mostly useful once financial entries move.

12. **Financial entries and statement pages**
   - Build `financial_entries` CRUD and `financial-statements` endpoints for project/customer/employee/expense-card views.
   - Reason: high complexity shared component; migrate after lookup tables are stable.

13. **Finance dashboard and reports**
   - Build summary/report endpoints on top of migrated finance tables.
   - Reason: these should be last consumers of already-migrated domain APIs/data.

14. **Remove Supabase admin runtime**
   - Remove remaining admin imports, then remove Supabase package/runtime only after public `SalesChatbot` and any remaining non-admin Supabase usage are addressed.

## Endpoint Backlog By Domain

### Foundation

- Existing:
  - `POST /api/admin/login.php`
  - `GET /api/admin/me.php`
  - `POST /api/admin/logout.php`
- Needed:
  - Consistent admin-only endpoint guard using `require_admin()`.
  - Shared request parsing and validation helpers for admin CRUD.

### Content

- `GET/PATCH /api/admin/site-settings.php`
- `GET/POST/PATCH/DELETE /api/admin/projects.php`
- `PATCH /api/admin/projects-order.php`
- `GET/POST/PATCH/DELETE /api/admin/project-images.php`
- `GET/DELETE /api/admin/media.php`

### Contacts And Notifications

- `GET/PATCH/DELETE /api/admin/contact-requests.php`
- `GET/PATCH/DELETE /api/admin/notifications.php`
- `POST /api/admin/notifications/generate-payment-reminders.php`

### CRM And Finance

- `GET/POST/PATCH/DELETE /api/admin/customers.php`
- `PUT /api/admin/customer-projects.php`
- `GET/POST/DELETE /api/admin/customer-notes.php`
- `GET /api/admin/customer-documents.php`
- `GET/POST/PATCH/DELETE /api/admin/payment-plans.php`
- `GET/POST/PATCH/DELETE /api/admin/payments.php`
- `GET/POST/PATCH/DELETE /api/admin/expenses.php`
- `GET/POST/PATCH/DELETE /api/admin/employees.php`
- `GET/POST/PATCH/DELETE /api/admin/expense-cards.php`
- `GET/POST/PATCH/DELETE /api/admin/financial-entries.php`
- `GET /api/admin/financial-statements.php`
- `GET /api/admin/finance-summary.php`
- `GET /api/admin/reports.php`

### Uploads

- `POST /api/admin/uploads/project-images.php`
- `POST /api/admin/uploads/payment-documents.php`
- `POST /api/admin/uploads/expense-documents.php`
- Optional shared delete endpoint if files are stored locally:
  - `DELETE /api/admin/uploads.php?path=...`

## Practical Priority Notes

- Start with pages where MySQL is already the public source of truth: settings, contacts, notifications, projects.
- Do not remove Supabase packages until every admin import and the public sales chatbot dependency are gone.
- Treat storage as its own phase. Database CRUD can move before upload replacement if existing image/document URLs are preserved.
- Move shared hooks last only when their consumers are ready, especially `useFinanceData`, `useNotifications`, and `financeSupabase`.
