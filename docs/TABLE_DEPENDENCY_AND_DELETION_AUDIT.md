# Table Dependency and Deletion Audit

**Generated:** 2026-06-26
**Scope:** All `ak_` tables defined in `public_html/install-schema.php` plus `ak_push_subscriptions` (runtime-created).
**Method:** Full read of every PHP endpoint file, frontend routing, frontend API client, and seed scripts.
**Total tables audited:** 27 (26 in install-schema.php + `ak_push_subscriptions`)

---

## Critical Context — Finance Architecture State (as of this audit)

The project has **completed** the migration from the dual-track legacy finance system to the new card-based architecture. Specifically:

- **`dashboard.php`** has been rewritten to use ONLY the four new card tables (`ak_customer_financial_entries`, `ak_employee_financial_entries`, `ak_supplier_financial_entries`, `ak_expense_card_financial_entries`). Legacy tables are no longer read by the dashboard.
- **`project-statement.php`** reads only the four new card tables.
- **`gelenler.php`** reads only `ak_customer_financial_entries`.
- **`gidenler.php`** reads only the employee, supplier, and expense-card entry tables.
- **The routes `/admin/tahsilatlar` and `/admin/giderler`** now redirect to `/admin/gelenler` and `/admin/gidenler` respectively. The old `AdminCollections` and `AdminExpenses` pages are still imported as lazy components but serve no active routes.
- **`ak_payments` and `ak_expenses`** are still read by: `payments.php`, `expenses.php`, `financial-statement.php` (legacy augmentation), `reports.php` (full dump), and `backend-canonical-read-model.php` / `canonical-read-flags.php` (shadow comparison diagnostics).
- **`ak_payment_plans`** is still actively used by `payment-plans.php`, `customers.php`, `notifications.php`, `financial-statement.php`, and `reports.php`. The `/admin/odeme-planlari` route redirects to `/admin/musteriler`, but the `AdminPaymentPlans` page is still accessible via the customer detail view.

---

## Table Entries

---

### ak_admin_users

**Purpose:** Admin authentication — stores admin email, password hash, role, and active status.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `api/admin/login.php` (SELECT by email_lower for login), `api/admin/me.php` (SELECT current session), `api/auth.php` (SELECT for session validation on every request via `require_admin()`) |
| Frontend | `src/pages/admin/AdminAuth.tsx` (login form), every admin page (session guard) |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- Referenced by `ak_payment_plan_settlements.created_by` and `.reversed_by` (ON DELETE RESTRICT)
- Referenced by `ak_profiles.user_id` (ON DELETE CASCADE)
- Referenced by `ak_user_roles.user_id` (ON DELETE CASCADE)

#### Active calculations depending on it
- Session token on every admin API request

#### Evidence
- `public_html/api/admin/login.php` — SELECT WHERE email_lower = :email
- `public_html/api/auth.php` — SELECT + session validation in `require_admin()`

#### Deletion recommendation
KEEP

---

### ak_profiles

**Purpose:** Optional admin profile extension migrated from Supabase (display_name, email mirror).
**Classification:** DELETE_CANDIDATE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `install-schema.php` only — schema definition, no queries |
| Frontend | None found |
| Seed/cleanup scripts | No |
| Schema only | Yes |

#### FK relationships
- References `ak_admin_users(id)` (ON DELETE CASCADE)
- No other tables reference `ak_profiles`

#### Active calculations depending on it
- None

#### Evidence
- No SELECT, INSERT, UPDATE, or DELETE queries found in any PHP file outside install-schema.php
- Not imported or referenced in any `src/` TypeScript file
- Prior audit (GLOBAL_TABLE_DEPENDENCY_AUDIT.md) confirmed this is a Supabase migration artifact

#### Deletion recommendation
SAFE_TO_DELETE

#### Safe removal steps (if DELETE_CANDIDATE)
1. Confirm the table is empty in production: `SELECT COUNT(*) FROM ak_profiles;`
2. Drop the table: `DROP TABLE IF EXISTS ak_profiles;`
3. Remove from `install-schema.php` (the `'ak_profiles'` key and its SQL block).
4. No PHP or TypeScript changes required.

---

### ak_user_roles

**Purpose:** Admin user-to-role mapping rows migrated from Supabase.
**Classification:** DELETE_CANDIDATE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `install-schema.php` only — schema definition, no queries |
| Frontend | None found |
| Seed/cleanup scripts | No |
| Schema only | Yes |

#### FK relationships
- References `ak_admin_users(id)` (ON DELETE CASCADE)
- No other tables reference `ak_user_roles`

#### Active calculations depending on it
- None. Admin role is stored directly in `ak_admin_users.role`.

#### Evidence
- No SELECT, INSERT, UPDATE, or DELETE queries found in any PHP file outside install-schema.php
- Not referenced in any `src/` TypeScript file

#### Deletion recommendation
SAFE_TO_DELETE

#### Safe removal steps (if DELETE_CANDIDATE)
1. Confirm the table is empty in production: `SELECT COUNT(*) FROM ak_user_roles;`
2. Drop the table: `DROP TABLE IF EXISTS ak_user_roles;`
3. Remove from `install-schema.php` (the `'ak_user_roles'` key and its SQL block).
4. No PHP or TypeScript changes required.

---

### ak_projects

**Purpose:** Construction project master data — both public-facing and admin.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `projects.php` (full CRUD), `dashboard.php` (SELECT active + aggregate JOIN), `customers.php` (SELECT for dropdown), `financial-statement.php` (SELECT for dropdown), `reports.php` (SELECT all), `payment-plans.php` (SELECT for dropdown), `payments.php` (SELECT for validation), `notifications.php` (SELECT for plan generation), `employee-project-assignments.php` (SELECT/INSERT/UPDATE), `employee-project-allocations.php` (SELECT/INSERT/UPDATE), `project-expense-transactions.php` (SELECT for validation), `project-statement.php` (SELECT), `gelenler.php` (LEFT JOIN), `gidenler.php` (LEFT JOIN), `site-settings.php` (indirectly via public site) |
| Frontend | `AdminProjects`, `AdminProjectEdit`, `AdminProjectFinance`, `AdminProjectExpenses`, `AdminCustomerDetail`, `AdminDashboard`, `AdminCustomers`, public site `Projects`, `ProjectDetail` |
| Seed/cleanup scripts | Yes — `seed-demo-bulk.mjs`, `seed-demo-card-finance.mjs` |
| Schema only | No |

