# Current Architecture Audit

Audit date: 2026-05-30  
Scope: current repository contents only. No previous project state assumed.

## 1. Current Architecture

### React/Vite Frontend

- The application is a Vite + React + TypeScript single page app.
- Entry points:
  - `index.html`
  - `src/main.tsx`
  - `src/App.tsx`
- Routing is handled by `react-router-dom` in `src/App.tsx`.
- Public routes live under `src/pages/site`.
- Admin routes live under `src/pages/admin` and are wrapped by `src/components/admin/AdminLayout.tsx`.
- Shared UI components are mostly shadcn/Radix-style components under `src/components/ui`.
- Data fetching is split:
  - Public website and PHP session auth use `src/lib/apiClient.ts`.
  - Most admin business data still calls Supabase directly through `src/integrations/supabase/client.ts`.

### PHP API Layer

- PHP endpoints live under `public_html/api`.
- Current implemented endpoints:
  - `GET /api/site-settings.php`
  - `GET /api/projects.php`
  - `GET /api/project-detail.php?slug=...`
  - `POST /api/contact-request.php`
  - `POST /api/cookie-consent.php`
  - `POST /api/admin/login.php`
  - `POST /api/admin/logout.php`
  - `GET /api/admin/me.php`
- Common PHP utilities:
  - `public_html/api/db.php`: PDO MySQL connection.
  - `public_html/api/response.php`: JSON response and method helpers.
  - `public_html/api/auth.php`: PHP session admin helpers.
  - `public_html/api/config.example.php`: server configuration template.
- `public_html/api/router-notes.md` lists planned CRUD endpoints for admin resources, but those files do not currently exist.

### MySQL Usage

- MySQL schema installation is defined in `public_html/install-schema.php`.
- Runtime MySQL access currently exists only in:
  - Public project reads.
  - Public project detail reads.
  - Public site settings read.
  - Public contact form insert.
  - Cookie consent insert.
  - Admin login/session lookup.
- MySQL table names use the `ak_` prefix.
- The PHP layer uses PDO with `pdo_mysql`.

### Supabase Usage

- Supabase is still installed as a runtime dependency:
  - `@supabase/supabase-js`
  - `@supabase/ssr`
- Supabase client source remains in `src/integrations/supabase/client.ts`.
- Generated Supabase types remain in `src/integrations/supabase/types.ts`.
- Supabase migrations and manual schema files remain under `supabase/`.
- Supabase Edge Functions remain under `supabase/functions`.
- Most admin data operations still use Supabase directly from the browser.

### Authentication Flow

- Current admin authentication has been migrated to PHP sessions.
- Frontend hook: `src/hooks/useAuth.ts`.
- Frontend API client functions:
  - `loginAdmin`
  - `logoutAdmin`
  - `getCurrentAdmin`
- PHP endpoints:
  - `public_html/api/admin/login.php`
  - `public_html/api/admin/logout.php`
  - `public_html/api/admin/me.php`
- Session helpers:
  - `public_html/api/auth.php`
- Admin login reads `ak_admin_users` by `email_lower`, verifies `password_hash`, requires `is_active = 1`, then stores a compact admin object in `$_SESSION`.
- `AdminLayout` protects admin routes by calling `useAuth`.
- Supabase Auth is no longer used by the frontend auth hook, but Supabase auth tables and policies remain in migration/manual schema files.

### File Upload Flow

- File/media upload is not migrated to PHP/MySQL yet.
- Current upload paths still use Supabase Storage:
  - Project images: `project-images` bucket in `src/pages/admin/AdminProjectEdit.tsx`.
  - Payment documents: `payment-documents` bucket in `src/pages/admin/AdminCollections.tsx`.
  - Expense documents: `expense-documents` bucket in `src/pages/admin/AdminExpenses.tsx`.
- Public image display uses URL fields stored on project/project image rows, currently consumed through PHP endpoints for public project pages.
- There is no current PHP upload endpoint.

