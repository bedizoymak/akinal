# Global Table Dependency Audit

Generated: 2026-06-25

---

## 1. Executive Summary

This audit maps all `ak_` prefixed database tables in the akinalinsaat.com project against their backend PHP usage, frontend TypeScript/React usage, dashboard/report usage, and inter-table relationships.

**Total tables found: 26**

- 20 tables are defined in `public_html/install-schema.php`
- 1 additional table (`ak_push_subscriptions`) is created at runtime in `public_html/api/admin/push-utils.php`
- 5 tables in the employee cluster (`ak_employees`, `ak_roles`, `ak_employee_roles`, `ak_employee_cost_periods`, `ak_employee_project_assignments`, `ak_employee_project_allocations`) were the most recently added

**Key finding — dual-track financial system:** The project operates with two parallel financial recording systems:
1. **Legacy track:** `ak_payments` (income) + `ak_expenses` (costs) — simple, flat records
2. **Canonical track:** `ak_financial_entries` — a unified ledger with direction, card_type, status, group_tag, currency

Both tracks are read simultaneously in the dashboard, reports, and financial statement. A "canonical read flags" system (`canonical-read-flags.php`) gates which track is authoritative per context. This dual-track is the primary source of overlap risk in the system.

**Simplification opportunity:** If `ak_financial_entries` fully replaces the legacy tracks, `ak_payments` and `ak_expenses` become redundant for new data. They are still read in dashboard, reports, and notifications — the migration is incomplete.

**The employee cluster** (`ak_employee_cost_periods`, `ak_employee_project_assignments`, `ak_employee_project_allocations`) is backend-complete but only partially consumed by the dashboard's `fetch_personnel_financial_cards()`. The frontend exposes allocations via `AdminEmployeeAllocations` and cost periods via `AdminEmployeeDetail`, but these are not visible in the main finance reports page.

---

## 2. Full Table Inventory