#### FK relationships
- Referenced by: `ak_project_images.project_id`, `ak_media_library.related_project_id`, `ak_customer_projects.project_id`, `ak_payment_plans.project_id`, `ak_payments.project_id`, `ak_expenses.project_id`, `ak_financial_entries.project_id`, `ak_employee_project_assignments.project_id`, `ak_employee_project_allocations.project_id`, `ak_project_expense_transactions.project_id`, `ak_customer_financial_entries.project_id`, `ak_employee_financial_entries.project_id`, `ak_supplier_financial_entries.project_id`, `ak_expense_card_financial_entries.project_id`
- Does not reference other domain tables

#### Active calculations depending on it
- Dashboard active project count, project financial cards (via UNION of all four card entry tables)
- Public site project listing and detail pages

#### Evidence
- `public_html/api/admin/dashboard.php:22` — COUNT active projects
- `public_html/api/admin/project-statement.php:17` — SELECT project for statement header

#### Deletion recommendation
KEEP

---

### ak_project_images

**Purpose:** Gallery images linked to a specific project.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `project-images.php` (full CRUD), `upload-project-image.php` (INSERT after file upload) |
| Frontend | `AdminProjectEdit`, `AdminMedia` |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- References `ak_projects(id)` (ON DELETE CASCADE)
- No tables reference `ak_project_images`

#### Active calculations depending on it
- None (display only)

#### Evidence
- `public_html/api/admin/project-images.php` — SELECT/INSERT/UPDATE/DELETE

#### Deletion recommendation
KEEP

---

### ak_media_library

**Purpose:** General media/image library not tied to a specific project.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `media.php` (full CRUD), `media-upload.php` (INSERT after upload) |
| Frontend | `AdminMedia` |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- References `ak_projects(id)` (ON DELETE SET NULL) via `related_project_id`
- No tables reference `ak_media_library`

#### Active calculations depending on it
- None (display only)

#### Evidence
- `public_html/api/admin/media.php` — SELECT/INSERT/DELETE

#### Deletion recommendation
KEEP

---

### ak_site_settings

**Purpose:** Public site content configuration — contact info, SEO fields, hero copy, WhatsApp message.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `admin/site-settings.php` (GET/PATCH), `api/site-settings.php` (GET, public), `install-schema.php` (seed default row) |
| Frontend | `AdminSettings`, public site layout components |
| Seed/cleanup scripts | Yes — seeded in install-schema.php |
| Schema only | No |

#### FK relationships
- None — standalone single-row settings table

#### Active calculations depending on it
- Public site phone number, address, SEO metadata

#### Evidence
- `public_html/api/admin/site-settings.php` — SELECT/PATCH

#### Deletion recommendation
KEEP

---

### ak_contact_requests

**Purpose:** Public contact form submissions from visitors.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `contact-requests.php` (GET list, PATCH status, DELETE), `api/contact-request.php` (INSERT from public form), `dashboard.php` (COUNT total + new), `reports.php` (full SELECT), `backend-canonical-read-model.php` (COUNT for aggregate comparison) |
| Frontend | `AdminContacts` |
| Seed/cleanup scripts | Yes — `seed-demo-bulk.mjs` |
| Schema only | No |

#### FK relationships
- No tables reference `ak_contact_requests`
- Does not reference other tables

#### Active calculations depending on it
- Dashboard summary: `total_contact_requests`, `new_contact_requests`

#### Evidence
- `public_html/api/admin/dashboard.php:24` — COUNT WHERE status='Yeni'
- `public_html/api/admin/reports.php:18` — SELECT * full dump

#### Deletion recommendation
KEEP

---

### ak_customers

**Purpose:** Customer master data (buyers/clients of construction projects).
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `customers.php` (full CRUD + customer_projects replace + financial_entry summary), `payments.php` (SELECT/JOIN, plan sync), `payment-plans.php` (SELECT for dropdown), `dashboard.php` (COUNT + JOIN in card queries), `notifications.php` (plan generation reads customer via plan), `financial-statement.php` (SELECT for dropdown), `reports.php` (full SELECT), `backend-canonical-read-model.php` (plan bucket calculation), `gelenler.php` (LEFT JOIN for name) |
| Frontend | `AdminCustomers`, `AdminCustomerEdit`, `AdminCustomerDetail`, `AdminCustomerFinance`, `AdminCollections` (legacy, no route), `AdminPaymentPlans` (customer detail tab), `AdminDashboard`, `QuickCreateCustomerButton` |
| Seed/cleanup scripts | Yes — `seed-demo-bulk.mjs`, `cleanup-demo-bulk.mjs` |
| Schema only | No |

#### FK relationships
- Referenced by: `ak_customer_projects.customer_id`, `ak_payment_plans.customer_id`, `ak_payments.customer_id`, `ak_expenses.customer_id`, `ak_financial_entries.customer_id`, `ak_customer_notes.customer_id`, `ak_notifications.related_customer_id`, `ak_customer_financial_entries.customer_id`
- Does not reference other tables

#### Active calculations depending on it
- Dashboard customer count, customer financial cards
- Gelenler list (customer name display)

#### Evidence
- `public_html/api/admin/customers.php:25` — SELECT * with ORDER BY
- `public_html/api/admin/dashboard.php:31` — COUNT total_customers

#### Deletion recommendation
KEEP

---

### ak_customer_projects

**Purpose:** Many-to-many junction between customers and projects.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `customers.php` (SELECT project_ids on GET, DELETE+INSERT replace on POST/PATCH), `reports.php` (full SELECT) |
| Frontend | `AdminCustomerDetail`, `AdminCustomerEdit`, `AdminCustomers`, `AdminReports` |
| Seed/cleanup scripts | Yes — `seed-demo-bulk.mjs` |
| Schema only | No |

