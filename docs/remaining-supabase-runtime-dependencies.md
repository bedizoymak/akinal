# Remaining Supabase Runtime Dependencies

## Summary

Public read-only data, contact form submission, cookie consent, and admin login/logout/me have been moved to PHP API + MySQL.

Supabase cannot be physically deleted yet. Admin CRUD and several tooling/runtime paths still import or call Supabase.

## Public Runtime

- `src/components/site/SalesChatbot.tsx`
  - Uses `supabase.functions.invoke("sales-chatbot")`.
  - Replacement needed: `POST /api/sales-chatbot.php` or another server-side integration.

## Admin Runtime

- `src/hooks/useNotifications.ts`
  - Uses Supabase tables `payment_plans` and `notifications`.
- `src/hooks/useFinanceData.ts`
  - Generic Supabase table reads for finance/admin data.
- `src/lib/financialTypes.ts`
  - Exposes typed Supabase finance client.
- `src/components/admin/finance/FinancialStatementPage.tsx`
  - Uses finance Supabase client for entity lookups and financial entry CRUD.
- `src/features/admin/projects/projectImportExport.ts`
  - Uses Supabase project and image reads/upserts.
- `src/pages/admin/AdminContacts.tsx`
  - Uses `contact_requests` select/update/delete.
- `src/pages/admin/AdminCollections.tsx`
  - Uses payments, customers, projects, payment plans, and payment document storage.
- `src/pages/admin/AdminSettings.tsx`
  - Uses `site_settings` read/update.
- `src/pages/admin/AdminProjects.tsx`
  - Uses `projects` select/insert/update/delete.
- `src/pages/admin/AdminProjectEdit.tsx`
  - Uses `projects`, `project_images`, and `project-images` storage.
- `src/pages/admin/AdminPaymentPlans.tsx`
  - Uses payment plan/customer/project/payment tables.
- `src/pages/admin/AdminEmployees.tsx`
  - Uses finance Supabase client for employee CRUD.
- `src/pages/admin/AdminCustomerDetail.tsx`
  - Uses customers, customer projects, projects, payment plans, payments, expenses, notes, and documents.
- `src/pages/admin/AdminCustomers.tsx`
  - Uses customers, payment plans, payments, customer projects, and projects.
- `src/pages/admin/AdminFinance.tsx`
  - Uses finance tables and projects.
- `src/pages/admin/AdminExpenseCards.tsx`
  - Uses finance Supabase client for expense card CRUD.
- `src/pages/admin/AdminMedia.tsx`
  - Uses `project_images`.
- `src/pages/admin/AdminCustomerEdit.tsx`
  - Uses customers, customer projects, and projects.
- `src/pages/admin/AdminExpenses.tsx`
  - Uses expenses, customers, projects, and expense document storage.
- `src/pages/admin/AdminDashboard.tsx`
  - Uses projects, customers, payment plans, payments, expenses, financial entries, and contact requests.

## Scripts And Tooling Only

- `scripts/seed-smoke-test.mjs`
- `scripts/cleanup-smoke-test.mjs`
- `scripts/seed-demo-bulk.mjs`
- `scripts/cleanup-demo-bulk.mjs`

These still use Supabase Auth and table reads/writes/deletes for old smoke/demo workflows.

## Historical Or Migration Only

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `supabase/functions/submit-contact-request/index.ts`
- `supabase/functions/sales-chatbot/index.ts`
- `supabase/config.toml`
- `supabase/migrations/*.sql`
- `supabase/manual/*.sql`
- migration/docs files that mention Supabase as historical context

Do not remove the Supabase package or client files until admin runtime and sales chatbot replacements are complete and a final search confirms no runtime imports remain.