| Table | Purpose (Inferred) | Backend Usage | Frontend Usage | Dashboard/Report Usage | Status |
|---|---|---|---|---|---|
| `ak_admin_users` | Admin authentication, session management | login.php, auth.php, create-admin-user.php; FK target for ak_payment_plan_settlements | AdminAuth page (login form) | Not directly; session guard everywhere | Essential |
| `ak_profiles` | Optional admin profile extension (display_name) | install-schema.php only; no API reads found | None | None | Legacy Candidate — no API reads, no frontend usage |
| `ak_user_roles` | Admin role-permission rows | install-schema.php only; no API reads found | None | None | Legacy Candidate — no API reads, no frontend usage |
| `ak_projects` | Construction project master data (public site + admin) | projects.php (CRUD), dashboard.php, customers.php, financial-statement.php, reports.php, all employee allocation APIs, all finance APIs | AdminProjects, AdminProjectEdit, AdminProjectFinance, AdminProjectExpenses, AdminCustomerDetail, AdminDashboard | Dashboard active_projects_list, project financial cards, profit drilldowns | Essential |
| `ak_project_images` | Gallery images per project | project-images.php (CRUD), upload-project-image.php | AdminMedia, AdminProjectEdit | Not in dashboard | Essential |
| `ak_media_library` | General media/image library | media.php (CRUD), media-upload.php | AdminMedia | Not in dashboard | Likely Essential |
| `ak_site_settings` | Public site content: contact info, SEO, hero | site-settings.php (GET/PATCH) | AdminSettings | Not in dashboard | Essential |
| `ak_contact_requests` | Public contact form submissions | contact-requests.php (GET/PATCH/DELETE) | AdminContacts | Count in dashboard summary and reports aggregates | Essential |
| `ak_customers` | Customer master data (buyers/clients) | customers.php (CRUD), payments.php, payment-plans.php, reports.php, dashboard.php, notifications.php, financial-statement.php | AdminCustomers, AdminCustomerEdit, AdminCustomerDetail, AdminCustomerFinance, AdminCollections, AdminPaymentPlans, AdminDashboard | Customer financial cards, receivables, overdue/upcoming plans | Essential |
| `ak_customer_projects` | M:N junction: customer ↔ project | customers.php (replace on customer save), reports.php | AdminCustomerDetail (project links) | reports.customer_projects | Likely Essential |
| `ak_payment_plans` | Scheduled payment obligations from customers (receivables) | payment-plans.php (CRUD), payments.php (sync status), customers.php, dashboard.php, notifications.php, reports.php | AdminPaymentPlans, AdminCollections, AdminCustomerDetail, AdminDashboard | Overdue/upcoming plan buckets, receivable obligations, drilldowns | Essential |
| `ak_payments` | Actual cash received from customers (legacy income track) | payments.php (CRUD), customers.php, dashboard.php (legacy+canonical both read), reports.php, notifications.php | AdminCollections, AdminCustomerDetail, AdminDashboard | Legacy income total, month income, recent movements union | Duplicate Candidate — overlaps with ak_financial_entries direction=Gelir card_type=customer |
| `ak_expenses` | General costs/expenditures (legacy expense track) | expenses.php (CRUD), dashboard.php (legacy+canonical both read), reports.php, financial-statement.php (for project/customer) | AdminExpenses, AdminProjectFinance (via financial-statement), AdminDashboard | Legacy expense total, month expenses, recent movements union | Duplicate Candidate — overlaps with ak_financial_entries direction=Gider |
| `ak_customer_notes` | Notes attached to a customer | install-schema.php only; SQL drop script exists in docs/sql/ | None confirmed | None | Legacy Candidate — drop script exists (docs/sql/drop_ak_customer_notes.sql); appears scheduled for removal |
| `ak_notifications` | System notifications about payment plans | notifications.php (CRUD + generate), dashboard.php (unread count) | AdminNotifications, NotificationBell | Unread count in dashboard summary | Essential |
| `ak_employees` | Employee/personnel master data | employees.php (CRUD), all employee sub-APIs, dashboard.php (financial cards), financial-statement.php | AdminEmployees, AdminEmployeeDetail, AdminEmployeeFinance, AdminEmployeeAllocations, AdminDashboard | Personnel financial cards, cost drilldowns | Essential |
| `ak_roles` | Role definitions (job titles for employees) | roles.php (CRUD) | AdminEmployeeDetail (EmployeeRolesPanel) | Not in dashboard | Likely Essential |
| `ak_employee_roles` | Employee ↔ role assignments with date ranges | employee-roles.php (CRUD) | AdminEmployeeDetail (EmployeeRolesPanel) | Not in dashboard | Likely Essential |
| `ak_employee_cost_periods` | Monthly salary/benefit breakdown per employee | employee-cost-periods.php (CRUD) | AdminEmployeeDetail (CostPeriodsPanel) | Not directly; allocation calculations consume this indirectly | Likely Essential |
| `ak_employee_project_assignments` | Which employees work on which projects (qualitative) | employee-project-assignments.php (CRUD) | AdminEmployeeDetail (ProjectAssignmentsPanel), AdminProjectEdit (ProjectEmployeeCostPanel) | Not in dashboard | Likely Essential |
| `ak_employee_project_allocations` | Monthly cost allocation: employee days per project with cost snapshot | employee-project-allocations.php (CRUD) | AdminEmployeeAllocations, AdminProjectEdit (ProjectEmployeeCostPanel) | Not currently included in main dashboard financial totals | Unknown / Needs Owner Decision |
| `ak_expense_cards` | Supplier/vendor catalog (used as FK in financial entries) | expense-cards.php (CRUD), financial-statement.php, dashboard.php | AdminExpenseCards, AdminExpenseCardFinance, AdminDashboard (supplier cards) | Supplier financial cards, expense category intelligence | Essential |
| `ak_project_expense_transactions` | Project-level itemized expense line items (multi-currency) | project-expense-transactions.php (CRUD) | AdminProjectExpenses | Not in main dashboard (separate profitability calc) | Unknown / Needs Owner Decision — parallel to ak_expenses; unclear if this replaces ak_expenses for project costs |
| `ak_financial_entries` | Unified canonical ledger: all income/expense entries with card_type, direction, status, group_tag | financial-statement.php (CRUD), dashboard.php (canonical track), reports.php, backend-canonical-read-model.php | AdminProjectFinance, AdminCustomerFinance, AdminEmployeeFinance, AdminExpenseCardFinance, AdminDashboard | Canonical income/expense totals, planned income, financial cards for all entity types | Essential |
| `ak_payment_plan_settlements` | Links a financial entry (payment) to a specific payment plan installment | canonical-transaction-service.php (write, gated behind flag), canonical-finance-service.php (read) | Not directly exposed in frontend UI | Referenced in canonical read model but flag-gated | Unknown / Needs Owner Decision — only active when CANONICAL_SETTLEMENT_ENABLED=true |
| `ak_cookie_consents` | Public visitor cookie consent records | cookie-consent.php (INSERT) | Cookie consent banner component | Not in dashboard | Backend-only (from admin perspective) |
| `ak_push_subscriptions` | Web push notification subscriptions (created at runtime in push-utils.php) | push-utils.php, push-subscribe.php, push-unsubscribe.php, send-push-test.php | AdminPushNotificationsPanel | Not in dashboard | Essential |

---

## 3. Backend Dependency Map