#### FK relationships
- References `ak_customers(id)` (ON DELETE CASCADE)
- References `ak_projects(id)` (ON DELETE CASCADE)
- No tables reference `ak_customer_projects`

#### Active calculations depending on it
- Customer detail: which projects a customer is linked to
- Reports: full customer-project mapping export

#### Evidence
- `public_html/api/admin/customers.php:17` — SELECT project_id WHERE customer_id
- `public_html/api/admin/reports.php:17` — SELECT * full dump

#### Deletion recommendation
KEEP

---

### ak_payment_plans

**Purpose:** Scheduled payment installments from customers (receivables planning).
**Classification:** LEGACY_INACTIVE_KEEP_FOR_NOW

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `payment-plans.php` (full CRUD, auto-status computation), `payments.php` (SELECT for validation + plan status sync via `sync_customer_account_plan_statuses()`), `customers.php` (SELECT summary for list, SELECT details for customer GET), `dashboard.php` — NOT read (dashboard has been rewritten to use card tables only), `notifications.php` (SELECT all plans for notification generation), `financial-statement.php` (SELECT for customer statement), `reports.php` (full SELECT), `backend-canonical-read-model.php` and `canonical-read-flags.php` (legacy plan bucket calculation for shadow comparison) |
| Frontend | `AdminPaymentPlans` (accessible via customer detail view; `/admin/odeme-planlari` redirects to `/admin/musteriler`), `AdminCustomerDetail`, `AdminCustomers` (plan status display in list), `src/lib/customerMasterData.ts` (plan status derivation helpers) |
| Seed/cleanup scripts | Yes — `seed-demo-bulk.mjs` |
| Schema only | No |

#### FK relationships
- References `ak_customers(id)` (ON DELETE RESTRICT)
- References `ak_projects(id)` (ON DELETE RESTRICT)
- Referenced by: `ak_payments.payment_plan_id`, `ak_notifications.related_payment_plan_id`, `ak_payment_plan_settlements.payment_plan_id`

#### Active calculations depending on it
- Notification generation: plans are the source of overdue/upcoming payment notifications
- Customer detail: plan list with paid/remaining amounts
- Customer list: plan status display (via `src/lib/customerMasterData.ts`)
- `sync_customer_account_plan_statuses()` in `payments.php` still updates plan statuses when legacy `ak_payments` records are written

#### Evidence
- `public_html/api/admin/payment-plans.php:23` — SELECT * FROM ak_payment_plans WHERE customer_id IS NOT NULL
- `public_html/api/admin/notifications.php:67` — SELECT all plans for notification bucket building
- `public_html/api/admin/financial-statement.php:180` — SELECT plans WHERE customer_id for customer statement

#### Deletion recommendation
NOT_SAFE_YET

**Reason:** Still actively queried by notifications.php, customers.php, payments.php, financial-statement.php, reports.php, and the canonical read shadow comparison infrastructure. The dashboard no longer uses it, but deletion would break the notification system and the customer statement view. Retirement requires migrating the notification generation logic to use `ak_customer_financial_entries` instead.

---

### ak_payments

**Purpose:** Actual cash received from customers — legacy income track.
**Classification:** LEGACY_INACTIVE_KEEP_FOR_NOW

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `payments.php` (full CRUD, triggers plan status sync), `customers.php` (SELECT for plan status derivation), `financial-statement.php` (SELECT for legacy augmentation: appends `legacy-payment-` prefixed rows to customer/project statements), `reports.php` (full SELECT), `backend-canonical-read-model.php` (reads for shadow comparison + monthly financials), `canonical-read-flags.php` (reads for legacy plan bucket and dashboard summary calculation) |
| Frontend | `AdminCollections` (full CRUD page — no active route; `/admin/tahsilatlar` redirects to `/admin/gelenler`), `AdminCustomerDetail` (payments tab), `src/lib/customerMasterData.ts` (plan status helpers consume payments) |
| Seed/cleanup scripts | Yes — `seed-demo-bulk.mjs` |
| Schema only | No |

#### FK relationships
- References `ak_customers(id)` (ON DELETE SET NULL)
- References `ak_projects(id)` (ON DELETE SET NULL)
- References `ak_payment_plans(id)` (ON DELETE SET NULL)
- Referenced by `ak_payment_plan_settlements.financial_entry_id` indirectly (canonical track)
- No tables reference `ak_payments` directly

#### Active calculations depending on it
- `sync_customer_account_plan_statuses()` in `payments.php` reads payments to update plan statuses
- `customers.php` reads payments to show plan payment state on customer detail/list
- `financial-statement.php` augments customer/project statements with legacy payment rows
- `canonical-read-flags.php` reads payments for shadow comparison of legacy vs. canonical dashboard totals
- `reports.php` exports the full table

#### Evidence
- `public_html/api/admin/payments.php:13-16` — SELECT + CRUD
- `public_html/api/admin/financial-statement.php:112-136` — SELECT appended as `legacy-payment-` rows
- `public_html/api/admin/backend-canonical-read-model.php:19` — SELECT for canonical read model comparison

#### Deletion recommendation
NOT_SAFE_YET

**Reason:** Still read by payments.php (active endpoint with CRUD), customers.php, financial-statement.php (visible in customer/project statement UI), reports.php, and the canonical shadow comparison infrastructure. Additionally, `ak_payment_plans.paid_amount` is denormalized using data from `ak_payments` via `sync_customer_account_plan_statuses()`. Deletion requires: migrating existing payment data to `ak_customer_financial_entries`, removing plan status sync logic that depends on it, and removing the legacy augmentation in `financial-statement.php`.

---

### ak_expenses

