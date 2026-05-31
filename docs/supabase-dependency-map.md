# Supabase Dependency Map

## Summary

Phase 2 discovery found Supabase usage in frontend pages/components/hooks, admin utilities, local seed/cleanup scripts, Supabase Edge Functions, and package dependencies. No Supabase Realtime usage was found.

The target replacement is:

React/Vite frontend -> PHP API under `public_html/api` -> MySQL/MariaDB `ak_` tables.

## Runtime Dependency Files

| File | Supabase features used | MySQL table mapping | Replacement PHP endpoint | Risk |
| --- | --- | --- | --- | --- |
| `src/integrations/supabase/client.ts` | Client creation | All Supabase calls flow through this client | Replace with fetch API helper later | High |
| `src/integrations/supabase/types.ts` | Generated Supabase DB types | All app tables | Replace with local TS API response types later | Medium |
| `src/hooks/useAuth.ts` | Auth session, auth state, DB select | `ak_admin_users`, `ak_user_roles` | `POST /api/admin/login.php`, `POST /api/admin/logout.php`, `GET /api/admin/me.php` | High |
| `src/components/admin/AdminLayout.tsx` | Auth sign out | `ak_admin_users` session | `POST /api/admin/logout.php` | Medium |
| `src/pages/admin/AdminAuth.tsx` | Auth sign in/sign out | `ak_admin_users` | `POST /api/admin/login.php`, `POST /api/admin/logout.php` | High |
| `src/hooks/useSiteSettings.ts` | DB select | `ak_site_settings` | `GET /api/site-settings.php`; admin write later via `CRUD /api/admin/settings.php` | Low |
| `src/pages/site/Home.tsx` | DB select | `ak_projects` | `GET /api/projects.php` | Low |
| `src/pages/site/Projects.tsx` | DB select | `ak_projects` | `GET /api/projects.php` | Low |
| `src/pages/site/ProjectDetail.tsx` | DB select | `ak_projects`, `ak_project_images` | `GET /api/project-detail.php?slug=` | Low |
| `src/pages/site/Contact.tsx` | Edge function invoke | `ak_contact_requests`, `ak_notifications` | `POST /api/contact-request.php` | Medium |
| `src/components/site/CookieConsent.tsx` | DB insert | `ak_cookie_consents` | `POST /api/cookie-consent.php` | Low |
| `src/components/site/SalesChatbot.tsx` | Edge function invoke | No direct app table; may read site/project context | Future `POST /api/sales-chatbot.php` or external service | Medium |
| `src/pages/admin/AdminSettings.tsx` | DB select/update | `ak_site_settings` | `CRUD /api/admin/settings.php` | Medium |
| `src/pages/admin/AdminProjects.tsx` | DB select/insert/update/delete | `ak_projects` | `CRUD /api/admin/projects.php` | High |
| `src/pages/admin/AdminProjectEdit.tsx` | DB select/insert/update/delete, Storage upload/download | `ak_projects`, `ak_project_images`; storage bucket `project-images` | `CRUD /api/admin/projects.php`, `CRUD /api/admin/media.php`, upload endpoint under admin media | High |
| `src/features/admin/projects/projectImportExport.ts` | DB select/upsert/insert | `ak_projects`, `ak_project_images` | Admin project import/export endpoint or `CRUD /api/admin/projects.php` | High |
| `src/pages/admin/AdminMedia.tsx` | DB select/delete with joined project data | `ak_project_images`, `ak_projects` | `CRUD /api/admin/media.php` | Medium |
| `src/pages/admin/AdminContacts.tsx` | DB select/update/delete | `ak_contact_requests` | Admin contacts endpoint, likely `CRUD /api/admin/contact-requests.php` | Medium |
| `src/pages/admin/AdminDashboard.tsx` | DB select | `ak_projects`, `ak_customers`, `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_financial_entries`, `ak_contact_requests` | `GET /api/admin/dashboard.php` or combined admin endpoints | High |
| `src/pages/admin/AdminCustomers.tsx` | DB select/delete | `ak_customers`, `ak_payment_plans`, `ak_payments`, `ak_customer_projects`, `ak_projects` | `CRUD /api/admin/customers.php` | High |
| `src/pages/admin/AdminCustomerEdit.tsx` | DB select/insert/update/delete | `ak_customers`, `ak_customer_projects`, `ak_projects` | `CRUD /api/admin/customers.php` | High |
| `src/pages/admin/AdminCustomerDetail.tsx` | DB select/insert/delete | `ak_customers`, `ak_customer_projects`, `ak_projects`, `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_customer_notes`, `ak_documents` | `CRUD /api/admin/customers.php`, finance/documents endpoints | High |
| `src/pages/admin/AdminCollections.tsx` | DB select/insert/update/delete, Storage upload/signed URL | `ak_payments`, `ak_customers`, `ak_projects`, `ak_payment_plans`; storage bucket `payment-documents` | `CRUD /api/admin/finance.php`, upload endpoint under admin media/documents | High |
| `src/pages/admin/AdminPaymentPlans.tsx` | DB select/insert/update/delete | `ak_payment_plans`, `ak_customers`, `ak_projects`, `ak_payments` | `CRUD /api/admin/finance.php` | High |
| `src/pages/admin/AdminExpenses.tsx` | DB select/insert/update/delete, Storage upload/signed URL | `ak_expenses`, `ak_customers`, `ak_projects`; storage bucket `expense-documents` | `CRUD /api/admin/finance.php`, upload endpoint under admin media/documents | High |
| `src/pages/admin/AdminFinance.tsx` | DB select | `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_financial_entries`, `ak_customers`, `ak_projects` | `CRUD /api/admin/finance.php` or `GET /api/admin/finance.php` summary | High |
| `src/lib/financialTypes.ts` | Supabase typed client alias | Finance-related app tables | Replace with PHP API response/request types | Medium |
| `src/hooks/useFinanceData.ts` | DB select helper | Dynamic finance/admin tables | Replace with admin fetch helper | Medium |
| `src/components/admin/finance/FinancialStatementPage.tsx` | DB select/insert/update/delete | `ak_projects`, `ak_customers`, `ak_employees`, `ak_expense_cards`, `ak_financial_entries` | `CRUD /api/admin/finance.php` | High |
| `src/pages/admin/AdminEmployees.tsx` | DB select/insert/update/delete through finance client | `ak_employees` | `CRUD /api/admin/finance.php` or `CRUD /api/admin/employees.php` | Medium |
| `src/pages/admin/AdminExpenseCards.tsx` | DB select/insert/update/delete through finance client | `ak_expense_cards` | `CRUD /api/admin/finance.php` or `CRUD /api/admin/expense-cards.php` | Medium |
| `src/hooks/useNotifications.ts` | DB select/insert/update/delete | `ak_payment_plans`, `ak_notifications` | `CRUD /api/admin/notifications.php`; PHP notification job/logic | High |