| Table | PHP Files | Operations | Notes |
|---|---|---|---|
| `ak_admin_users` | `api/admin/login.php`, `api/auth.php`, `create-admin-user.php`, `install-schema.php` | SELECT (login), INSERT (create-admin), schema | FK target for ak_payment_plan_settlements.created_by/reversed_by |
| `ak_profiles` | `install-schema.php` | Schema only | No query uses this table outside schema creation |
| `ak_user_roles` | `install-schema.php` | Schema only | No query uses this table outside schema creation |
| `ak_projects` | `api/admin/projects.php`, `api/admin/dashboard.php`, `api/admin/customers.php`, `api/admin/financial-statement.php`, `api/admin/reports.php`, `api/admin/payment-plans.php`, `api/admin/payments.php`, `api/admin/notifications.php`, `api/admin/employee-project-assignments.php`, `api/admin/employee-project-allocations.php` | SELECT (list, lookup, stats), INSERT, UPDATE, DELETE | FK parent for most domain tables; dashboard reads active project list and project financial cards |
| `ak_project_images` | `api/admin/project-images.php`, `api/admin/upload-project-image.php` | SELECT, INSERT, UPDATE, DELETE | FK child of ak_projects (ON DELETE CASCADE) |
| `ak_media_library` | `api/admin/media.php`, `api/admin/media-upload.php` | SELECT, INSERT, DELETE | FK child of ak_projects (ON DELETE SET NULL) |
| `ak_site_settings` | `api/admin/site-settings.php`, `install-schema.php` | SELECT, UPDATE, INSERT (seed) | Single-row settings table |
| `ak_contact_requests` | `api/admin/contact-requests.php`, `api/contact-request.php`, `api/admin/backend-canonical-read-model.php`, `api/admin/dashboard.php`, `api/admin/reports.php` | SELECT (list, count), INSERT, UPDATE (status), DELETE | COUNT in dashboard summary and reports aggregates |
| `ak_customers` | `api/admin/customers.php`, `api/admin/payments.php`, `api/admin/payment-plans.php`, `api/admin/dashboard.php`, `api/admin/notifications.php`, `api/admin/financial-statement.php`, `api/admin/reports.php`, `api/admin/backend-canonical-read-model.php` | SELECT (list, detail, count), INSERT, UPDATE, DELETE | FK parent for plans, payments, financial_entries, notifications, customer_projects |
| `ak_customer_projects` | `api/admin/customers.php`, `api/admin/reports.php` | SELECT, INSERT, DELETE (replace on save) | Junction table; replaced wholesale on customer PATCH |
| `ak_payment_plans` | `api/admin/payment-plans.php`, `api/admin/payments.php`, `api/admin/dashboard.php`, `api/admin/notifications.php`, `api/admin/customers.php`, `api/admin/reports.php`, `api/admin/financial-statement.php`, `api/admin/backend-canonical-read-model.php` | SELECT (list, with JOIN to customers/projects), INSERT, UPDATE (status sync), DELETE | Status auto-computed; dashboard reads all customer plans for overdue/upcoming buckets; notifications.php generates entries from this |
| `ak_payments` | `api/admin/payments.php`, `api/admin/customers.php`, `api/admin/dashboard.php`, `api/admin/reports.php`, `api/admin/notifications.php`, `api/admin/backend-canonical-read-model.php`, `api/admin/financial-statement.php` | SELECT (list, sum, JOIN with projects/customers), INSERT, UPDATE, DELETE | Legacy income track; dashboard reads from both this AND ak_financial_entries; triggers plan status sync on write |
| `ak_expenses` | `api/admin/expenses.php`, `api/admin/dashboard.php`, `api/admin/reports.php`, `api/admin/financial-statement.php`, `api/admin/backend-canonical-read-model.php` | SELECT (list, sum), INSERT, UPDATE, DELETE | Legacy expense track; dashboard reads from both this AND ak_financial_entries |
| `ak_customer_notes` | `install-schema.php` | Schema only | Drop scripts exist at `docs/sql/drop_ak_customer_notes.sql`; table is inert |
| `ak_notifications` | `api/admin/notifications.php`, `api/admin/dashboard.php` | SELECT (list, count), INSERT (auto-generate from plans), UPDATE (mark read), DELETE | Generated by reading ak_payment_plans + ak_payments |
| `ak_employees` | `api/admin/employees.php`, `api/admin/employee-roles.php`, `api/admin/employee-cost-periods.php`, `api/admin/employee-project-assignments.php`, `api/admin/employee-project-allocations.php`, `api/admin/dashboard.php`, `api/admin/financial-statement.php` | SELECT (list, lookup), INSERT, UPDATE, DELETE | FK parent for employee sub-tables and financial_entries.employee_id |
| `ak_roles` | `api/admin/roles.php` | SELECT, INSERT, UPDATE (deactivate) | Lookup table for employee role assignments |
| `ak_employee_roles` | `api/admin/employee-roles.php` | SELECT, INSERT, UPDATE (end_date), DELETE | Links employees to roles with date ranges |
| `ak_employee_cost_periods` | `api/admin/employee-cost-periods.php`, `api/admin/employee-project-allocations.php` | SELECT, INSERT, UPDATE (notes), DELETE; SELECT (when calculating allocation cost snapshot) | Allocation endpoint reads cost periods to compute cost snapshots |
| `ak_employee_project_assignments` | `api/admin/employee-project-assignments.php` | SELECT, INSERT, UPDATE, DELETE | Qualitative assignment record; date-bounded |
| `ak_employee_project_allocations` | `api/admin/employee-project-allocations.php` | SELECT, INSERT, UPDATE, DELETE | Quantitative cost allocation; stores cost snapshots at time of entry |
| `ak_expense_cards` | `api/admin/expense-cards.php`, `api/admin/financial-statement.php`, `api/admin/dashboard.php` | SELECT (list, lookup), INSERT, UPDATE (name), DELETE | FK parent for ak_financial_entries.expense_card_id; dashboard reads as "suppliers" |
| `ak_project_expense_transactions` | `api/admin/project-expense-transactions.php` | SELECT (by project_id, with profitability calc), INSERT, UPDATE, DELETE | FK child of ak_projects and ak_expense_cards; multi-currency; independent of ak_expenses and ak_financial_entries |
| `ak_financial_entries` | `api/admin/financial-statement.php`, `api/admin/dashboard.php`, `api/admin/reports.php`, `api/admin/customers.php`, `api/admin/backend-canonical-read-model.php`, `api/admin/canonical-finance-service.php`, `api/admin/canonical-transaction-service.php`, `api/admin/canonical-shadow-write-harness.php` | SELECT (all directions, JOINs with projects/employees/expense_cards), INSERT, UPDATE, DELETE; COUNT, SUM, GROUP BY | Central canonical ledger; direction+status+group_tag drive all financial summaries; card_type determines counterparty |
| `ak_payment_plan_settlements` | `api/admin/canonical-transaction-service.php`, `api/admin/canonical-finance-service.php` | SELECT, INSERT (flag-gated) | Links financial_entries to payment_plans; only active when CANONICAL_SETTLEMENT_ENABLED=true |
| `ak_cookie_consents` | `api/cookie-consent.php` | INSERT | Public-facing; no admin reads |
| `ak_push_subscriptions` | `api/admin/push-utils.php`, `api/admin/push-subscribe.php`, `api/admin/push-unsubscribe.php`, `api/admin/send-push-test.php` | SELECT, INSERT (CREATE TABLE IF NOT EXISTS at runtime), UPDATE (last_used_at), DELETE | Created in push-utils.php runtime DDL, not in install-schema.php |