**Purpose:** General costs and expenditures — legacy expense track.
**Classification:** LEGACY_INACTIVE_KEEP_FOR_NOW

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `expenses.php` (full CRUD), `financial-statement.php` (SELECT for legacy augmentation: appends `legacy-expense-` prefixed rows to customer/project statements), `reports.php` (full SELECT), `backend-canonical-read-model.php` (reads for shadow comparison + monthly financials), `canonical-read-flags.php` (reads for legacy dashboard summary comparison) |
| Frontend | `AdminExpenses` (full CRUD page — no active route; `/admin/giderler` redirects to `/admin/gidenler`), `src/lib/apiClient.ts` (function `getAdminExpensesData` still exists and calls `expenses.php`) |
| Seed/cleanup scripts | Yes — `seed-demo-bulk.mjs` |
| Schema only | No |

#### FK relationships
- References `ak_projects(id)` (ON DELETE SET NULL)
- References `ak_customers(id)` (ON DELETE SET NULL)
- No tables reference `ak_expenses`

#### Active calculations depending on it
- `financial-statement.php` augments customer/project statements with legacy expense rows (visible in UI)
- `canonical-read-flags.php` reads for shadow comparison of legacy vs. canonical dashboard expense totals
- `reports.php` exports the full table

#### Evidence
- `public_html/api/admin/expenses.php:13` — SELECT * FROM ak_expenses (active endpoint)
- `public_html/api/admin/financial-statement.php:139-163` — SELECT appended as `legacy-expense-` rows
- `public_html/api/admin/backend-canonical-read-model.php:22` — SELECT for canonical read model comparison

#### Deletion recommendation
NOT_SAFE_YET

**Reason:** Still read by the active `expenses.php` CRUD endpoint, `financial-statement.php` (visible in customer/project statement UI), `reports.php`, and the canonical shadow comparison infrastructure. Deletion requires: migrating existing expense data to one of the new card entry tables, removing legacy augmentation in `financial-statement.php`, and removing `getAdminExpensesData` from `apiClient.ts`. Lower risk than `ak_payments` because `ak_expenses` does not drive plan status sync.

---

### ak_customer_notes

**Purpose:** Free-text notes attached to a customer (Supabase migration artifact).
**Classification:** DELETE_CANDIDATE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `install-schema.php` only — schema definition |
| Frontend | None |
| Seed/cleanup scripts | No |
| Schema only | Yes |

#### FK relationships
- References `ak_customers(id)` (ON DELETE CASCADE)
- No tables reference `ak_customer_notes`

#### Active calculations depending on it
- None. Notes are stored directly in `ak_customers.notes` (TEXT column).

#### Evidence
- No SELECT, INSERT, UPDATE, or DELETE queries found in any PHP or TypeScript file
- Prior audit noted a drop script exists at `docs/sql/drop_ak_customer_notes.sql` (not verified but consistent with prior finding)

#### Deletion recommendation
SAFE_TO_DELETE

#### Safe removal steps (if DELETE_CANDIDATE)
1. Confirm the table is empty in production: `SELECT COUNT(*) FROM ak_customer_notes;`
2. Drop the table: `DROP TABLE IF EXISTS ak_customer_notes;`
3. Remove from `install-schema.php` (the `'ak_customer_notes'` key and SQL block).
4. No PHP or TypeScript changes required.

---

### ak_notifications

**Purpose:** System notifications about payment plans and business events.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `notifications.php` (SELECT list + unread count, PATCH mark-read, DELETE; GET with `?generate=1` triggers `ensure_payment_notifications()`), `dashboard.php` (COUNT unread) |
| Frontend | `AdminNotifications`, `NotificationBell` (unread badge), `AdminLayout` (badge display) |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- References `ak_customers(id)` via `related_customer_id` (ON DELETE SET NULL)
- References `ak_projects(id)` via `related_project_id` (ON DELETE SET NULL)
- References `ak_payment_plans(id)` via `related_payment_plan_id` (ON DELETE SET NULL)
- No tables reference `ak_notifications`

#### Active calculations depending on it
- Dashboard: `unread_notifications` count
- Notification bell badge in `AdminLayout`
- Notification generation reads `ak_payment_plans` + `ak_payments` and writes to this table

#### Evidence
- `public_html/api/admin/dashboard.php:30` — COUNT WHERE is_read=0
- `public_html/api/admin/notifications.php:62-134` — `ensure_payment_notifications()` full logic

#### Deletion recommendation
KEEP

---

### ak_employees

**Purpose:** Employee/personnel master data.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `employees.php` (full CRUD), `employee-roles.php`, `employee-cost-periods.php`, `employee-project-assignments.php`, `employee-project-allocations.php`, `dashboard.php` (LEFT JOIN in personnel card query), `financial-statement.php` (SELECT for dropdown), `gidenler.php` (LEFT JOIN for name) |
| Frontend | `AdminEmployees`, `AdminEmployeeDetail`, `AdminEmployeeFinance` (via `employee-financial-entries.php`), `AdminEmployeeAllocations`, `AdminDashboard` (personnel cards), `FinancialStatementPage` |
| Seed/cleanup scripts | Yes — `seed-demo-bulk.mjs` |
| Schema only | No |

#### FK relationships
- Referenced by: `ak_employee_roles.employee_id`, `ak_employee_cost_periods.employee_id`, `ak_employee_project_assignments.employee_id`, `ak_employee_project_allocations.employee_id`, `ak_financial_entries.employee_id`, `ak_employee_financial_entries.employee_id`
- Does not reference other tables

#### Active calculations depending on it
- Dashboard personnel financial cards
- Employee financial entries are the authoritative cost records

#### Evidence
- `public_html/api/admin/dashboard.php:385-406` — `build_personnel_cards()` LEFT JOIN with `ak_employee_financial_entries`
- `public_html/api/admin/employees.php` — full CRUD

#### Deletion recommendation
KEEP

---

### ak_roles

**Purpose:** Job role definitions (titles/positions) used as a lookup for employee role assignments.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `roles.php` (SELECT list, INSERT, UPDATE is_active) |
| Frontend | `EmployeeRolesPanel` component, `AdminEmployeeDetail` |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- Referenced by `ak_employee_roles.role_id` (ON DELETE RESTRICT)
- Does not reference other tables

#### Active calculations depending on it
- Role lookup for employee assignment forms

#### Evidence
- `public_html/api/admin/roles.php` — SELECT/INSERT/UPDATE

#### Deletion recommendation
KEEP

---