## Script and Tooling Dependencies

| File | Supabase features used | MySQL table mapping | Replacement PHP endpoint/tooling | Risk |
| --- | --- | --- | --- | --- |
| `package.json` | Supabase packages | N/A | Keep for now; remove in a later cleanup phase | Low |
| `scripts/seed-smoke-test.mjs` | Auth, DB select/insert/update | `ak_customers`, `ak_projects`, `ak_employees`, `ak_expense_cards`, `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_financial_entries`, `ak_notifications`, `ak_customer_projects` | Future MySQL/PHP seed script or SQL seed | Medium |
| `scripts/cleanup-smoke-test.mjs` | Auth, DB select/delete | Same smoke-test tables | Future MySQL cleanup script | Medium |
| `scripts/seed-demo-bulk.mjs` | Auth, DB select/insert | CRM, project, finance, notification, document, media tables | Future MySQL/PHP demo seed tooling | Medium |
| `scripts/cleanup-demo-bulk.mjs` | Auth, DB select/delete | CRM, project, finance, notification, document, media tables | Future MySQL cleanup tooling | Medium |

## Supabase Project Artifacts

| File | Supabase features used | MySQL table mapping | Replacement PHP endpoint/tooling | Risk |
| --- | --- | --- | --- | --- |
| `supabase/functions/submit-contact-request/index.ts` | Edge function, contact validation, DB insert | `ak_contact_requests`, likely `ak_notifications` | `POST /api/contact-request.php` | High |
| `supabase/functions/sales-chatbot/index.ts` | Edge function | No direct table confirmed from dependency scan | Future `POST /api/sales-chatbot.php` or external service | Medium |
| `supabase/config.toml` | Supabase project config | N/A | Remove after all Supabase runtime paths are gone | Low |
| `supabase/migrations/*.sql` | PostgreSQL schema, RLS, policies, storage, triggers | Converted to 20 `ak_` MySQL tables | Historical reference only after PHP migration | Low |
| `supabase/manual/*.sql` | Manual Supabase schema/seed files | Converted schema and future seed reference | Historical reference only after PHP migration | Low |

## Feature Coverage

- Auth: `useAuth.ts`, `AdminAuth.tsx`, `AdminLayout.tsx`, seed/cleanup scripts.
- Database select: public site pages, admin pages, hooks, scripts.
- Database insert/update/delete: admin pages, cookie consent, notification hook, project import/export, scripts.
- Storage upload/download: `AdminProjectEdit.tsx`, `AdminCollections.tsx`, `AdminExpenses.tsx`.
- Edge function invoke: `Contact.tsx`, `SalesChatbot.tsx`.
- Realtime: none found.

## Suggested Migration Order

1. Replace public read-only site data: `useSiteSettings.ts`, `Home.tsx`, `Projects.tsx`, `ProjectDetail.tsx`.
2. Replace public writes: contact request and cookie consent.
3. Implement PHP admin auth/session: login, logout, me, route guards.
4. Replace admin settings/projects/media reads and writes.
5. Replace CRM/customer admin flows.
6. Replace finance, employees, expense cards, payment plans, payments, expenses, and financial statement flows.
7. Replace document and upload handling for all former Supabase Storage buckets.
8. Replace notification creation/mark-read/delete behavior.
9. Replace or retire seed/cleanup scripts.
10. Remove Supabase packages, generated types, client, functions, migrations, and env keys only after the frontend no longer calls Supabase.