---

## 4. Frontend Dependency Map

| Table | Frontend Files | Usage |
|---|---|---|
| `ak_admin_users` | `src/pages/admin/AdminAuth.tsx`, `src/hooks/useAuth.tsx` | Login form submits credentials; session check on every admin page |
| `ak_profiles` | None | Not surfaced in any frontend file |
| `ak_user_roles` | None | Not surfaced in any frontend file |
| `ak_projects` | `src/pages/admin/AdminProjects.tsx`, `src/pages/admin/AdminProjectEdit.tsx`, `src/pages/admin/AdminProjectFinance.tsx`, `src/pages/admin/AdminProjectExpenses.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminCustomers.tsx`, `src/pages/admin/AdminCollections.tsx`, `src/pages/admin/AdminPaymentPlans.tsx`, `src/pages/site/Projects.tsx`, `src/pages/site/ProjectDetail.tsx` | Full CRUD in admin; displayed in public site |
| `ak_project_images` | `src/pages/admin/AdminProjectEdit.tsx`, `src/pages/admin/AdminMedia.tsx` | Image management per project |
| `ak_media_library` | `src/pages/admin/AdminMedia.tsx` | General media library CRUD |
| `ak_site_settings` | `src/pages/admin/AdminSettings.tsx`, public layout components | Read for public site; edit in admin settings |
| `ak_contact_requests` | `src/pages/admin/AdminContacts.tsx` | View/manage contact form submissions |
| `ak_customers` | `src/pages/admin/AdminCustomers.tsx`, `src/pages/admin/AdminCustomerEdit.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminCustomerFinance.tsx`, `src/pages/admin/AdminCollections.tsx`, `src/pages/admin/AdminPaymentPlans.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/components/admin/QuickCreateCustomerButton.tsx` | Full CRUD; list, detail, edit, quick-create |
| `ak_customer_projects` | `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminCustomerEdit.tsx`, `src/pages/admin/AdminCustomers.tsx`, `src/pages/admin/AdminReports.tsx` | Read project links on customer detail; written on customer save |
| `ak_payment_plans` | `src/pages/admin/AdminPaymentPlans.tsx`, `src/pages/admin/AdminCollections.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/lib/customerMasterData.ts` | Full CRUD; overdue/upcoming bucket display; plan status display |
| `ak_payments` | `src/pages/admin/AdminCollections.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/pages/admin/AdminReports.tsx`, `src/lib/customerMasterData.ts` | Full CRUD in collections; drives plan status sync |
| `ak_expenses` | `src/pages/admin/AdminExpenses.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/pages/admin/AdminReports.tsx` | Full CRUD; included in legacy finance total |
| `ak_customer_notes` | None | Not referenced in any src/ file found |
| `ak_notifications` | `src/pages/admin/AdminNotifications.tsx`, `src/components/admin/NotificationBell.tsx`, `src/components/admin/AdminLayout.tsx` | View, mark-read, delete; unread badge in layout |
| `ak_employees` | `src/pages/admin/AdminEmployees.tsx`, `src/pages/admin/AdminEmployeeDetail.tsx`, `src/pages/admin/AdminEmployeeFinance.tsx`, `src/pages/admin/AdminEmployeeAllocations.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/components/admin/finance/FinancialStatementPage.tsx` | Full CRUD; personnel financial card in dashboard |
| `ak_roles` | `src/components/admin/employees/EmployeeRolesPanel.tsx`, `src/pages/admin/AdminEmployeeDetail.tsx` | Role assignment UI |
| `ak_employee_roles` | `src/components/admin/employees/EmployeeRolesPanel.tsx` | View and manage role history per employee |
| `ak_employee_cost_periods` | `src/components/admin/employees/CostPeriodsPanel.tsx`, `src/pages/admin/AdminEmployeeDetail.tsx` | View/edit monthly cost breakdown |
| `ak_employee_project_assignments` | `src/components/admin/employees/ProjectAssignmentsPanel.tsx`, `src/components/admin/projects/ProjectEmployeeCostPanel.tsx` | View assignments from employee and project sides |
| `ak_employee_project_allocations` | `src/pages/admin/AdminEmployeeAllocations.tsx`, `src/components/admin/projects/ProjectEmployeeCostPanel.tsx` | Enter and view monthly cost allocations |
| `ak_expense_cards` | `src/pages/admin/AdminExpenseCards.tsx`, `src/pages/admin/AdminExpenseCardFinance.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/components/admin/finance/FinancialStatementPage.tsx` | CRUD for supplier/vendor catalog; supplier financial cards |
| `ak_project_expense_transactions` | `src/pages/admin/AdminProjectExpenses.tsx` | Line-item expense entry per project; multi-currency |
| `ak_financial_entries` | `src/pages/admin/AdminProjectFinance.tsx`, `src/pages/admin/AdminCustomerFinance.tsx`, `src/pages/admin/AdminEmployeeFinance.tsx`, `src/pages/admin/AdminExpenseCardFinance.tsx`, `src/pages/admin/AdminDashboard.tsx`, `src/pages/admin/AdminCustomerDetail.tsx`, `src/pages/admin/AdminReports.tsx`, `src/components/admin/finance/FinancialStatementPage.tsx` | CRUD via financial-statement.php; canonical ledger read in dashboard |
| `ak_payment_plan_settlements` | Not directly exposed in any src/ file | Backend-only; flag-gated |
| `ak_cookie_consents` | Cookie consent banner (public site) | Write-only from admin perspective |
| `ak_push_subscriptions` | `src/components/admin/AdminPushNotificationsPanel.tsx` | Subscribe/unsubscribe/test push notifications |