### ak_employee_roles

**Purpose:** Assignment of roles to employees with date ranges (start/end dates).
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `employee-roles.php` (SELECT by employee, INSERT, UPDATE end_date, DELETE) |
| Frontend | `EmployeeRolesPanel` |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- References `ak_employees(id)` (ON DELETE CASCADE)
- References `ak_roles(id)` (ON DELETE RESTRICT)
- No tables reference `ak_employee_roles`

#### Active calculations depending on it
- Employee detail: role history display

#### Evidence
- `public_html/api/admin/employee-roles.php` — SELECT/INSERT/UPDATE/DELETE

#### Deletion recommendation
KEEP

---

### ak_employee_cost_periods

**Purpose:** Monthly salary and benefit breakdown per employee (salary, SGK, meal, transport, bonus, accommodation, other).
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `employee-cost-periods.php` (full CRUD), `employee-project-allocations.php` (SELECT to compute cost snapshots when creating allocations) |
| Frontend | `CostPeriodsPanel`, `AdminEmployeeDetail` |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- References `ak_employees(id)` (ON DELETE CASCADE)
- Referenced by `ak_employee_project_allocations` indirectly (reads cost periods at allocation time to snapshot costs; no FK at DB level)

#### Active calculations depending on it
- Allocation endpoint reads the active cost period to derive `salary_snapshot`, `sgk_snapshot`, etc. in `ak_employee_project_allocations`

#### Evidence
- `public_html/api/admin/employee-project-allocations.php` — SELECT cost period for snapshot calculation

#### Deletion recommendation
KEEP

---

### ak_employee_project_assignments

**Purpose:** Qualitative record of which employees are assigned to which projects with date ranges.
**Classification:** NEEDS_OWNER_DECISION

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `employee-project-assignments.php` (full CRUD) |
| Frontend | `ProjectAssignmentsPanel`, `ProjectEmployeeCostPanel` |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- References `ak_employees(id)` (ON DELETE CASCADE)
- References `ak_projects(id)` (ON DELETE RESTRICT)
- No tables reference `ak_employee_project_assignments`

#### Active calculations depending on it
- None — display only. The financial cost truth is in `ak_employee_financial_entries` and `ak_employee_project_allocations`.

#### Evidence
- `public_html/api/admin/employee-project-assignments.php` — CRUD endpoint with active frontend usage

#### Deletion recommendation
OWNER_DECISION_NEEDED

**Reason:** The table is actively used (not schema-only), but it is purely qualitative. The question is whether assignment records provide value distinct from allocations. If `ak_employee_project_allocations` already proves that an employee worked on a project (with monthly cost detail), the assignment table is redundant. Owner must decide whether to keep the qualitative record for context/notes or consolidate.

---

### ak_employee_project_allocations

**Purpose:** Monthly quantitative cost allocation: how many days an employee worked on a project per month, with cost snapshot.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `employee-project-allocations.php` (full CRUD, reads `ak_employee_cost_periods` for snapshot) |
| Frontend | `AdminEmployeeAllocations`, `ProjectEmployeeCostPanel` |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- References `ak_employees(id)` (ON DELETE CASCADE)
- References `ak_projects(id)` (ON DELETE RESTRICT)
- No tables reference `ak_employee_project_allocations`

#### Active calculations depending on it
- Profitability calculation per project (displayed in `ProjectEmployeeCostPanel`)
- Employee monthly cost breakdown by project

#### Evidence
- `public_html/api/admin/employee-project-allocations.php` — full CRUD
- `src/pages/admin/AdminEmployeeAllocations.tsx` — allocation management UI

#### Deletion recommendation
KEEP

**Note:** This table is NOT currently included in the main dashboard financial totals. The dashboard reads `ak_employee_financial_entries` for employee costs, not allocations. Owner should decide whether allocations should also feed project cost totals in the dashboard.

---

### ak_expense_cards

**Purpose:** Expense card master data — a catalog of named cost centers or vendor/supplier categories used as FK in the new finance tables.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `expense-cards.php` (full CRUD), `financial-statement.php` (SELECT for dropdown), `dashboard.php` (JOIN in expense category intelligence), `project-expense-transactions.php` (SELECT for validation), `gidenler.php` (LEFT JOIN for name), `expense-card-financial-entries.php` (LEFT JOIN) |
| Frontend | `AdminExpenseCards`, `AdminExpenseCardFinance`, `AdminDashboard` (expense category intelligence panel), `FinancialStatementPage` |
| Seed/cleanup scripts | Yes — `seed-demo-bulk.mjs` |
| Schema only | No |

#### FK relationships
- Referenced by: `ak_expense_card_financial_entries.expense_card_id` (ON DELETE RESTRICT), `ak_project_expense_transactions.expense_item_id` (ON DELETE SET NULL), `ak_financial_entries.expense_card_id` (ON DELETE SET NULL)
- Does not reference other tables

#### Active calculations depending on it
- Dashboard expense category intelligence (`build_expense_category_intelligence()`)
- Expense card financial entries use it as the owner FK

#### Evidence
- `public_html/api/admin/dashboard.php:609-651` — `build_expense_category_intelligence()` reads `ak_expense_card_financial_entries` + `ak_expense_cards`

#### Deletion recommendation
KEEP

---

### ak_project_expense_transactions

**Purpose:** Project-level itemized expense line items with multi-currency and exchange rate snapshot support.
**Classification:** NEEDS_OWNER_DECISION

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `project-expense-transactions.php` (full CRUD + per-project profitability calculation) |
| Frontend | `AdminProjectExpenses` (accessed via `/admin/projeler/:id/giderler`) |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- References `ak_projects(id)` (ON DELETE RESTRICT)
- References `ak_expense_cards(id)` via `expense_item_id` (ON DELETE SET NULL)
- No tables reference `ak_project_expense_transactions`

#### Active calculations depending on it
- Per-project profitability: `pet_profitability()` calculates realized and planned totals by currency for a project
- Project expenses page: itemized list of costs per project