## 2. Supabase Dependency Inventory

### Client and Package Dependencies

- `package.json`
  - `@supabase/ssr`
  - `@supabase/supabase-js`
- `src/integrations/supabase/client.ts`
  - Imports `createClient` from `@supabase/supabase-js`.
  - Exports the shared `supabase` client.
- `src/integrations/supabase/types.ts`
  - Generated database typings for Supabase/Postgres.

### Auth

No active frontend code calls `supabase.auth` in `src`.

Remaining auth-related Supabase assets:

- `supabase/manual/akinal_full_schema.sql`
  - References `auth.users`, `auth.uid()`, `auth.jwt()`, RLS policies, profile/user-role triggers.
- `supabase/migrations/*`
  - Several migrations reference `auth.users`, `auth.uid()`, and role checks.
- These are migration artifacts, not active frontend runtime auth calls.

### Database

Remaining active Supabase database imports/calls:

- `src/hooks/useFinanceData.ts`
  - Generic `supabase.from(table).select("*")`.
  - Tables used by hook: `customers`, `payment_plans`, `payments`, `expenses`, `financial_entries`, `projects`, `customer_projects`.
- `src/hooks/useNotifications.ts`
  - `payment_plans`
  - `notifications`
- `src/lib/financialTypes.ts`
  - Imports `SupabaseClient`, `supabase`, and Supabase `Database` types.
  - Exports `financeSupabase`.
- `src/components/admin/finance/FinancialStatementPage.tsx`
  - `projects`
  - `customers`
  - `employees`
  - `expense_cards`
  - `financial_entries`
- `src/features/admin/projects/projectImportExport.ts`
  - `projects`
  - `project_images`
- `src/pages/admin/AdminContacts.tsx`
  - `contact_requests`
- `src/pages/admin/AdminCollections.tsx`
  - `payments`
  - `customers`
  - `projects`
  - `payment_plans`
- `src/pages/admin/AdminCustomerDetail.tsx`
  - `customers`
  - `customer_projects`
  - `projects`
  - `payment_plans`
  - `payments`
  - `expenses`
  - `customer_notes`
  - `documents`
- `src/pages/admin/AdminCustomerEdit.tsx`
  - `projects`
  - `customers`
  - `customer_projects`
- `src/pages/admin/AdminCustomers.tsx`
  - `customers`
  - `payment_plans`
  - `payments`
  - `customer_projects`
  - `projects`
- `src/pages/admin/AdminDashboard.tsx`
  - `projects`
  - `customers`
  - `payment_plans`
  - `payments`
  - `expenses`
  - `financial_entries`
  - `contact_requests`
- `src/pages/admin/AdminEmployees.tsx`
  - `employees`
- `src/pages/admin/AdminExpenseCards.tsx`
  - `expense_cards`
- `src/pages/admin/AdminExpenses.tsx`
  - `expenses`
  - `customers`
  - `projects`
- `src/pages/admin/AdminFinance.tsx`
  - `payment_plans`
  - `payments`
  - `expenses`
  - `financial_entries`
  - `customers`
  - `projects`
- `src/pages/admin/AdminMedia.tsx`
  - `project_images`
- `src/pages/admin/AdminPaymentPlans.tsx`
  - `payment_plans`
  - `customers`
  - `projects`
  - `payments`
- `src/pages/admin/AdminProjectEdit.tsx`
  - `projects`
  - `project_images`
- `src/pages/admin/AdminProjects.tsx`
  - `projects`
- `src/pages/admin/AdminSettings.tsx`
  - `site_settings`

### Storage

Remaining active Supabase Storage usage:

- `src/pages/admin/AdminProjectEdit.tsx`
  - `supabase.storage.from("project-images").upload(...)`
  - `supabase.storage.from("project-images").getPublicUrl(...)`
- `src/pages/admin/AdminCollections.tsx`
  - `supabase.storage.from("payment-documents").upload(...)`
  - `supabase.storage.from("payment-documents").createSignedUrl(...)`