---

## 5. Route/UI Map

| Route | Page Component | Tables Used (Read) | Tables Written/Deleted |
|---|---|---|---|
| `/admin` | `AdminDashboard` | ak_projects, ak_contact_requests, ak_notifications, ak_customers, ak_payment_plans, ak_payments, ak_financial_entries, ak_expense_cards, ak_employees, ak_expenses | None (read-only) |
| `/admin/projeler` | `AdminProjects` | ak_projects | ak_projects (create, update, delete) |
| `/admin/projeler/:id` | `AdminProjectEdit` | ak_projects, ak_project_images | ak_projects, ak_project_images |
| `/admin/projeler/:id/finans` | `AdminProjectFinance` | ak_financial_entries, ak_projects, ak_customers, ak_employees, ak_expense_cards, ak_payment_plans, ak_payments | ak_financial_entries (create, update, delete) |
| `/admin/projeler/:id/giderler` | `AdminProjectExpenses` | ak_project_expense_transactions, ak_expense_cards, ak_projects | ak_project_expense_transactions (create, update, delete) |
| `/admin/musteriler` | `AdminCustomers` | ak_customers, ak_payment_plans, ak_payments, ak_financial_entries, ak_customer_projects, ak_projects | ak_customers (create via QuickCreate) |
| `/admin/musteriler/yeni` | `AdminCustomerEdit` | ak_projects | ak_customers (create), ak_customer_projects (replace) |
| `/admin/musteriler/:id` | `AdminCustomerDetail` | ak_customers, ak_customer_projects, ak_projects, ak_payment_plans, ak_payments, ak_financial_entries | None (read-only detail view) |
| `/admin/musteriler/:id/duzenle` | `AdminCustomerEdit` | ak_customers, ak_projects, ak_customer_projects | ak_customers (update), ak_customer_projects (replace) |
| `/admin/musteriler/:id/finans` | `AdminCustomerFinance` | ak_financial_entries, ak_customers, ak_employees, ak_expense_cards, ak_projects, ak_payment_plans, ak_payments, ak_expenses | ak_financial_entries (create, update, delete) |
| `/admin/gelenler` | `AdminPaymentPlans` | ak_payment_plans, ak_customers, ak_projects | ak_payment_plans (create, update, delete) |
| `/admin/tahsilatlar` (inferred) | `AdminCollections` | ak_payments, ak_customers, ak_projects, ak_payment_plans | ak_payments (create, update, delete) |
| `/admin/giderler` | `AdminExpenses` | ak_expenses, ak_customers, ak_projects | ak_expenses (create, update, delete) |
| `/admin/personeller` | `AdminEmployees` | ak_employees | ak_employees (create, update, delete) |
| `/admin/personeller/:id` | `AdminEmployeeDetail` | ak_employees, ak_roles, ak_employee_roles, ak_employee_cost_periods, ak_employee_project_assignments | ak_employee_roles, ak_employee_cost_periods, ak_employee_project_assignments |
| `/admin/personeller/:id/finans` | `AdminEmployeeFinance` | ak_financial_entries, ak_employees, ak_projects, ak_customers, ak_expense_cards | ak_financial_entries (create, update, delete) |
| `/admin/personeller/:id/tahsisat` | `AdminEmployeeAllocations` | ak_employee_project_allocations, ak_employee_cost_periods, ak_employees, ak_projects | ak_employee_project_allocations (create, update, delete) |
| `/admin/tedarikci-kartlari` (inferred) | `AdminExpenseCards` | ak_expense_cards | ak_expense_cards (create, update, delete) |
| `/admin/tedarikci-kartlari/:id/finans` (inferred) | `AdminExpenseCardFinance` | ak_financial_entries, ak_expense_cards, ak_projects, ak_customers, ak_employees | ak_financial_entries (create, update, delete) |
| `/admin/finans` | `AdminFinance` | ak_payment_plans, ak_payments, ak_expenses, ak_financial_entries, ak_customers, ak_projects | Likely none (summary view) |
| `/admin/bildirimler` | `AdminNotifications` | ak_notifications | ak_notifications (mark read, delete) |
| `/admin/raporlar` | `AdminReports` | ak_customers, ak_payment_plans, ak_payments, ak_expenses, ak_financial_entries, ak_projects, ak_customer_projects, ak_contact_requests | None (export/view only) |
| `/admin/medya` | `AdminMedia` | ak_project_images, ak_media_library | ak_project_images, ak_media_library |
| `/admin/iletisim-talepleri` | `AdminContacts` | ak_contact_requests | ak_contact_requests (status update, delete) |
| `/admin/ayarlar` | `AdminSettings` | ak_site_settings, ak_push_subscriptions | ak_site_settings, ak_push_subscriptions |
| `/admin/sql` | `AdminSqlEditor` | Any (raw SQL) | Any (raw SQL) |