#### Evidence
- `public_html/api/admin/project-expense-transactions.php:141-167` — `pet_profitability()` — SELECT SUM by currency
- `src/pages/admin/AdminProjectExpenses.tsx` — active UI page with route

#### Deletion recommendation
OWNER_DECISION_NEEDED

**Reason:** This table is actively used with a live route and live data. However, it is architecturally parallel to the new `ak_expense_card_financial_entries` — both record project expenses with expense card associations. The key difference is that `ak_project_expense_transactions` supports multi-currency without TRY conversion (records raw amounts per currency), while `ak_expense_card_financial_entries` normalizes to TRY via exchange rate snapshots. The dashboard does NOT include `ak_project_expense_transactions` totals in financial summaries (they are only in the per-project profitability view). Owner must decide: is this table the authoritative project cost record, a supplementary view, or a candidate for consolidation into `ak_expense_card_financial_entries`?

---

### ak_financial_entries

**Purpose:** Unified canonical ledger — all income and expense entries with direction, card_type, status, group_tag, and currency. The predecessor architecture before the card-specific tables.
**Classification:** LEGACY_INACTIVE_KEEP_FOR_NOW

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `financial-statement.php` (full CRUD — primary write target for the old finance statement UI), `reports.php` (full SELECT), `backend-canonical-read-model.php` (reads for shadow comparison with legacy), `canonical-read-flags.php` (reads for diagnostics), `canonical-finance-service.php` (reads for plan bucket calculation and settlement logic), `canonical-transaction-service.php` (writes when settlement is enabled, flag-gated) |
| Frontend | `AdminProjectFinance`, `AdminCustomerFinance`, `AdminEmployeeFinance`, `AdminExpenseCardFinance` (all of these still use `financial-statement.php` which writes to this table), `AdminDashboard` (not read directly), `AdminReports`, `src/lib/apiClient.ts` (`getAdminFinancialStatement()`) |
| Seed/cleanup scripts | No |
| Schema only | No |

#### FK relationships
- References `ak_projects(id)` (ON DELETE SET NULL)
- References `ak_customers(id)` (ON DELETE SET NULL)
- References `ak_employees(id)` (ON DELETE SET NULL)
- References `ak_expense_cards(id)` (ON DELETE SET NULL)
- Referenced by: `ak_payment_plan_settlements.financial_entry_id` (ON DELETE RESTRICT)

#### Active calculations depending on it
- `financial-statement.php` is the CRUD endpoint for creating/editing entries in this table — it is still the backend for `AdminProjectFinance`, `AdminCustomerFinance`, `AdminEmployeeFinance`, and `AdminExpenseCardFinance` pages
- `reports.php` exports the full table
- `canonical-finance-service.php` reads it for plan settlement calculations

#### Evidence
- `public_html/api/admin/financial-statement.php:42` — INSERT INTO ak_financial_entries
- `public_html/api/admin/financial-statement.php:50` — PATCH UPDATE ak_financial_entries
- `public_html/api/admin/financial-statement.php:65` — DELETE FROM ak_financial_entries

#### Deletion recommendation
NOT_SAFE_YET

**Reason:** This table is still actively written by `financial-statement.php` which backs the project/customer/employee/expense-card finance pages. The four new card-specific tables (`ak_customer_financial_entries` etc.) replace this in the dashboard and the `gelenler`/`gidenler` views, but the per-entity finance statement pages still use `ak_financial_entries` as their write target. Both systems coexist. Full migration requires switching `AdminProjectFinance`, `AdminCustomerFinance`, `AdminEmployeeFinance`, and `AdminExpenseCardFinance` to use the card-specific entry APIs.

**Important note:** Despite being described as a "canonical" ledger, this table is now the OLDER architecture. The new card-specific tables are the actual target. The naming is confusing but correct as of this audit.

---

### ak_payment_plan_settlements

**Purpose:** Links a financial entry (canonical payment) to a specific payment plan installment, enabling proper settlement accounting.
**Classification:** NEEDS_OWNER_DECISION

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `canonical-transaction-service.php` (SELECT/INSERT/UPDATE — but gated behind `is_settlement_enabled()` which checks `CANONICAL_SETTLEMENT_ENABLED` constant, defaulting to `false`), `canonical-finance-service.php` (reads settlement sums for plan/entry balance calculations, also flag-dependent) |
| Frontend | None directly. Tests in `src/test/canonical-read-model.test.ts` exercise the settlement logic in TypeScript. |
| Seed/cleanup scripts | No |
| Schema only | Effectively yes — the constant `CANONICAL_SETTLEMENT_ENABLED` defaults to `false` in `config.example.php` |

#### FK relationships
- References `ak_payment_plans(id)` (ON DELETE RESTRICT)
- References `ak_financial_entries(id)` (ON DELETE RESTRICT)
- References `ak_admin_users(id)` via `created_by` and `reversed_by` (ON DELETE RESTRICT)
- No tables reference `ak_payment_plan_settlements`

#### Active calculations depending on it
- Settlement logic in `canonical-transaction-service.php` is dead code unless `CANONICAL_SETTLEMENT_ENABLED=true`

#### Evidence
- `public_html/api/config.example.php:42` — `define('CANONICAL_SETTLEMENT_ENABLED', false);`
- `public_html/api/admin/canonical-transaction-service.php:8` — `is_settlement_enabled()` guard

#### Deletion recommendation
OWNER_DECISION_NEEDED

**Reason:** The table and its supporting code are fully implemented but flag-disabled. With `ak_financial_entries` being deprecated in favor of the card-specific tables, the settlement system also needs re-evaluation. If the settlement concept is to be carried forward, the FK should point to the new card entry tables, not `ak_financial_entries`. Owner must decide: activate (but update FKs), defer, or remove.

---

### ak_cookie_consents

**Purpose:** Log of visitor cookie consent choices from the public site consent banner.
**Classification:** KEEP_SUPPORT

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `api/cookie-consent.php` (INSERT only — public endpoint, no admin reads) |
| Frontend | Cookie consent banner on public site (`submitCookieConsent()` in `apiClient.ts`) |
| Seed/cleanup scripts | No |
| Schema only | No (actively written, but never read) |

