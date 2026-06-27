# DB Schema Frontend Contract Audit

**Generated:** 2026-06-26  
**Branch:** main  
**Scope:** Repository-only (no live DB access; all findings derived from `install-schema.php`, PHP endpoint files, TypeScript types, and React routes)

---

## Method

The following files were scanned exhaustively:

| Layer | Files scanned |
|---|---|
| DB schema | `public_html/install-schema.php` |
| PHP backend | All 55 files in `public_html/api/admin/*.php` |
| API client | `src/lib/apiClient.ts` |
| TypeScript types | `src/lib/apiTypes.ts` |
| React router | `src/App.tsx` |
| Finance helpers | `src/lib/finance.ts` (referenced in apiTypes) |
| Seed scripts | `scripts/seed-demo-card-finance.mjs` |

React page/component files (e.g. `AdminCustomerDetail.tsx`, `AdminGelenler.tsx`) were **not individually read** — behavior inferred from the API functions they call, as declared in `apiClient.ts`. Pages that are now dead code (their routes redirect) are flagged separately.

---

## Production Schema Source

**Source: `public_html/install-schema.php` only.**  
Live DB access is not available in this audit. The install-schema.php defines 27 tables using `CREATE TABLE IF NOT EXISTS`. The production DB name is `akinalin_wp282` (host: localhost, cPanel shared hosting). No `SHOW TABLES` or `SHOW COLUMNS` output is available.