---

## 6. Dashboard and Report Data Sources

### Dashboard (`/api/admin/dashboard.php`)

The dashboard is the most complex consumer. It reads from:

| Dashboard Section | Tables Read | Method |
|---|---|---|
| Summary: project counts | `ak_projects` | COUNT with CASE |
| Summary: contact stats | `ak_contact_requests` | COUNT with CASE |
| Summary: unread notifications | `ak_notifications` | COUNT WHERE is_read=0 |
| Summary: customer count | `ak_customers` | COUNT |
| Summary: financial totals (legacy) | `ak_payments`, `ak_expenses` | SUM per period |
| Summary: financial totals (canonical) | `ak_financial_entries` | SUM by direction/status/currency |
| Overdue/upcoming plans | `ak_payment_plans`, `ak_payments` | Full scan + PHP bucketing logic |
| Active projects list | `ak_projects` | SELECT WHERE not completed |
| Recent movements | `ak_financial_entries`, `ak_payments`, `ak_expenses`, `ak_projects` | UNION ALL query |
| Monthly financials | `ak_financial_entries`, `ak_payments`, `ak_expenses` | GROUP BY month (PHP) |
| Customer financial cards | `ak_customers`, `ak_payment_plans`, `ak_payments` | PHP aggregation |
| Project financial cards | `ak_projects`, `ak_financial_entries`, `ak_payment_plans`, `ak_payments` | PHP aggregation |
| Supplier financial cards | `ak_expense_cards`, `ak_financial_entries`, `ak_payment_plans` | PHP aggregation |
| Personnel financial cards | `ak_employees`, `ak_financial_entries` | PHP aggregation |
| Financial drilldowns | `ak_payments`, `ak_payment_plans`, `ak_customers`, `ak_financial_entries`, `ak_expense_cards`, `ak_employees`, `ak_projects` | Individual queries per drilldown |
| Expense category intelligence | `ak_financial_entries`, `ak_expense_cards` | PHP category grouping |
| Cashflow forecast/command center | `ak_payment_plans`, `ak_payments`, `ak_financial_entries`, `ak_expense_cards`, `ak_employees` | PHP aggregation over payable obligations |