- `src/pages/admin/AdminExpenses.tsx`
  - `supabase.storage.from("expense-documents").upload(...)`
  - `supabase.storage.from("expense-documents").createSignedUrl(...)`

Storage buckets also remain in Supabase schema/migration files:

- `project-images`
- `customer-documents`
- `payment-documents`
- `expense-documents`

### Realtime

- No active `supabase.channel(...)` or realtime subscription usage was found in `src`.

### Edge Functions

Remaining active Supabase Edge Function usage:

- `src/components/site/SalesChatbot.tsx`
  - `supabase.functions.invoke("sales-chatbot", ...)`

Edge Function source files still present:

- `supabase/functions/sales-chatbot/index.ts`
- `supabase/functions/submit-contact-request/index.ts`

The contact form has a PHP endpoint now, so `submit-contact-request` appears to be obsolete unless deployed elsewhere.

## 3. PHP API Inventory

### `GET /api/site-settings.php`

- Reads: `ak_site_settings`.
- Used by:
  - `src/hooks/useSiteSettings.ts`
  - Public layout/header/footer/site content consumers through that hook.

### `GET /api/projects.php`

- Reads: `ak_projects`.
- Filters: `is_published = 1`.
- Used by:
  - `src/pages/site/Home.tsx`
  - `src/pages/site/Projects.tsx`
  - `src/pages/site/ProjectDetail.tsx` for related/project list data.

### `GET /api/project-detail.php?slug=...`

- Reads:
  - `ak_projects`
  - `ak_project_images`
- Filters project by published slug.
- Used by:
  - `src/pages/site/ProjectDetail.tsx`

### `POST /api/contact-request.php`

- Writes:
  - `ak_contact_requests`
  - `ak_notifications`
- Validates contact request fields before inserting them.
- Used by:
  - `src/pages/site/Contact.tsx`

### `POST /api/cookie-consent.php`

- Writes:
  - `ak_cookie_consents`
- Used by:
  - `src/components/site/CookieConsent.tsx`

### `POST /api/admin/login.php`

- Reads:
  - `ak_admin_users`
- Verifies `password_hash` and writes PHP session data.
- Used by:
  - `src/hooks/useAuth.ts`
  - `src/pages/admin/AdminAuth.tsx`

### `GET /api/admin/me.php`

- Reads PHP session only.
- Used by:
  - `src/hooks/useAuth.ts`
  - `src/components/admin/AdminLayout.tsx`

### `POST /api/admin/logout.php`

- Clears PHP session.
- Used by:
  - `src/hooks/useAuth.ts`
  - `src/pages/admin/AdminAuth.tsx`
  - `src/components/admin/AdminLayout.tsx`

### Planned but Missing PHP API Endpoints

`public_html/api/router-notes.md` lists planned CRUD endpoints, but these are not implemented in the current tree:

- `/api/admin/projects.php`
- `/api/admin/customers.php`
- `/api/admin/finance.php`
- `/api/admin/media.php`
- `/api/admin/settings.php`

Admin pages therefore still use Supabase directly for those domains.

## 4. Database Status

### MySQL Tables Expected by the Application

Defined in `public_html/install-schema.php`:

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

### Tables Currently Read From by PHP Runtime

- `ak_admin_users`
- `ak_site_settings`
- `ak_projects`
- `ak_project_images`

### Tables Currently Written To by PHP Runtime

- `ak_contact_requests`
- `ak_notifications`
- `ak_cookie_consents`

### Tables Expected but Not Yet Used by PHP Runtime

- `ak_profiles`
- `ak_user_roles`
- `ak_media_library`
- `ak_customers`
- `ak_customer_projects`
- `ak_payment_plans`
- `ak_payments`
- `ak_expenses`
- `ak_customer_notes`
- `ak_documents`
- `ak_employees`
- `ak_expense_cards`
- `ak_financial_entries`