#### FK relationships
- No references to or from other tables

#### Active calculations depending on it
- None — write-only log for compliance purposes

#### Evidence
- `public_html/api/cookie-consent.php:17-31` — INSERT INTO ak_cookie_consents
- No admin endpoint reads this table

#### Deletion recommendation
KEEP

**Note:** No admin UI reads this data, but it may be required for GDPR/KVKK compliance documentation. Keep unless legal compliance requirements are confirmed to not need it.

---

### ak_employees (new card-based tables group)

The following four tables form the new card-based finance architecture. They are the current target of all active dashboard queries and the new global `gelenler`/`gidenler` views.

---

### ak_suppliers

**Purpose:** Supplier/vendor master data (the "card" owner for `ak_supplier_financial_entries`).
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `suppliers.php` (full CRUD with check for linked entries before delete), `dashboard.php` (`build_supplier_cards()` — LEFT JOIN), `gidenler.php` (LEFT JOIN for name), `supplier-financial-entries.php` (LEFT JOIN) |
| Frontend | `AdminSuppliers`, `AdminSupplierEdit`, `AdminSupplierDetail`, `AdminDashboard` (supplier financial cards) |
| Seed/cleanup scripts | Yes — `seed-demo-card-finance.mjs` |
| Schema only | No |

#### FK relationships
- Referenced by `ak_supplier_financial_entries.supplier_id` (ON DELETE RESTRICT)
- Does not reference other tables

#### Active calculations depending on it
- Dashboard supplier financial cards (remaining payable, overdue payable)
- Supplier detail: entry list and totals

#### Evidence
- `public_html/api/admin/dashboard.php:359-381` — `build_supplier_cards()` query
- `public_html/api/admin/suppliers.php:73` — pre-delete check for linked entries

#### Deletion recommendation
KEEP

---

### ak_customer_financial_entries

**Purpose:** New-architecture customer income entries — replaces `ak_payments` + the customer track of `ak_financial_entries`.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `customer-financial-entries.php` (full CRUD), `dashboard.php` (core of all income calculations), `gelenler.php` (primary data source), `project-statement.php` (UNION member for income side) |
| Frontend | `AdminCustomerDetail` (entries tab), `AdminGelenler`, `AdminDashboard` |
| Seed/cleanup scripts | Yes — `seed-demo-card-finance.mjs` |
| Schema only | No |

#### FK relationships
- References `ak_customers(id)` (ON DELETE RESTRICT)
- References `ak_projects(id)` (ON DELETE RESTRICT)
- No tables reference `ak_customer_financial_entries`

#### Active calculations depending on it
- Dashboard: all income totals (`total_income_paid`, `total_income_planned`, `overdue_receivable`, `upcoming_receivable`, month income)
- Gelenler: global income view with filters
- Project statement: income side of per-project P&L

#### Evidence
- `public_html/api/admin/dashboard.php:113-125` — primary income query
- `public_html/api/admin/gelenler.php:42-54` — main SELECT from this table

#### Deletion recommendation
KEEP

---

### ak_employee_financial_entries

**Purpose:** New-architecture employee cost entries — replaces the employee track in `ak_financial_entries`.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `employee-financial-entries.php` (full CRUD), `dashboard.php` (expense calculations), `gidenler.php` (UNION member), `project-statement.php` (UNION member for expense side) |
| Frontend | `AdminEmployeeDetail` (entries tab), `AdminGidenler`, `AdminDashboard` |
| Seed/cleanup scripts | Yes — `seed-demo-card-finance.mjs` |
| Schema only | No |

#### FK relationships
- References `ak_employees(id)` (ON DELETE RESTRICT)
- References `ak_projects(id)` (ON DELETE RESTRICT)
- No tables reference `ak_employee_financial_entries`

#### Active calculations depending on it
- Dashboard: expense totals (employee portion of `total_expense_paid`)
- Personnel financial cards

#### Evidence
- `public_html/api/admin/dashboard.php:132-134` — UNION member for expense query

#### Deletion recommendation
KEEP

---

### ak_supplier_financial_entries

**Purpose:** New-architecture supplier payment entries — replaces the supplier/vendor track in `ak_financial_entries`.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `supplier-financial-entries.php` (full CRUD), `dashboard.php` (expense calculations + supplier cards), `gidenler.php` (UNION member), `project-statement.php` (UNION member for expense side) |
| Frontend | `AdminSupplierDetail` (entries tab), `AdminGidenler`, `AdminDashboard` |
| Seed/cleanup scripts | Yes — `seed-demo-card-finance.mjs` |
| Schema only | No |

#### FK relationships
- References `ak_suppliers(id)` (ON DELETE RESTRICT)
- References `ak_projects(id)` (ON DELETE RESTRICT)
- No tables reference `ak_supplier_financial_entries`

#### Active calculations depending on it
- Dashboard: supplier financial cards (`remaining_payable`, `overdue_payable`)
- Supplier detail: full entry list

#### Evidence
- `public_html/api/admin/dashboard.php:359-381` — `build_supplier_cards()` with JOIN
- `public_html/api/admin/supplier-financial-entries.php` — full CRUD

#### Deletion recommendation
KEEP

---

### ak_expense_card_financial_entries

**Purpose:** New-architecture expense card (cost center) entries — replaces the expense card track in `ak_financial_entries`.
**Classification:** KEEP_CORE

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `expense-card-financial-entries.php` (full CRUD), `dashboard.php` (expense calculations + expense category intelligence), `gidenler.php` (UNION member), `project-statement.php` (UNION member for expense side) |
| Frontend | `AdminExpenseCardFinance`, `AdminGidenler`, `AdminDashboard` |
| Seed/cleanup scripts | Yes — `seed-demo-card-finance.mjs` |
| Schema only | No |

#### FK relationships
- References `ak_expense_cards(id)` (ON DELETE RESTRICT)
- References `ak_projects(id)` (ON DELETE RESTRICT)
- No tables reference `ak_expense_card_financial_entries`

#### Active calculations depending on it
- Dashboard: expense category intelligence (`build_expense_category_intelligence()`)
- Expense card detail: full entry list