### Reports (`/api/admin/reports.php`)

Full table dumps of: `ak_customers`, `ak_payment_plans`, `ak_payments`, `ak_expenses`, `ak_financial_entries`, `ak_projects`, `ak_customer_projects`, `ak_contact_requests`

Notable omission from reports: `ak_employees` and all employee sub-tables are not included in the reports endpoint.

---

## 7. Duplicate / Overlap Analysis

### Overlap 1: `ak_payments` vs `ak_financial_entries` (income)

- `ak_payments` stores a simple flat record: customer, project, plan link, amount, date, method
- `ak_financial_entries` with `direction='Gelir'` and `card_type='customer'` represents the same concept with far more fields
- The dashboard explicitly combines both: `total_payments = legacy_payments_sum + canonical_entries_sum`
- The "recent movements" UNION query in dashboard.php shows payments as synthetic financial entry rows
- `financial-statement.php` appends `ak_payments` rows (prefixed `legacy-payment-`) to financial entry results for project/customer statements
- **Risk:** If both systems are active simultaneously, income can be double-counted (mitigated by the canonical read flags, but fragile)
- `ak_payment_plan_settlements` links `ak_financial_entries` to `ak_payment_plans` in the canonical track, while `ak_payments.payment_plan_id` serves the same purpose in the legacy track

### Overlap 2: `ak_expenses` vs `ak_financial_entries` (costs)

- `ak_expenses` stores: project, customer, title, category, amount, date — a flat expense record
- `ak_financial_entries` with `direction='Gider'` represents the same concept with expense_card_id, employee_id, group_tag, status, currency, etc.
- Dashboard combines both the same way as income
- `financial-statement.php` appends `ak_expenses` rows (prefixed `legacy-expense-`) to entry results
- **Risk:** Same double-count risk as income track

### Overlap 3: `ak_project_expense_transactions` vs `ak_expenses`

- Both record project-level costs
- `ak_project_expense_transactions` adds: `expense_item_id` FK to `ak_expense_cards`, multi-currency with exchange rate snapshot, `expense_item_name_snapshot`
- `ak_expenses` is simpler: text category, single currency (implied TRY), optional project/customer link
- `ak_project_expense_transactions` is served by a completely separate API endpoint (`project-expense-transactions.php`) and page (`AdminProjectExpenses`)
- Neither is joined to the other in any query found
- The dashboard does not include `ak_project_expense_transactions` in its financial totals
- **Risk:** Project costs may be recorded in three places: `ak_expenses`, `ak_financial_entries`, and `ak_project_expense_transactions`

### Overlap 4: `ak_payment_plans` settlement tracking

- `ak_payment_plans.paid_amount` is a denormalized balance updated by `sync_customer_account_plan_statuses()` in `payments.php`
- `ak_payment_plan_settlements` is a proper settlement ledger linking `ak_financial_entries` to `ak_payment_plans`
- Both track how much has been paid against a plan, but through entirely different mechanisms
- The settlements table is flag-gated and inactive unless `CANONICAL_SETTLEMENT_ENABLED=true`

### Overlap 5: `ak_employee_project_assignments` vs `ak_employee_project_allocations`

- Assignments are qualitative: which project, what dates, optional notes
- Allocations are quantitative: which project, which month, how many days, calculated cost with snapshot
- Both exist per employee-project pair; neither references the other via FK
- The allocation effectively supersedes the assignment for cost tracking purposes, but the assignment is shown separately in the UI

---

## 8. Minimum Table Count Opportunities