Some of these are heavily used by the frontend, but via Supabase table names, not via MySQL/PHP endpoints.

## 5. Frontend Migration Status

### Pages/Features Already Using PHP API

- Public site settings:
  - `src/hooks/useSiteSettings.ts`
- Public homepage project list:
  - `src/pages/site/Home.tsx`
- Public projects list:
  - `src/pages/site/Projects.tsx`
- Public project detail:
  - `src/pages/site/ProjectDetail.tsx`
- Public contact form:
  - `src/pages/site/Contact.tsx`
- Cookie consent:
  - `src/components/site/CookieConsent.tsx`
- Admin login/session/logout:
  - `src/hooks/useAuth.ts`
  - `src/pages/admin/AdminAuth.tsx`
  - `src/components/admin/AdminLayout.tsx`

### Pages/Features Still Using Supabase

- Sales chatbot:
  - `src/components/site/SalesChatbot.tsx`
- Admin dashboard:
  - `src/pages/admin/AdminDashboard.tsx`
- Admin projects:
  - `src/pages/admin/AdminProjects.tsx`
  - `src/pages/admin/AdminProjectEdit.tsx`
  - `src/features/admin/projects/projectImportExport.ts`
- Admin media:
  - `src/pages/admin/AdminMedia.tsx`
- Admin contacts:
  - `src/pages/admin/AdminContacts.tsx`
- Admin settings update:
  - `src/pages/admin/AdminSettings.tsx`
- Admin customers:
  - `src/pages/admin/AdminCustomers.tsx`
  - `src/pages/admin/AdminCustomerEdit.tsx`
  - `src/pages/admin/AdminCustomerDetail.tsx`
- Admin collections/payment plans/expenses:
  - `src/pages/admin/AdminCollections.tsx`
  - `src/pages/admin/AdminPaymentPlans.tsx`
  - `src/pages/admin/AdminExpenses.tsx`
- Admin finance:
  - `src/pages/admin/AdminFinance.tsx`
  - `src/pages/admin/AdminReports.tsx`
  - `src/hooks/useFinanceData.ts`
  - `src/components/admin/finance/FinancialStatementPage.tsx`
- Admin employees and expense cards:
  - `src/pages/admin/AdminEmployees.tsx`
  - `src/pages/admin/AdminExpenseCards.tsx`
- Notification features:
  - `src/hooks/useNotifications.ts`
  - `src/components/admin/NotificationBell.tsx`
  - `src/pages/admin/AdminNotifications.tsx`

## 6. Admin Panel Status

### Functional on PHP/MySQL

- Admin login.
- Admin logout.
- Admin session restore/check.
- Admin route protection based on PHP session and role.

### Still Dependent on Supabase

- Dashboard metrics and recent activity.
- Project CRUD.
- Project image CRUD.
- Project import/export.
- Media listing/deletion.
- Contact request administration.
- Site settings update.
- Customer CRUD and customer project linking.
- Customer detail notes/documents display.
- Payment plan CRUD.
- Payment collection CRUD.
- Expense CRUD.
- Employee CRUD.
- Expense card CRUD.
- Financial entries and financial statements.
- Reports.
- Notifications and notification bell.
- Admin file/document uploads.

### Partially Migrated Admin Areas

- Authentication is migrated, but most post-login admin screens still depend on Supabase table and storage access.
- Contact requests are written by the public PHP endpoint, but the admin contacts screen still reads/updates/deletes them from Supabase.
- Site settings are read publicly from MySQL, but admin settings update still writes to Supabase.
- Project data is read publicly from MySQL, but admin project management still writes to Supabase.

## 7. File/Media Status

### Current Image Strategy

- Public pages consume image URL fields from MySQL-backed PHP endpoints:
  - `ak_projects.cover_image_url`
  - `ak_project_images.image_url`
  - `ak_project_images.thumbnail_url`