**Known schema/code discrepancy:** `dashboard.php` queries `ec.category` from `ak_expense_cards`, but the schema defines `ak_expense_cards` with only `id` and `name` columns. Either (a) the production DB has a `category` column added via a migration not reflected in `install-schema.php`, or (b) the `build_expense_category_intelligence()` function fails on production. This must be investigated. See [ak_expense_cards](#ak_expense_cards) below.

---

## Table-by-Table Contract

### ak_admin_users

**Status:** DELETE_CANDIDATE_BUT_PROTECTED

**Purpose:** Stores admin login credentials and roles; the auth foundation for the entire admin panel.

**Production / schema columns:**
`id, email, email_lower, password_hash, role, is_active, created_at, updated_at`

**Required by PHP backend:**
- `api/admin/login.php` — SELECT by `email_lower`; verifies `password_hash`; reads `role`, `is_active`
- `api/admin/me.php` — SELECT by session `user_id`
- `api/admin/auth.php` — `require_admin()` checks session, `current_admin()` reads row
- `api/admin/ak_payment_plan_settlements` schema — FK `created_by`, `reversed_by` → `ak_admin_users.id`

**Required by frontend/API:**
- `getCurrentAdmin()` / `loginAdmin()` / `logoutAdmin()` in `apiClient.ts`
- `AdminUser` type: `id, email, role`

**Foreign key / relationship role:**
- Referenced by: `ak_profiles.user_id`, `ak_user_roles.user_id`, `ak_payment_plan_settlements.created_by`, `ak_payment_plan_settlements.reversed_by`

**Columns that appear required:** `id, email, email_lower, password_hash, role, is_active`

**Columns that appear optional:** `created_at, updated_at` (not exposed to frontend)

**Columns that appear unused or unclear:** none

**Deletion / cleanup recommendation:** Protected — do not delete. Core auth table. Auth cannot function without it.

---

### ak_profiles

**Status:** DELETE_CANDIDATE_BUT_PROTECTED

**Purpose:** Schema-only user profile extension; no active queries found in any PHP endpoint.

**Production / schema columns:**
`id, user_id, email, display_name, created_at`

**Required by PHP backend:** None found in any scanned file.

**Required by frontend/API:** Not referenced in `apiClient.ts` or `apiTypes.ts`.

**Foreign key / relationship role:**
- References `ak_admin_users.id` via FK `fk_profiles_user`
- Referenced by: nothing

**Columns that appear required:** None active.

**Deletion / cleanup recommendation:** Protected per CLAUDE.md instructions — do not delete in this audit. Schema-only; safe to drop after owner confirmation that no external tool writes to it.

---

### ak_user_roles

**Status:** DELETE_CANDIDATE_BUT_PROTECTED

**Purpose:** Schema-only user–role mapping; no active queries found in any PHP endpoint.

**Production / schema columns:**
`id, user_id, role, created_at`

**Required by PHP backend:** None found.

**Required by frontend/API:** Not referenced.

**Foreign key / relationship role:**
- References `ak_admin_users.id` via FK `fk_user_roles_user`
- Referenced by: nothing

**Deletion / cleanup recommendation:** Protected per CLAUDE.md — do not delete in this audit.

---

### ak_projects

**Status:** KEEP_CORE

**Purpose:** Central project catalog; used by every finance, customer, employee, and reporting endpoint.

**Production / schema columns:**
`id, title, slug, short_description, detailed_description, project_type, project_status, location, city, district, start_year, delivery_year, land_area, construction_area, apartment_count, floor_count, block_count, cover_image_url, is_featured, is_published, sort_order, seo_title, seo_description, created_at, updated_at`

**Required by PHP backend:**
- `projects.php` — full SELECT/INSERT/UPDATE/DELETE on all columns
- `dashboard.php` — SELECT `id, title, project_status, location, is_published, slug, sort_order, created_at`; joins via all 4 card finance tables
- `customers.php` — SELECT `id, title, slug, sort_order, created_at` for project lookup
- `payment-plans.php` — FK validation, SELECT `id, title`
- `payments.php` — FK validation
- `financial-statement.php` — SELECT `id, title, location, project_status` as entity lookup
- `project-statement.php` — SELECT `id, title`; WHERE clause FK
- `gelenler.php` — SELECT `id, title` (projects lookup list); LEFT JOIN for `p.title`
- `gidenler.php` — SELECT `id, title`; LEFT JOIN for `p.title`
- `reports.php` — SELECT `*`
- `notifications.php` — FK via related_project_id
- `employee-project-assignments.php`, `employee-project-allocations.php` — FK
- `project-expense-transactions.php` — FK `project_id`
- `canonical-read-flags.php` / `backend-canonical-read-model.php` — SELECT `id` (count)

**Required by frontend/API:**
- `getAdminProjects()`, `getAdminProject(id)`, `createAdminProject()`, `updateAdminProject()`, `deleteAdminProject()` → `PublicProject` type
- `PublicProject` fields used in UI: `id, title, slug, short_description, project_type, project_status, location, city, district, start_year, delivery_year, cover_image_url, is_featured, is_published, sort_order, seo_title, seo_description`
- Referenced as `ProjectStatementResponse.project`, `GelenlerResponse.projects`, `GidenlerResponse.projects`

**Required by calculations:**
- `dashboard.php` → `build_project_cards()`: `id, title` joined with all 4 card finance tables to calculate `total_revenue, total_expenses, net_profit, outstanding_receivables, outstanding_payables`
- `project-statement.php` → full project P&L; `compute_statement_summary()` using all 4 card tables joined to project

**Foreign key / relationship role:**
- Referenced by: `ak_project_images.project_id`, `ak_media_library.related_project_id`, `ak_customer_projects.project_id`, `ak_payment_plans.project_id`, `ak_payments.project_id`, `ak_expenses.project_id`, `ak_financial_entries.project_id`, `ak_customer_financial_entries.project_id`, `ak_employee_financial_entries.project_id`, `ak_supplier_financial_entries.project_id`, `ak_expense_card_financial_entries.project_id`, `ak_project_expense_transactions.project_id`, `ak_employee_project_assignments.project_id`, `ak_employee_project_allocations.project_id`, `ak_notifications.related_project_id`

**Columns that appear required:** All columns (used by CMS + finance).

**Columns that appear optional:** `detailed_description, seo_title, seo_description, city, district, start_year, delivery_year, land_area, construction_area, apartment_count, floor_count, block_count` (optional CMS metadata)

**Deletion / cleanup recommendation:** Keep table — core table, cannot be touched.

---

### ak_project_images

**Status:** KEEP_SUPPORT

**Purpose:** Image gallery entries for projects, displayed on the public-facing site.

**Production / schema columns:**
`id, project_id, image_url, thumbnail_url, title, alt_text, sort_order, created_at`

**Required by PHP backend:**
- `project-images.php` — full SELECT/INSERT/UPDATE/DELETE; columns: `id, project_id, image_url, thumbnail_url, title, alt_text, sort_order`
- `upload-project-image.php` — writes to filesystem only, URL stored via project-images endpoint

**Required by frontend/API:**
- `getAdminProjectImages()`, `createAdminProjectImage()`, `updateAdminProjectImage()`, `deleteAdminProjectImage()` → `ProjectImage` type: `id, project_id, image_url, thumbnail_url, title, alt_text, sort_order`

**Foreign key / relationship role:** References `ak_projects.id` CASCADE DELETE.

**Columns that appear required:** `id, project_id, image_url, sort_order`

**Columns that appear optional:** `thumbnail_url, title, alt_text`

**Deletion / cleanup recommendation:** Keep table.

---

### ak_media_library

**Status:** KEEP_SUPPORT

**Purpose:** Central media library for all uploaded site images.

**Production / schema columns:**
`id, image_url, thumbnail_url, file_name, title, alt_text, related_project_id, created_at`

**Required by PHP backend:**
- `media.php` — SELECT all, DELETE; `media-upload.php` — INSERT

**Required by frontend/API:**
- `getAdminMedia()`, `uploadAdminMediaImage()`, `deleteAdminMediaImage()`, `deleteAdminMediaPath()` → `AdminMediaImage` type

**Foreign key / relationship role:** References `ak_projects.id` ON DELETE SET NULL.

**Columns that appear required:** `id, image_url, file_name, created_at`

**Columns that appear optional:** `thumbnail_url, title, alt_text, related_project_id`

**Deletion / cleanup recommendation:** Keep table.

---

### ak_site_settings

**Status:** KEEP_SUPPORT

**Purpose:** Single-row configuration for the public-facing site (contact info, SEO, hero text).

**Production / schema columns:**
`id, company_name, phone, whatsapp_number, email, address, map_embed_url, instagram_url, facebook_url, linkedin_url, footer_description, hero_title, hero_subtitle, whatsapp_message, seo_title, seo_description, updated_at`

**Required by PHP backend:**
- `site-settings.php` (public) — SELECT row
- `api/admin/site-settings.php` — SELECT + PATCH

**Required by frontend/API:**
- `getSiteSettings()`, `getAdminSiteSettings()`, `updateAdminSiteSettings()` → `SiteSettings` type
- `SiteSettings` includes `favicon_url` (TypeScript type) which has **no corresponding DB column** — this is a type-only field; no discrepancy on writes since it's not in the payload.

**Columns that appear required:** All displayed fields.

**Deletion / cleanup recommendation:** Keep table.

---

### ak_contact_requests

**Status:** KEEP_SUPPORT

**Purpose:** Stores contact form submissions from the public site.

**Production / schema columns:**
`id, full_name, phone, email, service_type, message, status, created_at`

**Required by PHP backend:**
- `contact-requests.php` (public) — INSERT
- `api/admin/contact-requests.php` — SELECT, PATCH `status`, DELETE
- `dashboard.php` — `SELECT COUNT(*) AS total_contact_requests`, `SUM(CASE WHEN status = 'Yeni' THEN 1 ELSE 0 END) AS new_contact_requests`
- `backend-canonical-read-model.php` — `SELECT id` (count only)

**Required by frontend/API:**
- `getAdminContactRequests()`, `updateAdminContactRequestStatus()`, `deleteAdminContactRequest()` → `AdminContactRequest` type

**Required by calculations:**
- Dashboard summary: `total_contact_requests`, `new_contact_requests`

**Columns that appear required:** All columns.

**Deletion / cleanup recommendation:** Keep table.

---

### ak_customers

**Status:** KEEP_CORE

**Purpose:** Customer master — links to projects, payment plans, financial entries, and notifications.

**Production / schema columns:**
`id, customer_type, full_name, company_name, phone, whatsapp, email, tax_or_identity_number, address, city, district, status, notes, created_at, updated_at`

**Required by PHP backend:**
- `customers.php` — full SELECT/INSERT/UPDATE/DELETE on all columns; also reads `ak_payment_plans` and `ak_payments` in the GET list/detail; writes `ak_customer_projects` in POST/PATCH
- `payment-plans.php` — FK validation: `customer_id`
- `payments.php` — FK validation: `customer_id`; `sync_customer_account_plan_statuses()` reads customer's plans
- `financial-statement.php` — SELECT entity: `id, customer_type, full_name, company_name, phone, email, tax_or_identity_number, status`
- `gelenler.php` — LEFT JOIN for `COALESCE(c.company_name, c.full_name) AS owner_name`; SELECT list for customer filter
- `dashboard.php` — `build_customer_cards()` LEFT JOIN; `fetch_customer_entries_overdue/upcoming` LEFT JOIN; `SELECT COUNT(*) AS total_customers`
- `reports.php` — SELECT `*`
- `backend-canonical-read-model.php` — SELECT `id` (count only)
- `customer-financial-entries.php` — FK validation

**Required by frontend/API:**
- `getAdminCustomersData()` → `AdminCustomerListResponse`: customers, payment_plans (partial), payments (partial), financial_entries, customer_projects, projects
- `getAdminCustomerDetail(id)` → `AdminCustomerDetailResponse`: customer + payment_plans + payments + financial_entries + expenses
- `createAdminCustomer()`, `updateAdminCustomer()`, `deleteAdminCustomer()` → `AdminCustomer` type
- All fields in `AdminCustomer` type

**Required by calculations:**
- Dashboard customer cards: `id, company_name, full_name` used with `ak_customer_financial_entries` joins

**Foreign key / relationship role:**
- Referenced by: `ak_customer_projects.customer_id`, `ak_payment_plans.customer_id`, `ak_payments.customer_id`, `ak_expenses.customer_id`, `ak_financial_entries.customer_id`, `ak_customer_financial_entries.customer_id`, `ak_notifications.related_customer_id`, `ak_customer_notes.customer_id`

**Columns that appear required:** `id, customer_type, full_name, company_name, phone, status, created_at, updated_at`

**Columns that appear optional:** `whatsapp, email, tax_or_identity_number, address, city, district, notes`

**Deletion / cleanup recommendation:** Keep table — core table.

---

### ak_customer_projects

**Status:** KEEP_CORE

**Purpose:** Many-to-many link between customers and projects.

**Production / schema columns:**
`id, customer_id, project_id, created_at`

**Required by PHP backend:**
- `customers.php` — SELECT `project_id WHERE customer_id=?`; DELETE + INSERT on create/update customer
- `reports.php` — SELECT `*`

**Required by frontend/API:**
- Returned in `AdminCustomerListResponse.customer_projects` and `AdminCustomerDetailResponse.links`
- `AdminCustomerProjectLink` type: `customer_id, project_id`

**Foreign key / relationship role:** References `ak_customers.id` and `ak_projects.id` both CASCADE DELETE.

**Columns that appear required:** `id, customer_id, project_id`

**Deletion / cleanup recommendation:** Keep table.

---

### ak_payment_plans

**Status:** LEGACY_KEEP

**Purpose:** Legacy customer receivable installment plans; still actively used by notifications, reports, customer detail, payments sync, and the legacy financial-statement.php.

**Production / schema columns:**
`id, customer_id, project_id, title, description, type, amount, paid_amount, currency, payment_method, transaction_reference, card_note, cheque_maturity_date, cheque_no, bank_name, promissory_maturity_date, account_type, date, status, notes, created_at, updated_at`

**Required by PHP backend:**
- `payment-plans.php` — full SELECT/INSERT/UPDATE/DELETE; all columns
- `payments.php` GET — SELECT `id, title, customer_id, project_id, amount, paid_amount, account_type, date AS due_date, status`; `sync_customer_account_plan_statuses()` reads + UPDATE `status`
- `customers.php` GET detail — SELECT `*`
- `customers.php` GET list — SELECT `id, customer_id, amount, paid_amount, payment_method, account_type, due_date, status`
- `notifications.php` — SELECT `id, title, amount, paid_amount, due_date, status, customer_id, project_id, account_type`; notification generation reads remaining amounts
- `financial-statement.php` GET — SELECT `*` for customer kind
- `reports.php` — SELECT `*`
- `backend-canonical-read-model.php` — SELECT all columns for diagnostic comparison
- `canonical-read-flags.php` — reads for legacy shadow comparison
- `ak_payment_plan_settlements` — FK: `payment_plan_id` ON DELETE RESTRICT

**Required by frontend/API:**
- `getAdminPaymentPlans()`, `createAdminPaymentPlan()`, `updateAdminPaymentPlan()`, `deleteAdminPaymentPlan()` — still in `apiClient.ts`
- `AdminPaymentPlan` type: all columns
- Route `/admin/odeme-planlari` → redirects to `/admin/musteriler` (page is deprecated in routing)
- `AdminCustomerDetailResponse.payment_plans`
- `AdminPaymentsResponse.payment_plans` (partial)
- `AdminFinanceSummaryResponse.payment_plans`
- `AdminReportsResponse.payment_plans`

**Required by calculations:**
- Notifications: remaining amount calculation triggers payment due/overdue alerts
- `payments.php` `sync_customer_account_plan_statuses()` — recalculates + writes `status` on every payment change
- `backend-canonical-read-model.php` — legacy diagnostic comparison

**Foreign key / relationship role:**
- References `ak_customers.id` ON DELETE RESTRICT, `ak_projects.id` ON DELETE RESTRICT
- Referenced by: `ak_payments.payment_plan_id` ON DELETE SET NULL, `ak_notifications.related_payment_plan_id` ON DELETE SET NULL, `ak_payment_plan_settlements.payment_plan_id` ON DELETE RESTRICT

**Columns that appear required:** `id, customer_id, project_id, title, amount, paid_amount, account_type, date, status`

**Columns that appear optional:** `description, type, currency, payment_method, transaction_reference, card_note, cheque_maturity_date, cheque_no, bank_name, promissory_maturity_date, notes`

**Deletion / cleanup recommendation:** Do not delete — still live. Notifications, reports, customer detail, and payment sync all read from this table. Must migrate notification logic to new card tables before this can be considered for removal.

---

### ak_payments

**Status:** LEGACY_KEEP

**Purpose:** Legacy customer payment receipts; still live for payment-plans.php sync, reports, notifications, and financial-statement.php.

**Production / schema columns:**
`id, customer_id, project_id, payment_plan_id, amount, account_type, payment_date, payment_method, description, document_url, created_at, updated_at`

**Required by PHP backend:**
- `payments.php` — full SELECT/INSERT/UPDATE/DELETE; also triggers `sync_customer_account_plan_statuses()` on write
- `customers.php` GET list — SELECT `customer_id, payment_plan_id, amount, account_type`
- `customers.php` GET detail — SELECT `*`
- `financial-statement.php` GET — SELECT legacy payment rows for customer/project; CONCAT as `legacy-payment-{id}`
- `notifications.php` — SELECT `customer_id, payment_plan_id, amount, account_type` for plan state computation
- `reports.php` — SELECT `*`
- `backend-canonical-read-model.php` — SELECT `amount, payment_date` for legacy summary
- `canonical-read-flags.php` — SELECT for diagnostic comparison

**Required by frontend/API:**
- `getAdminPaymentsData()`, `createAdminPayment()`, `updateAdminPayment()`, `deleteAdminPayment()` — still in `apiClient.ts`
- `AdminPayment` type: all columns
- Route `/admin/tahsilatlar` → redirects to `/admin/gelenler`
- `AdminCustomerDetailResponse.payments`, `AdminPaymentsResponse.payments`

**Required by calculations:**
- `sync_customer_account_plan_statuses()`: payment amounts determine payment plan `status` (plan-level sync)
- Notification plan state: unlinked/linked payment bucketing

**Foreign key / relationship role:**
- References `ak_customers.id` ON DELETE SET NULL, `ak_projects.id` ON DELETE SET NULL, `ak_payment_plans.id` ON DELETE SET NULL
- Referenced by: `ak_payment_plan_settlements.financial_entry_id` (via `ak_financial_entries`, not directly)

**Columns that appear required:** `id, customer_id, amount, account_type, payment_date, payment_method`

**Columns that appear optional:** `project_id, payment_plan_id, description, document_url`

**Deletion / cleanup recommendation:** Do not delete — still live. The payment-sync logic that auto-updates payment plan statuses depends on this table. Must migrate plan-sync and notifications to new card tables first.

---

### ak_expenses

**Status:** LEGACY_KEEP

**Purpose:** Legacy project/customer expenses; still live via expenses.php full CRUD, reports, and financial-statement.php.

**Production / schema columns:**
`id, project_id, customer_id, title, category, amount, expense_date, description, document_url, created_at, updated_at`

**Required by PHP backend:**
- `expenses.php` — full SELECT/INSERT/UPDATE/DELETE; all columns
- `financial-statement.php` GET — SELECT rows for project/customer as legacy expense rows
- `reports.php` — SELECT `*`
- `backend-canonical-read-model.php` — SELECT `amount, expense_date`

**Required by frontend/API:**
- `getAdminExpensesData()`, `createAdminExpense()`, `updateAdminExpense()`, `deleteAdminExpense()` — still in `apiClient.ts`
- `AdminExpense` type: all columns
- Route `/admin/giderler` → redirects to `/admin/gidenler`
- `AdminExpensesResponse`, `AdminFinanceSummaryResponse.expenses`, `AdminReportsResponse.expenses`

**Required by calculations:**
- `backend-canonical-read-model.php` `canonical_read_expense_summary()`: `amount, expense_date` for legacy comparison

**Foreign key / relationship role:**
- References `ak_projects.id` ON DELETE SET NULL, `ak_customers.id` ON DELETE SET NULL

**Columns that appear required:** `id, title, amount, expense_date`

**Columns that appear optional:** `project_id, customer_id, category, description, document_url`

**Deletion / cleanup recommendation:** Do not delete — still live. Route is redirected but CRUD is accessible via API, and reports.php actively reads this table.

---

### ak_customer_notes

**Status:** DELETE_CANDIDATE_BUT_PROTECTED

**Purpose:** Schema-only customer note entries; no active queries found in any scanned PHP endpoint.

**Production / schema columns:**
`id, customer_id, note, created_at`

**Required by PHP backend:** None found.

**Required by frontend/API:** Not referenced.

**Foreign key / relationship role:** References `ak_customers.id` CASCADE DELETE.

**Deletion / cleanup recommendation:** No active usage. Safe to drop after owner confirms no external tool writes to it. Listed in CLAUDE.md as one of the three schema-only tables that can be dropped when safe.

---

### ak_notifications

**Status:** KEEP_CORE

**Purpose:** Notification inbox for the admin; auto-generated entries are driven by `ak_payment_plans` overdue/upcoming logic.

**Production / schema columns:**
`id, title, message, type, priority, related_customer_id, related_project_id, related_payment_plan_id, is_read, created_at`

**Required by PHP backend:**
- `notifications.php` — SELECT `*`; INSERT (auto-generate); UPDATE `is_read`; DELETE
- `dashboard.php` — `SELECT COUNT(*) AS unread_notifications WHERE is_read = 0`

**Required by frontend/API:**
- `getAdminNotifications()`, `updateAdminNotificationRead()`, `markAllAdminNotificationsRead()`, `deleteAdminNotification()`, `deleteAllAdminNotifications()` → `AdminNotification` type
- `AdminNotificationsResponse`: `notifications, unread_count, total_count`

**Required by calculations:**
- Notification generation reads `ak_payment_plans` and `ak_payments` to compute overdue/upcoming buckets, then INSERT notification rows per plan per day per type

**Foreign key / relationship role:**
- References `ak_customers.id` ON DELETE SET NULL, `ak_projects.id` ON DELETE SET NULL, `ak_payment_plans.id` ON DELETE SET NULL

**Columns that appear required:** `id, title, message, type, priority, is_read, created_at`

**Columns that appear optional:** `related_customer_id, related_project_id, related_payment_plan_id`

**Deletion / cleanup recommendation:** Keep table. If `ak_payment_plans` is ever dropped, the notification generation logic must first be migrated to use `ak_customer_financial_entries.is_overdue`.

---

### ak_employees

**Status:** KEEP_CORE

**Purpose:** Employee master; used by employee finance entries, roles, cost periods, project assignments, and allocations.

**Production / schema columns:**
`id, full_name, phone, role, notes, status, created_at, updated_at`

**Required by PHP backend:**
- `employees.php` — full SELECT/INSERT/UPDATE/DELETE
- `financial-statement.php` GET — SELECT `*` as entity; SELECT entries for employee kind
- `gidenler.php` — LEFT JOIN `e.full_name AS owner_name`
- `dashboard.php` — `build_personnel_cards()` LEFT JOIN `ak_employee_financial_entries`
- `employee-roles.php`, `employee-cost-periods.php`, `employee-project-assignments.php`, `employee-project-allocations.php` — FK validation
- `employee-financial-entries.php` — FK validation
- `reports.php` (indirectly via financial-statement)

**Required by frontend/API:**
- `getAdminEmployees()`, `createAdminEmployee()`, `updateAdminEmployee()`, `deleteAdminEmployee()` → `AdminEmployee` type
- `AdminEmployee` fields: `id, full_name, phone, role, notes, status, created_at, updated_at`

**Required by calculations:**
- Dashboard personnel cards: `id, full_name` joined with `ak_employee_financial_entries`

**Foreign key / relationship role:**
- Referenced by: `ak_employee_roles.employee_id`, `ak_employee_cost_periods.employee_id`, `ak_employee_project_assignments.employee_id`, `ak_employee_project_allocations.employee_id`, `ak_employee_financial_entries.employee_id`, `ak_financial_entries.employee_id`

**Columns that appear required:** `id, full_name, status, created_at, updated_at`

**Columns that appear optional:** `phone, role, notes`

**Deletion / cleanup recommendation:** Keep table.

---

### ak_roles

**Status:** KEEP_SUPPORT

**Purpose:** Lookup table for role definitions used in `ak_employee_roles`.

**Production / schema columns:**
`id, name, normalized_name, is_active, created_at`

**Required by PHP backend:**
- `roles.php` — SELECT/INSERT/PATCH (soft-delete via `is_active=0`)
- `employee-roles.php` — FK validation

**Required by frontend/API:**
- `getAdminRoles()`, `createAdminRole()`, `updateAdminRole()`, `deactivateAdminRole()` → `AkRole` type

**Foreign key / relationship role:**
- Referenced by: `ak_employee_roles.role_id` ON DELETE RESTRICT

**Columns that appear required:** `id, name, normalized_name, is_active`

**Deletion / cleanup recommendation:** Keep table.

---

### ak_employee_roles

**Status:** KEEP_SUPPORT

**Purpose:** Employee ↔ role assignment history with date ranges.

**Production / schema columns:**
`employee_id, role_id, assigned_at, ended_at`

**Required by PHP backend:**
- `employee-roles.php` — SELECT/INSERT/PATCH (end date)/DELETE

**Required by frontend/API:**
- `getEmployeeRoles()`, `assignEmployeeRole()`, `endEmployeeRole()`, `deleteEmployeeRole()` → `AkEmployeeRole` type

**Columns that appear required:** `employee_id, role_id, assigned_at`

**Columns that appear optional:** `ended_at` (NULL = currently active)

**Deletion / cleanup recommendation:** Keep table.

---

### ak_employee_cost_periods

**Status:** KEEP_SUPPORT

**Purpose:** Stores time-bounded salary/benefit breakdowns per employee; used by the allocation cost calculator.

**Production / schema columns:**
`id, employee_id, effective_from, effective_to, salary, sgk, meal, transportation, bonus, accommodation, other, notes, created_at`

**Required by PHP backend:**
- `employee-cost-periods.php` — SELECT/INSERT/PATCH (notes only)/DELETE
- `employee-project-allocations.php` — reads most recent cost period when computing allocation snapshots

**Required by frontend/API:**
- `getEmployeeCostPeriods()`, `createEmployeeCostPeriod()`, `updateEmployeeCostPeriodNotes()`, `deleteEmployeeCostPeriod()` → `AkEmployeeCostPeriod` type

**Columns that appear required:** `id, employee_id, effective_from, salary`

**Columns that appear optional:** `effective_to, sgk, meal, transportation, bonus, accommodation, other, notes`

**Deletion / cleanup recommendation:** Keep table.

---

### ak_employee_project_assignments

**Status:** KEEP_SUPPORT

**Purpose:** Records which employees are assigned to which projects with date ranges.

**Production / schema columns:**
`id, employee_id, project_id, start_date, end_date, notes, created_at`

**Required by PHP backend:**
- `employee-project-assignments.php` — SELECT/INSERT/PATCH (end_date, notes)/DELETE

**Required by frontend/API:**
- `getEmployeeAssignments()`, `getProjectAssignments()`, `createEmployeeAssignment()`, `updateEmployeeAssignment()`, `deleteEmployeeAssignment()` → `AkEmployeeProjectAssignment` type

**Columns that appear required:** `id, employee_id, project_id, start_date`

**Columns that appear optional:** `end_date, notes`

**Deletion / cleanup recommendation:** Keep table.

---

### ak_employee_project_allocations

**Status:** KEEP_SUPPORT

**Purpose:** Monthly cost allocation snapshots — apportions an employee's total cost across projects based on days worked; feeds project cost calculations.

**Production / schema columns:**
`id, employee_id, project_id, allocation_year, allocation_month, days_worked, working_days_base, cost_date, salary_snapshot, sgk_snapshot, meal_snapshot, transportation_snapshot, bonus_snapshot, accommodation_snapshot, other_snapshot, monthly_cost_snapshot, calculated_cost, notes, created_at, updated_at`

**Required by PHP backend:**
- `employee-project-allocations.php` — SELECT/INSERT/PATCH/DELETE; reads `ak_employee_cost_periods` to compute snapshot columns

**Required by frontend/API:**
- `getProjectAllocations()`, `getEmployeeAllocations()`, `createEmployeeAllocation()`, `updateEmployeeAllocation()`, `deleteEmployeeAllocation()` → `AkEmployeeProjectAllocation` type; all snapshot columns

**Columns that appear required:** All columns (snapshots are immutable cost records).

**Deletion / cleanup recommendation:** Keep table.

---

### ak_expense_cards

**Status:** KEEP_CORE

**Purpose:** Named expense card master (e.g. fuel card, site tools card); FK parent for `ak_expense_card_financial_entries` and `ak_project_expense_transactions`; also referenced by `ak_financial_entries`.

**Production / schema columns:**
`id, name`

**⚠️ Schema/code discrepancy:** `dashboard.php` line 614 queries `ec.category` from this table via `LEFT JOIN ak_expense_cards ec`. The schema defines only `id` and `name`. If the production DB has no `category` column, the `build_expense_category_intelligence()` function will fail (PDOException). **Owner must confirm whether `category` exists in production.**

**Required by PHP backend:**
- `expense-cards.php` — SELECT/INSERT/PATCH/DELETE
- `financial-statement.php` — SELECT `*`; entity lookup
- `gidenler.php` — LEFT JOIN `ec.name AS owner_name`
- `project-expense-transactions.php` — FK validation
- `dashboard.php` — `build_expense_category_intelligence()` LEFT JOIN querying `ec.category` (**discrepancy**)

**Required by frontend/API:**
- `getAdminExpenseItems()` / `getAdminExpenseCards()` (alias), `createAdminExpenseItem()`, `updateAdminExpenseItem()`, `deleteAdminExpenseItem()` → `AdminExpenseCard` type: `id, name`
- Referenced by `getProjectExpenseTransactions()` result, `AdminExpenseCardsResponse`

**Foreign key / relationship role:**
- Referenced by: `ak_expense_card_financial_entries.expense_card_id` ON DELETE RESTRICT, `ak_project_expense_transactions.expense_item_id` ON DELETE SET NULL, `ak_financial_entries.expense_card_id` ON DELETE SET NULL

**Columns that appear required:** `id, name`

**Columns that appear optional (or potentially missing):** `category` — referenced in code but not in schema. **Requires investigation.**

**Deletion / cleanup recommendation:** Keep table — FK parent for active finance tables.

---

### ak_suppliers

**Status:** KEEP_CORE

**Purpose:** New supplier master for the card-based finance architecture; FK parent for `ak_supplier_financial_entries`.

**Production / schema columns:**
`id, name, supplier_type, contact_person, phone, whatsapp, email, tax_no, address, city, district, notes, is_active, created_at, updated_at`

**Required by PHP backend:**
- `suppliers.php` — full SELECT/INSERT/UPDATE/DELETE; all columns; `supplier_type` validated against allowed list
- `gidenler.php` — LEFT JOIN `s.name AS owner_name`
- `supplier-financial-entries.php` — FK validation
- `dashboard.php` — `build_supplier_cards()` LEFT JOIN `ak_supplier_financial_entries`

**Required by frontend/API:**
- `getAdminSuppliers()`, `getAdminSupplier()`, `createAdminSupplier()`, `updateAdminSupplier()`, `deleteAdminSupplier()` → `AdminSupplier` type: all columns
- `AdminSuppliersResponse`, `AdminSupplierResponse`
- `SupplierType` enum: `supplier | subcontractor | labor_service | equipment_rental | crane_rental | other`

**Required by calculations:**
- Dashboard supplier cards: `id, name` joined with `ak_supplier_financial_entries` for `total_purchases, total_paid, remaining_payable, overdue_payable`

**Foreign key / relationship role:**
- Referenced by: `ak_supplier_financial_entries.supplier_id` ON DELETE RESTRICT

**Columns that appear required:** `id, name, supplier_type, is_active, created_at, updated_at`

**Columns that appear optional:** `contact_person, phone, whatsapp, email, tax_no, address, city, district, notes`

**Deletion / cleanup recommendation:** Keep table — new core architecture.

---

### ak_customer_financial_entries

**Status:** KEEP_CORE

**Purpose:** Card-based receivable entries per customer; the primary income table in the new architecture; replaces `ak_payments` + `ak_payment_plans` for new data.

**Production / schema columns:**
`id, customer_id, project_id, title, notes, entry_date, amount, paid_amount, currency, exchange_rate_to_try, exchange_rate_source, exchange_rate_snapshot_at, is_exchange_rate_manual, amount_try, paid_amount_try, account_type, payment_method, status, is_overdue, created_at, updated_at`

**Required by PHP backend:**
- `customer-financial-entries.php` — full SELECT/INSERT/UPDATE/DELETE; all columns
- `gelenler.php` — SELECT `cfe.*` + LEFT JOINs; all columns
- `dashboard.php` — `compute_finance_summary()`: `amount_try, paid_amount_try, entry_date, is_overdue, status`; `fetch_customer_entries_overdue/upcoming()`: same columns; `build_customer_cards()` JOIN
- `project-statement.php` — full column SELECT for income side
- `customers.php` — SELECT `id, customer_id, amount_try, paid_amount_try, account_type, entry_date WHERE status <> 'İptal'`

**Required by frontend/API:**
- `getCustomerFinancialEntries()`, `createCustomerFinancialEntry()`, `updateCustomerFinancialEntry()`, `deleteCustomerFinancialEntry()` → `CustomerFinancialEntry` type (extends `CardFinancialEntry`)
- All `CardFinancialEntry` fields: `id, project_id, entry_date, title, notes, amount, paid_amount, currency, exchange_rate_to_try, exchange_rate_source, exchange_rate_snapshot_at, is_exchange_rate_manual, amount_try, paid_amount_try, account_type, payment_method, status, is_overdue, created_at, updated_at`
- Plus `customer_id` (CustomerFinancialEntry extension)
- Used in `GelenlerResponse.entries`, `AdminCustomerDetailResponse` (via customers.php synthetic mapping)

**Required by calculations:**
- Dashboard finance summary: `amount_try` (planned income), `paid_amount_try` (realized income), `is_overdue`, `entry_date` (monthly breakdown)
- Project statement: `amount_try, paid_amount_try` (income rows)
- Customer cards: `amount_try, paid_amount_try, is_overdue, status`

**Foreign key / relationship role:**
- References `ak_customers.id` ON DELETE RESTRICT
- References `ak_projects.id` ON DELETE RESTRICT

**Columns that appear required:** All non-nullable columns (the 4 card finance tables share an identical schema; all columns actively used).

**Columns that appear optional:** `notes, exchange_rate_snapshot_at` (NULL for TRY entries)

**Deletion / cleanup recommendation:** Keep table — primary income table for new architecture.

---

### ak_employee_financial_entries

**Status:** KEEP_CORE

**Purpose:** Card-based expense entries per employee (salary, advance, etc.); expense side of new architecture.

**Production / schema columns:**
Same structure as `ak_customer_financial_entries` but with `employee_id` instead of `customer_id`.

**Required by PHP backend:**
- `employee-financial-entries.php` — full SELECT/INSERT/UPDATE/DELETE
- `gidenler.php` — SELECT with LEFT JOIN `e.full_name`
- `dashboard.php` — `compute_finance_summary()` expense side; `build_personnel_cards()` JOIN
- `project-statement.php` — expense rows

**Required by frontend/API:**
- `getEmployeeFinancialEntries()`, `createEmployeeFinancialEntry()`, `updateEmployeeFinancialEntry()`, `deleteEmployeeFinancialEntry()` → `EmployeeFinancialEntry` type
- Used in `GidenlerResponse.entries`, `AdminEmployeeDetail` page

**Required by calculations:**
- Dashboard: expense totals, monthly expense, personnel cards

**Foreign key / relationship role:**
- References `ak_employees.id` ON DELETE RESTRICT
- References `ak_projects.id` ON DELETE RESTRICT

**Deletion / cleanup recommendation:** Keep table.

---

### ak_supplier_financial_entries

**Status:** KEEP_CORE

**Purpose:** Card-based expense entries per supplier; expense side of new architecture.

**Production / schema columns:**
Same structure as `ak_customer_financial_entries` but with `supplier_id`.

**Required by PHP backend:**
- `supplier-financial-entries.php` — full SELECT/INSERT/UPDATE/DELETE
- `gidenler.php` — SELECT with LEFT JOIN `s.name`
- `dashboard.php` — `compute_finance_summary()` expense side; `build_supplier_cards()` JOIN; drilldown
- `project-statement.php` — expense rows

**Required by frontend/API:**
- `getSupplierFinancialEntries()`, `createSupplierFinancialEntry()`, `updateSupplierFinancialEntry()`, `deleteSupplierFinancialEntry()` → `SupplierFinancialEntry` type
- Used in `GidenlerResponse.entries`, `AdminSupplierDetail` page

**Foreign key / relationship role:**
- References `ak_suppliers.id` ON DELETE RESTRICT
- References `ak_projects.id` ON DELETE RESTRICT

**Deletion / cleanup recommendation:** Keep table.

---

### ak_expense_card_financial_entries

**Status:** KEEP_CORE

**Purpose:** Card-based expense entries per expense card (petty cash, fuel card, etc.); expense side of new architecture.

**Production / schema columns:**
Same structure as `ak_customer_financial_entries` but with `expense_card_id`.

**Required by PHP backend:**
- `expense-card-financial-entries.php` — full SELECT/INSERT/UPDATE/DELETE
- `gidenler.php` — SELECT with LEFT JOIN `ec.name`
- `dashboard.php` — `compute_finance_summary()` expense side; `build_expense_category_intelligence()` LEFT JOIN referencing `ec.category` (**discrepancy**)
- `project-statement.php` — expense rows

**Required by frontend/API:**
- `getExpenseCardFinancialEntries()`, `createExpenseCardFinancialEntry()`, `updateExpenseCardFinancialEntry()`, `deleteExpenseCardFinancialEntry()` → `ExpenseCardFinancialEntry` type
- Used in `GidenlerResponse.entries`, `AdminExpenseCardFinance` page

**Foreign key / relationship role:**
- References `ak_expense_cards.id` ON DELETE RESTRICT
- References `ak_projects.id` ON DELETE RESTRICT

**Deletion / cleanup recommendation:** Keep table.

---

### ak_project_expense_transactions

**Status:** LEGACY_KEEP

**Purpose:** Originally designed for project-level expense tracking by expense card item; labeled as LEGACY/DEPRECATED in `install-schema.php` comments. Still has active CRUD endpoint and UI page.

**Production / schema columns:**
`id, project_id, expense_item_id, expense_item_name_snapshot, amount, currency, exchange_rate_snapshot, exchange_rate_overridden, expense_date, created_at, updated_at`

**Required by PHP backend:**
- `project-expense-transactions.php` — full SELECT/INSERT/UPDATE/DELETE

**Required by frontend/API:**
- `getProjectExpenseTransactions()`, `createProjectExpenseTransaction()`, `updateProjectExpenseTransaction()`, `deleteProjectExpenseTransaction()` → `AkExpenseTransaction` type
- `AkExpenseTransactionsResponse`: `transactions, profitability, project`
- Used by `AdminProjectExpenses` page at route `/admin/projeler/:id/giderler`

**Foreign key / relationship role:**
- References `ak_projects.id` ON DELETE RESTRICT, `ak_expense_cards.id` ON DELETE SET NULL

**Columns that appear required:** `id, project_id, expense_item_name_snapshot, amount, currency, expense_date`

**Columns that appear optional:** `expense_item_id` (nullable), `exchange_rate_snapshot, exchange_rate_overridden`

**Deletion / cleanup recommendation:** OWNER_DECISION — labeled deprecated in schema but UI page `/admin/projeler/:id/giderler` still exists and is reachable. Owner must decide: retire the page and drop, or keep.

---

### ak_financial_entries

**Status:** LEGACY_KEEP

**Purpose:** Legacy unified finance ledger (canonical model attempt); still has active full CRUD via `financial-statement.php`; read by `reports.php` and `backend-canonical-read-model.php` diagnostic comparison.

**Production / schema columns:**
`id, project_id, entry_date, business_transaction_id, event_type, source_type, source_id, source_version, payment_plan_id, parent_entry_id, counterparty_type, counterparty_id, account_type, allocation_scope, allocation_note, transaction_date, due_date, exchange_rate, base_amount, category_code, subcategory_code, document_id, migration_confidence, reconciliation_status, archived_at, archived_by, canceled_at, canceled_by, cancellation_reason, reversal_entry_id, card_type, customer_id, employee_id, expense_card_id, title, description, amount, currency_tag, group_tag, direction, status, document_url, created_at, updated_at`

**Required by PHP backend:**
- `financial-statement.php` — SELECT `*`; INSERT; UPDATE; DELETE (full CRUD)
- `reports.php` — SELECT `*`
- `backend-canonical-read-model.php` — SELECT `id, amount, currency_tag, direction, status, entry_date` for diagnostic shadow comparison
- `canonical-read-flags.php` — legacy shadow comparison gating

**Required by frontend/API:**
- `getAdminFinancialStatement()`, `createAdminFinancialEntry()`, `updateAdminFinancialEntry()`, `deleteAdminFinancialEntry()` → `AdminFinancialEntry` type
- `AdminFinancialEntry` fields: `id, project_id, entry_date, due_date, card_type, customer_id, employee_id, expense_card_id, title, description, amount, currency_tag, group_tag, direction, status, document_url`
- Used in `AdminCustomerDetailResponse.financial_entries`, `AdminFinanceSummaryResponse.financial_entries`, `AdminReportsResponse.financial_entries`
- `AdminFinance` page at `/admin/finans-dashboard` — still an active route writing to this table

**Foreign key / relationship role:**
- References `ak_projects.id` ON DELETE SET NULL, `ak_customers.id` ON DELETE SET NULL, `ak_employees.id` ON DELETE SET NULL, `ak_expense_cards.id` ON DELETE SET NULL
- Referenced by: `ak_payment_plan_settlements.financial_entry_id` ON DELETE RESTRICT

**Columns that appear required:** `id, entry_date, card_type, title, amount, currency_tag, group_tag, direction, status`

**Columns that appear optional:** Most of the 30+ diagnostic/audit columns (`business_transaction_id, event_type, source_type, source_id, source_version, payment_plan_id, parent_entry_id, counterparty_type, counterparty_id, allocation_scope, allocation_note, transaction_date, exchange_rate, base_amount, category_code, subcategory_code, document_id, migration_confidence, reconciliation_status, archived_at, archived_by, canceled_at, canceled_by, cancellation_reason, reversal_entry_id`) — none of these are populated by the current `financial_entry_payload()` function in `financial-statement.php`.

**Columns that appear unused or unclear:** All 20+ migration/reconciliation/audit tracking columns. They exist in schema but no PHP code writes to them.

**Deletion / cleanup recommendation:** Do not delete yet. `AdminFinance` page at `/admin/finans-dashboard` still writes to it. `reports.php` reads it. Must retire `financial-statement.php` POST/PATCH and migrate `AdminFinance` page before this can be considered for removal. The `ak_payment_plan_settlements` FK ON DELETE RESTRICT also blocks dropping.

---

### ak_payment_plan_settlements

**Status:** LEGACY_KEEP

**Purpose:** Links payment plans to financial entries for settlement tracking; no active write path in current codebase (no endpoint calls INSERT into this table).

**Production / schema columns:**
`id, payment_plan_id, financial_entry_id, allocated_amount, currency, account_type, created_by, created_at, reversed_at, reversed_by, reversal_reason, active_pair_guard` (generated column)

**Required by PHP backend:** No INSERT/UPDATE/DELETE found in any scanned file. Schema only exists as a structured constraint.

**Required by frontend/API:** Not referenced in `apiClient.ts` or `apiTypes.ts`.

**Foreign key / relationship role:**
- References `ak_payment_plans.id` ON DELETE RESTRICT
- References `ak_financial_entries.id` ON DELETE RESTRICT
- References `ak_admin_users.id` (created_by, reversed_by) ON DELETE RESTRICT
- These RESTRICT constraints mean: `ak_payment_plans` and `ak_financial_entries` **cannot be dropped** while this table exists with data.

**Deletion / cleanup recommendation:** OWNER_DECISION — No active write path. If no rows exist in production, this table can be dropped first (before `ak_payment_plans` and `ak_financial_entries`). Must verify row count in production before any action.

---

### ak_cookie_consents

**Status:** KEEP_SUPPORT

**Purpose:** Stores visitor cookie consent choices from the public-facing site banner.

**Production / schema columns:**
`id, consent_status, necessary, analytics, marketing, user_agent, created_at`

**Required by PHP backend:**
- `cookie-consent.php` (public) — INSERT on visitor consent action

**Required by frontend/API:**
- `submitCookieConsent()` → `CookieConsentPayload` type

**Columns that appear required:** `id, consent_status, necessary, analytics, marketing`

**Columns that appear optional:** `user_agent`

**Deletion / cleanup recommendation:** Keep table.

---

## Active Finance Flow Map

```
New card-based architecture (ACTIVE):

  Customer income:
    ak_customer_financial_entries
    ↑ Created via: customer-financial-entries.php POST
    ↑ Viewed via: gelenler.php (global), customer-financial-entries.php (per customer/project)
    ↑ Used in: dashboard.php (income totals), project-statement.php (income side)

  Employee expenses:
    ak_employee_financial_entries
    ↑ Created via: employee-financial-entries.php POST
    ↑ Viewed via: gidenler.php (global), employee-financial-entries.php (per employee/project)
    ↑ Used in: dashboard.php (expense totals), project-statement.php (expense side)

  Supplier expenses:
    ak_supplier_financial_entries
    ↑ Created via: supplier-financial-entries.php POST
    ↑ Viewed via: gidenler.php (global), supplier-financial-entries.php (per supplier/project)
    ↑ Used in: dashboard.php (expense totals), project-statement.php (expense side)

  Expense card expenses:
    ak_expense_card_financial_entries
    ↑ Created via: expense-card-financial-entries.php POST
    ↑ Viewed via: gidenler.php (global), expense-card-financial-entries.php (per card/project)
    ↑ Used in: dashboard.php (expense totals), project-statement.php (expense side)

  /admin/gelenler         → customer financial entries only
  /admin/gidenler         → employee + supplier + expense card entries (UNION ALL)
  /admin/projeler/:id/finans → project-statement.php UNION ALL of all 4 tables
  /admin (dashboard)      → all 4 tables for income/expense totals, cards, drilldowns
```

```
Legacy finance flows still LIVE:

  financial-statement.php:
    → Reads: ak_financial_entries (all), ak_payments (legacy rows), ak_expenses (legacy rows)
    → Reads: ak_payment_plans (for customer kind), ak_payments (for customer kind)
    → Writes: ak_financial_entries (POST/PATCH/DELETE)
    → Used by: /admin/finans-dashboard (AdminFinance page — ACTIVE ROUTE)

  payment-plans.php:
    → Reads/Writes: ak_payment_plans (full CRUD)
    → Route /admin/odeme-planlari REDIRECTS to /admin/musteriler
    → But API functions still in apiClient.ts; customer detail page reads payment_plans

  payments.php:
    → Reads/Writes: ak_payments (full CRUD)
    → Writes: ak_payment_plans.status (sync on every payment write)
    → Route /admin/tahsilatlar REDIRECTS to /admin/gelenler
    → API functions still in apiClient.ts

  expenses.php:
    → Reads/Writes: ak_expenses (full CRUD)
    → Route /admin/giderler REDIRECTS to /admin/gidenler
    → API functions still in apiClient.ts

  reports.php:
    → Reads: ak_payment_plans, ak_payments, ak_expenses, ak_financial_entries, ak_customers, ak_projects, ak_customer_projects, ak_contact_requests
    → Used by: /admin/raporlar (AdminReports — ACTIVE ROUTE)

  notifications.php:
    → Reads: ak_payment_plans, ak_payments (for overdue/upcoming plan states)
    → Writes: ak_notifications (auto-generation)
    → Used by: every page (header notification bell)
```

---

## Frontend Route / API Matrix

| Route / Page | Component | API client function(s) | PHP endpoint(s) | Main table(s) | Writes legacy finance? |
|---|---|---|---|---|---|
| `/admin` | AdminDashboard | `getAdminDashboard()` | `dashboard.php` | ak_customer_financial_entries, ak_employee_financial_entries, ak_supplier_financial_entries, ak_expense_card_financial_entries, ak_projects, ak_contact_requests, ak_notifications, ak_customers | **No** (new tables only) |
| `/admin/musteriler` | AdminCustomers | `getAdminCustomersData()` | `customers.php` | ak_customers, ak_customer_projects, ak_payment_plans (read), ak_payments (read), ak_customer_financial_entries (read, summarized) | No (reads only) |
| `/admin/musteriler/:id` | AdminCustomerDetail | `getAdminCustomerDetail()`, `getCustomerFinancialEntries()`, `createCustomerFinancialEntry()`, `updateCustomerFinancialEntry()`, `deleteCustomerFinancialEntry()` | `customers.php`, `customer-financial-entries.php` | ak_customers, ak_payment_plans (read), ak_payments (read), ak_customer_financial_entries (write) | Reads ak_payment_plans + ak_payments; **does not write** to them |
| `/admin/musteriler/:id/finans` | FinancRedirect | _(redirect)_ | — | — | No (redirects) |
| `/admin/gelenler` | AdminGelenler | `getGelenler()` | `gelenler.php` | ak_customer_financial_entries | No |
| `/admin/gidenler` | AdminGidenler | `getGidenler()` | `gidenler.php` | ak_employee_financial_entries, ak_supplier_financial_entries, ak_expense_card_financial_entries | No |
| `/admin/tedarikciler` | AdminSuppliers | `getAdminSuppliers()` | `suppliers.php` | ak_suppliers | No |
| `/admin/tedarikciler/:id` | AdminSupplierDetail | `getAdminSupplier()`, `getSupplierFinancialEntries()`, `createSupplierFinancialEntry()` etc. | `suppliers.php`, `supplier-financial-entries.php` | ak_suppliers, ak_supplier_financial_entries | No |
| `/admin/personeller` | AdminEmployees | `getAdminEmployees()` | `employees.php` | ak_employees | No |
| `/admin/personeller/:id` | AdminEmployeeDetail | `getEmployeeRoles()`, `getEmployeeCostPeriods()`, `getEmployeeAssignments()`, `getEmployeeAllocations()`, `getEmployeeFinancialEntries()`, `createEmployeeFinancialEntry()` etc. | `employees.php`, `employee-roles.php`, `employee-cost-periods.php`, `employee-project-assignments.php`, `employee-project-allocations.php`, `employee-financial-entries.php` | ak_employees, ak_roles, ak_employee_roles, ak_employee_cost_periods, ak_employee_project_assignments, ak_employee_project_allocations, ak_employee_financial_entries | No |
| `/admin/personeller/:id/finans` | FinancRedirect | _(redirect)_ | — | — | No (redirects) |
| `/admin/projeler` | AdminProjects | `getAdminProjects()` | `projects.php` | ak_projects | No |
| `/admin/projeler/:id` | AdminProjectEdit | `getAdminProject()`, `updateAdminProject()` etc. | `projects.php` | ak_projects | No |
| `/admin/projeler/:id/finans` | AdminProjectFinance | `getProjectStatement()` | `project-statement.php` | ak_customer_financial_entries, ak_employee_financial_entries, ak_supplier_financial_entries, ak_expense_card_financial_entries | No |
| `/admin/projeler/:id/giderler` | AdminProjectExpenses | `getProjectExpenseTransactions()`, `createProjectExpenseTransaction()` etc. | `project-expense-transactions.php` | ak_project_expense_transactions, ak_expense_cards | No (writes to legacy-labeled table) |
| `/admin/gider-kartlari` | AdminExpenseCards | `getAdminExpenseItems()`, `createAdminExpenseItem()` etc. | `expense-cards.php` | ak_expense_cards | No |
| `/admin/gider-kartlari/:id/finans` | AdminExpenseCardFinance | `getExpenseCardFinancialEntries()`, `createExpenseCardFinancialEntry()` etc. | `expense-card-financial-entries.php` | ak_expense_card_financial_entries | No |
| `/admin/finans-dashboard` | AdminFinance | `getAdminFinancialStatement()`, `createAdminFinancialEntry()`, `updateAdminFinancialEntry()`, `deleteAdminFinancialEntry()` | `financial-statement.php` | **ak_financial_entries (WRITE)**, ak_payments (read), ak_expenses (read), ak_payment_plans (read) | **YES — writes ak_financial_entries** |
| `/admin/raporlar` | AdminReports | `getAdminReportsData()` | `reports.php` | ak_customers, ak_payment_plans, ak_payments, ak_expenses, **ak_financial_entries**, ak_projects, ak_customer_projects, ak_contact_requests | No (read-only) |
| `/admin/bildirimler` | AdminNotifications | `getAdminNotifications()`, `updateAdminNotificationRead()` etc. | `notifications.php` | ak_notifications; reads ak_payment_plans + ak_payments for generation | No (read legacy, writes notifications) |
| `/admin/odeme-planlari` | Navigate | _(redirect)_ | — | — | No (redirects to musteriler) |
| `/admin/tahsilatlar` | Navigate | _(redirect)_ | — | — | No (redirects to gelenler) |
| `/admin/giderler` | Navigate | _(redirect)_ | — | — | No (redirects to gidenler) |

**Note on route name discrepancy:** The task specification refers to `/admin/masraf-kartlari` and `/admin/masraf-kartlari/:id/finans`. The actual routes in `App.tsx` are `/admin/gider-kartlari` and `/admin/gider-kartlari/:id/finans`. There is no `/admin/masraf-kartlari` route.

**Dead code imports:** `AdminCollections`, `AdminPaymentPlans`, `AdminExpenses` are lazily imported in `App.tsx` but their routes redirect to other pages. These components are not rendered by any live route. They still exist in the codebase and contain `apiClient.ts` calls that write to `ak_payments`, `ak_payment_plans`, and `ak_expenses` respectively — but they cannot be reached via the UI.

---

## Final Risk Summary

### 1. Which tables/columns are definitely required?

**Cannot be touched:**
- `ak_admin_users` — auth
- `ak_projects` — referenced by every finance table as a FK
- `ak_customers`, `ak_customer_projects` — customer management
- `ak_employees`, `ak_roles`, `ak_employee_roles`, `ak_employee_cost_periods`, `ak_employee_project_assignments`, `ak_employee_project_allocations` — employee management
- `ak_expense_cards` — FK parent for 2 finance tables
- `ak_suppliers` — FK parent for supplier entries
- `ak_customer_financial_entries` — primary income table (dashboard, project statement, gelenler)
- `ak_employee_financial_entries` — primary expense table (dashboard, project statement, gidenler)
- `ak_supplier_financial_entries` — primary expense table (dashboard, project statement, gidenler)
- `ak_expense_card_financial_entries` — primary expense table (dashboard, project statement, gidenler)
- `ak_notifications` — notification system
- `ak_site_settings`, `ak_contact_requests`, `ak_project_images`, `ak_media_library`, `ak_cookie_consents` — site operation

### 2. Which legacy tables are still live?

All four legacy finance tables are actively used:

| Table | Still written by | Still read by |
|---|---|---|
| `ak_payment_plans` | `payment-plans.php` (CRUD), `payments.php` (status sync) | `customers.php`, `notifications.php`, `financial-statement.php`, `reports.php`, `backend-canonical-read-model.php` |
| `ak_payments` | `payments.php` (CRUD) | `customers.php`, `notifications.php`, `financial-statement.php`, `reports.php`, `backend-canonical-read-model.php` |
| `ak_expenses` | `expenses.php` (CRUD) | `financial-statement.php`, `reports.php`, `backend-canonical-read-model.php` |
| `ak_financial_entries` | `financial-statement.php` (CRUD) | `reports.php`, `backend-canonical-read-model.php` |

### 3. Which frontend pages still risk writing to legacy finance tables?

| Page | Route | Legacy write risk |
|---|---|---|
| AdminFinance | `/admin/finans-dashboard` | **HIGH** — `createAdminFinancialEntry()` writes to `ak_financial_entries` directly |
| AdminCustomerDetail | `/admin/musteriler/:id` | LOW — reads `ak_payment_plans` and `ak_payments` from customers.php but does not write them through this page |
| AdminReports | `/admin/raporlar` | None — read-only |
| AdminNotifications | `/admin/bildirimler` | Indirect — triggers `ensure_payment_notifications()` which reads `ak_payment_plans` + `ak_payments` |
| Dead code (not reachable) | _(no route)_ | AdminCollections writes `ak_payments`; AdminPaymentPlans writes `ak_payment_plans`; AdminExpenses writes `ak_expenses` |

### 4. Which tables are protected and must not be deleted?

Per CLAUDE.md audit rules and FK constraints:
- `ak_admin_users`, `ak_profiles`, `ak_user_roles` — protected by explicit CLAUDE.md instruction
- `ak_payment_plan_settlements` — references `ak_payment_plans` and `ak_financial_entries` with ON DELETE RESTRICT; must be dropped or emptied before those tables can be considered

### 5. Which table cleanup decisions require owner approval?

| Table | Decision needed |
|---|---|
| `ak_profiles` | Confirm no external tool writes to it; then safe to drop |
| `ak_user_roles` | Same as above |
| `ak_customer_notes` | Confirm no external tool writes; safe to drop |
| `ak_payment_plan_settlements` | Verify row count in production; if empty, drop first (unblocks payment plan + financial entry cleanup) |
| `ak_project_expense_transactions` | Decide: keep `/admin/projeler/:id/giderler` page, or retire it and drop table |
| `ak_financial_entries` | Cannot drop until: (a) `AdminFinance` page is retired or migrated to new card tables, (b) `reports.php` stops reading it, (c) `ak_payment_plan_settlements` is emptied/dropped |
| `ak_payment_plans` | Cannot drop until: (a) `notifications.php` generation is migrated to `ak_customer_financial_entries.is_overdue`, (b) `customers.php` detail no longer returns them, (c) `ak_payment_plan_settlements` is cleared, (d) `financial-statement.php` customer logic is migrated |
| `ak_payments` | Cannot drop until: `ak_payment_plans` sync logic is removed and notification generation no longer reads payments |
| `ak_expenses` | Cannot drop until: `reports.php` and `financial-statement.php` no longer read it |

### 6. What must be migrated before any legacy finance table can be dropped?

In dependency order:

1. **Retire `AdminFinance` (`/admin/finans-dashboard`)** or redirect it to a new page — this is the only active route that writes to `ak_financial_entries`.

2. **Migrate `notifications.php` generation** from `ak_payment_plans` + `ak_payments` to `ak_customer_financial_entries.is_overdue` — this unblocks plan notification dependency.

3. **Remove `ak_payment_plans` and `ak_payments` from `customers.php`** GET response — the customer detail page currently returns these and some component likely reads them.

4. **Update `reports.php`** to not read `ak_payment_plans, ak_payments, ak_expenses, ak_financial_entries` — or accept that reports page will be deprecated.

5. **Empty or drop `ak_payment_plan_settlements`** — ON DELETE RESTRICT FKs block dropping `ak_payment_plans` and `ak_financial_entries`.

6. Once the above are done, drop in order:
   - `ak_payment_plan_settlements` (if not already)
   - `ak_financial_entries`
   - `ak_payment_plans`
   - `ak_payments`
   - `ak_expenses`
   - `ak_customer_notes`, `ak_profiles`, `ak_user_roles` (no-query tables, after owner confirmation)

---

## Additional Flags

### ⚠️ Critical: `ak_expense_cards.category` column discrepancy

`dashboard.php` `build_expense_category_intelligence()` at line ~614 queries:
```sql
SELECT COALESCE(ec.category, 'Diğer / Kategorisiz') AS category
FROM ak_expense_card_financial_entries t
LEFT JOIN ak_expense_cards ec ON ec.id = t.expense_card_id
GROUP BY category
```

The `install-schema.php` schema for `ak_expense_cards` has only `id` and `name`. If the production DB has no `category` column, this query will throw a PDOException on every dashboard load, causing the entire dashboard to fail with a 500 error. The outer catch block in `dashboard.php` would return `json_error('Dashboard verileri alınamadı.', 500)`.

**Action required:** Run `SHOW COLUMNS FROM ak_expense_cards` on production to confirm whether `category` exists. If it does not exist, either: (a) add the column, or (b) remove the `ec.category` reference from `dashboard.php` and fall back to `'Diğer / Kategorisiz'` for all expense card entries.

---

## Audit Statistics

- **Files scanned:** ~60+ (install-schema.php + 55 PHP endpoints + App.tsx + apiClient.ts + apiTypes.ts + seed script)
- **Files created:** `docs/DB_SCHEMA_FRONTEND_CONTRACT_AUDIT.md` (this file)
- **Confidence level:** HIGH for backend-DB contract (direct file reads); MEDIUM for frontend component behavior (inferred from apiClient.ts function calls; individual React component files not read)
- **Biggest unknowns:**
  1. Whether `ak_expense_cards.category` column exists in production (could be a live bug)
  2. Whether `ak_payment_plan_settlements` has any rows in production (blocks table cleanup order)
  3. Which React pages (`AdminCustomerDetail`, `AdminSupplierDetail`, `AdminEmployeeDetail`) actually call legacy write functions — these were inferred, not directly read
  4. Whether any external tool (cPanel, import scripts) writes to `ak_profiles`, `ak_user_roles`, or `ak_customer_notes`