| Candidate | Tables Involved | Why It May Be Simplified | Risk | Owner Decision Needed |
|---|---|---|---|---|
| Drop `ak_customer_notes` | `ak_customer_notes` | Table is schema-only; drop scripts already exist in docs/sql/; notes field exists directly on `ak_customers` | Low — no data or code references it | Confirm no production data exists before drop |
| Drop `ak_profiles` | `ak_profiles` | Schema-only; no API reads/writes found; email/display_name not used anywhere | Low | Confirm this was a Supabase migration artifact and is empty in production |
| Drop `ak_user_roles` | `ak_user_roles` | Schema-only; no API reads/writes found; admin role stored directly in `ak_admin_users.role` | Low | Confirm this was a Supabase migration artifact and is empty in production |
| Retire `ak_payments` in favour of `ak_financial_entries` | `ak_payments`, `ak_financial_entries` | The canonical ledger can fully represent customer income; legacy track requires dual-read everywhere | High — all plan status sync, notifications, and receivable calculations currently use `ak_payments`; migration would require re-pointing all consumers | Owner must decide cutover date; requires migrating historical ak_payments rows to ak_financial_entries |
| Retire `ak_expenses` in favour of `ak_financial_entries` | `ak_expenses`, `ak_financial_entries` | Same as above; canonical ledger can represent general expenses | High — similar migration scope | Same owner decision as above |
| Clarify role of `ak_project_expense_transactions` | `ak_project_expense_transactions`, `ak_expenses`, `ak_financial_entries` | Three parallel ways to record project costs; only `ak_project_expense_transactions` is multi-currency; unclear which is authoritative | Medium — removing it removes multi-currency project expense capability | Owner needs to decide whether this replaces `ak_expenses` for project costs or is a parallel feature |
| Simplify `ak_payment_plan_settlements` | `ak_payment_plan_settlements`, `ak_payment_plans`, `ak_payments` | Canonical settlement is flag-gated and inactive; `paid_amount` denormalization in `ak_payment_plans` serves the same purpose currently | Medium — activating settlements enables audit trail; deactivating them removes complexity | Owner must decide whether to activate, defer, or remove the settlement system |
| Consolidate `ak_employee_project_assignments` into `ak_employee_project_allocations` | `ak_employee_project_assignments`, `ak_employee_project_allocations` | Assignments are qualitative notes; allocations are the quantitative truth; an allocation implicitly proves assignment | Low-Medium — assignments may hold notes/context that allocations do not | Owner can decide if assignment notes are needed or if allocations plus employee notes suffice |

---

## 9. Recommended Review Order

Review tables in this order to maximally reduce complexity with minimum risk:

1. **`ak_profiles`, `ak_user_roles`, `ak_customer_notes`** — Confirm empty in production and drop. Zero code impact.
2. **`ak_payment_plan_settlements`** — Decide: activate (enables audit trail) or remove (reduces complexity). Currently dead code.
3. **`ak_project_expense_transactions`** — Decide its relationship to `ak_expenses` and `ak_financial_entries`. If it's the authoritative project cost record, document it. If it's parallel/duplicate, merge or remove.
4. **`ak_expenses` retirement** — Once `ak_financial_entries` canonical track is confirmed stable, plan migration of historical expense data and retire the legacy table.
5. **`ak_payments` retirement** — Harder than expenses because plan status sync and notifications depend on it. Migrate only after settlements system is activated and proven.
6. **`ak_employee_project_assignments`** — Low priority; decide if the qualitative record adds value over allocations.
7. **`ak_employee_project_allocations` dashboard integration** — Currently not included in main financial totals (dashboard reads `ak_financial_entries` for employee costs, not allocations). Decide if allocations should feed into project cost totals.

---

## 10. Table 9 Recommendation

**Proposed next table: none at this time.** Based on the audit, the project has sufficient table surface for its described scope ("a simple advanced Excel replacement"). The more valuable engineering work is retiring the three schema-only tables (`ak_profiles`, `ak_user_roles`, `ak_customer_notes`) and resolving the dual-track financial system before adding any new table.

If a ninth new table were to be proposed, the most defensible candidate would be:

**`ak_project_budget_lines`** — a per-project budget/forecast table that answers "what was budgeted for this project" separate from what was actually spent. This would allow the financial drilldowns to show variance (budget vs. actual). Currently the system has no planned/budget concept at the project level (only payment plan receivables on the income side).

**Owner questions before proceeding:**
1. Is the project meant to track project budgets/estimates separate from actuals?
2. Should `ak_project_expense_transactions` be the authoritative cost record per project (replacing `ak_expenses` for project costs), or is it a supplementary multi-currency view?
3. What is the timeline for fully retiring `ak_payments` and `ak_expenses` in favour of `ak_financial_entries`?
4. Should `ak_employee_project_allocations` feed into dashboard project cost totals, or does that remain purely driven by `ak_financial_entries`?