- Existing static assets are bundled from `src/assets` and `public`.
- Admin-managed project images still produce Supabase Storage public URLs.

### Current Upload Strategy

- Uploads are still direct browser-to-Supabase Storage.
- Buckets used:
  - `project-images`
  - `payment-documents`
  - `expense-documents`
- There is no PHP endpoint for upload, delete, signing, or media metadata synchronization.

### Storage Migration Status

- Storage migration is incomplete.
- MySQL schema includes metadata tables such as `ak_media_library`, `ak_project_images`, and `ak_documents`.
- The active upload path still stores files in Supabase Storage and stores Supabase URLs in database rows.
- A future PHP upload layer needs to decide whether files live under `public_html/uploads`, another server path, or external object storage.

## 8. Risks

### High

- Admin data writes still go directly to Supabase while public reads now use MySQL, creating likely data divergence.
- Admin login can succeed through PHP/MySQL, but most authenticated admin pages still require Supabase configuration and permissions to work.
- Site settings are split: public reads MySQL, admin writes Supabase. Admin changes may not appear publicly.
- Projects are split: public reads MySQL, admin project CRUD writes Supabase. Admin project changes may not appear publicly.
- Uploads are still Supabase-only; removing Supabase before replacing storage will break project images and document uploads.
- Contact form writes MySQL, but admin contacts reads Supabase, so newly submitted MySQL contact requests may not show in the admin panel.

### Medium

- Supabase dependencies remain in `package.json`, so the frontend bundle can still include Supabase runtime code.
- Supabase Edge Function `sales-chatbot` remains active from the public site.
- MySQL schema has many tables that are not yet exposed through PHP APIs.
- `router-notes.md` documents planned admin CRUD endpoints that do not exist, which may mislead deployment or migration expectations.
- Supabase migration files remain as historical source material, but are not aligned with MySQL runtime behavior.
- Contact request validation now happens in `contact-request.php`; missing database config will break the public contact form.

### Low

- `@supabase/ssr` appears installed but no active frontend import was found.
- Realtime does not appear to be used, so there is no realtime migration burden visible in current source.
- Public frontend migration is mostly complete for read-only site content.

## 9. Recommended Next Phases

1. Build PHP admin project and site settings APIs.
   - Highest impact because public MySQL reads already depend on these tables.
   - Removes the most visible data divergence between admin edits and public pages.

2. Migrate admin contacts to PHP/MySQL.
   - Public contact submission already writes MySQL.
   - Admin inbox currently points at Supabase and is disconnected from new submissions.

3. Build PHP APIs for customers, payment plans, payments, expenses, and financial entries.
   - These power most admin dashboard, finance, reports, and customer screens.

4. Replace Supabase Storage with a PHP upload/media layer.
   - Add endpoints for project images, payment documents, expense documents, and document metadata.
   - Decide final file location and URL strategy before changing frontend upload code.

5. Migrate notifications to PHP/MySQL.
   - Public contact endpoint already creates `ak_notifications`.
   - Notification bell and admin notification pages still use Supabase.

6. Replace or retire Supabase Edge Functions.
   - `sales-chatbot` needs a PHP/server replacement or should be removed from the public UI.
   - `submit-contact-request` appears superseded by PHP and can be retired after confirmation.

7. Remove Supabase client/runtime dependencies.
   - Only after all active imports are gone.
   - Remove `src/integrations/supabase`, package dependencies, and environment variables.

8. Archive migration artifacts.
   - Keep Supabase schema/migrations only as historical migration references, outside runtime expectations.

## 10. Migration Completion Estimate

Estimated migration away from Supabase:

- Migrated: 35%
- Remaining: 65%

Rationale:

- Public content reads, contact submission, cookie consent, and admin authentication are already on PHP/MySQL.
- The majority of admin CRUD, finance, notifications, storage uploads, and the sales chatbot still depend on Supabase.
- The highest-risk remaining work is not authentication; it is admin data ownership and file storage.