#### Evidence
- `public_html/api/admin/dashboard.php:609-651` — expense category intelligence with JOIN to `ak_expense_cards`

#### Deletion recommendation
KEEP

---

### ak_push_subscriptions

**Purpose:** Web push notification subscription records (device endpoints, keys, user agent).
**Classification:** KEEP_SUPPORT

#### Usage
| Layer | Details |
|-------|---------|
| PHP endpoints | `push-utils.php` (CREATE TABLE IF NOT EXISTS at runtime, SELECT/INSERT/UPDATE/DELETE), `push-subscribe.php` (subscribe/unsubscribe/config), `push-unsubscribe.php`, `send-push-test.php` |
| Frontend | `AdminPushNotificationsPanel`, `AdminSettings` |
| Seed/cleanup scripts | No |
| Schema only | No (runtime-created, not in install-schema.php) |

#### FK relationships
- No FK constraints defined (created at runtime without FK)
- Does not reference other tables

#### Active calculations depending on it
- Push notification delivery to admin devices

#### Evidence
- `public_html/api/admin/push-utils.php:7` — runtime CREATE TABLE IF NOT EXISTS
- `public_html/api/admin/push-subscribe.php` — subscribe/manage subscriptions

#### Deletion recommendation
KEEP

**Note:** This table does not appear in `install-schema.php` and should be added there for completeness and reproducibility of the schema on a fresh installation.

---

## Summary

### Definitely Keep (KEEP_CORE)
- `ak_admin_users` — authentication backbone; every request depends on it
- `ak_projects` — FK parent for almost everything; used in public site and admin
- `ak_project_images` — active gallery management
- `ak_media_library` — active general media library
- `ak_site_settings` — public site configuration
- `ak_contact_requests` — active customer inquiry management
- `ak_customers` — CRM core; FK parent for finance tables
- `ak_customer_projects` — M:N junction actively managed on customer save
- `ak_employees` — personnel master data; FK parent for employee sub-tables
- `ak_roles` — role lookup actively used in employee detail UI
- `ak_employee_roles` — role history actively managed
- `ak_employee_cost_periods` — consumed by allocation cost snapshot logic
- `ak_employee_project_allocations` — active allocation management with dedicated UI
- `ak_expense_cards` — cost center catalog; FK for new entry tables and dashboard intelligence
- `ak_suppliers` — supplier master data; FK for supplier financial entries
- `ak_customer_financial_entries` — primary income ledger; drives all dashboard income totals
- `ak_employee_financial_entries` — primary employee cost ledger
- `ak_supplier_financial_entries` — primary supplier cost ledger
- `ak_expense_card_financial_entries` — primary expense card cost ledger
- `ak_notifications` — active notification system

### Probably Keep (KEEP_SUPPORT)
- `ak_cookie_consents` — write-only compliance log; no admin reads but may be required for GDPR/KVKK
- `ak_push_subscriptions` — web push delivery; should be added to install-schema.php

### Legacy — Not Safe to Delete Yet (LEGACY_INACTIVE_KEEP_FOR_NOW)
- `ak_payment_plans` — still used by notification generation, customer statement, and plan status sync; dashboard no longer reads it but several other endpoints still do
- `ak_payments` — still used by plan status sync (`payments.php`), customer statement augmentation (`financial-statement.php`), reports, and shadow comparison; route redirected but CRUD endpoint and data are live
- `ak_expenses` — still used by `expenses.php` CRUD, statement augmentation, reports, and shadow comparison; route redirected but CRUD endpoint and data are live
- `ak_financial_entries` — still the write target for `financial-statement.php` which backs `AdminProjectFinance`, `AdminCustomerFinance`, `AdminEmployeeFinance`, and `AdminExpenseCardFinance`; not read by dashboard

### Likely Safe to Delete (DELETE_CANDIDATE)
- `ak_profiles` — schema-only; Supabase migration artifact; no queries anywhere; no data expected
- `ak_user_roles` — schema-only; Supabase migration artifact; admin role is on `ak_admin_users.role`; no data expected
- `ak_customer_notes` — schema-only; notes are stored in `ak_customers.notes` column; no data expected

### Requires Owner Decision (NEEDS_OWNER_DECISION)
- `ak_employee_project_assignments` — active but qualitatively redundant with `ak_employee_project_allocations`; owner must decide if the qualitative date-bounded assignment record adds value beyond what allocations already prove
- `ak_project_expense_transactions` — active route and CRUD, but architecturally parallel to `ak_expense_card_financial_entries`; provides unique multi-currency-without-TRY-conversion functionality; owner must decide if this is the authoritative project cost record or a candidate for consolidation
- `ak_payment_plan_settlements` — fully implemented but flag-disabled (`CANONICAL_SETTLEMENT_ENABLED=false`); FKs point to `ak_financial_entries` which is itself being deprecated; owner must decide whether to re-target the settlement FKs to new card tables, activate, or remove entirely

---

## Priority Sequence for Safe Reduction

1. **Immediately safe:** Drop `ak_profiles`, `ak_user_roles`, `ak_customer_notes` — confirm empty, then drop. Zero code changes.
2. **Short-term:** Decide on `ak_payment_plan_settlements` — if not activating, drop now while `ak_financial_entries` FK is still valid.
3. **Medium-term:** Migrate `AdminProjectFinance`, `AdminCustomerFinance`, `AdminEmployeeFinance`, `AdminExpenseCardFinance` from `financial-statement.php` / `ak_financial_entries` to the four card-specific endpoints and tables. Once done, `ak_financial_entries` becomes truly inert.
4. **Medium-term:** Migrate notification generation in `notifications.php` from `ak_payment_plans` + `ak_payments` to `ak_customer_financial_entries`. This decouples `ak_payment_plans` from the notification system.
5. **Longer-term:** Once notification and statement views are migrated, `ak_payment_plans`, `ak_payments`, and `ak_expenses` can be retired. Historical data must be migrated or archived first.
6. **Owner decision:** Resolve `ak_employee_project_assignments` and `ak_project_expense_transactions` architecture questions independently of the above sequence.
