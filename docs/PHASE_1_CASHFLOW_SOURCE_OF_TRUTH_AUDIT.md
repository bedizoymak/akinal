# Phase 1 — Cashflow Source-of-Truth Audit

Audit date: 14 June 2026

## Executive Summary

- **Current cashflow readiness:** Not reliable as a single accounting source of truth. Individual customer collection and payment-plan calculations are reasonably defined, but company and project cashflow totals combine three independently writable transaction stores.
- **Main accounting risks:**
  - The same business event can be recorded in both `ak_payments` or `ak_expenses` and `ak_financial_entries`, then counted twice.
  - Planned customer receivables use `ak_payment_plans`, while planned personnel/supplier obligations can exist both as payment plans and planned ledger entries.
  - Manual `paid_amount` can represent settlement without a corresponding dated cash transaction.
- **Main calculation risks:**
  - Dashboard, Finance, Reports, and financial statements do not all use the same calculation path.
  - Project profitability excludes records whose `project_id` is null, even when they have valid customer/personnel/supplier ownership.
  - General expense rows have no Resmi/Gayri Resmi field and are always normalized as Resmi TRY expenses.
  - Personnel and supplier payment plans have no actual payment table/linkage equivalent to customer `ak_payments`.
- **Recommended source-of-truth direction:** Use `ak_financial_entries` as the canonical cash movement and accounting ledger, with explicit origin/reference fields and uniqueness rules. Keep `ak_payment_plans` as the canonical schedule/obligation table. Treat `ak_payments` and `ak_expenses` as legacy operational inputs only during a controlled migration, with each row linked one-to-one to a canonical ledger entry. Do not sum legacy and ledger rows without identity-based deduplication.

The current model is usable for operational follow-up when users consistently choose one entry path. It is not safe for authoritative company cashflow or project profitability reporting while parallel entry paths remain independent.

## Database Table Map

| Table | Current purpose | Ownership/linkage | Account separation | Cashflow safety |
|---|---|---|---|---|
| `ak_payment_plans` | Scheduled customer receivables and personnel/supplier obligations | Exactly one of `customer_id`, `employee_id`, or `expense_card_id` is enforced by PHP; optional `project_id` | `account_type` supports `resmi`/`gayri_resmi` | Safe as an obligation schedule, not as proof of cash movement |
| `ak_payments` | Realized customer collections | Required `customer_id`; optional `project_id` and `payment_plan_id` | `account_type` applied and checked against linked plan | Best-defined realized customer cash source, but duplicates ledger income if both are entered |
| `ak_expenses` | Realized general/project/customer expenses | Optional `project_id` and `customer_id`; no personnel/supplier owner | No account field; converted to Resmi | Operational expense source only; incomplete for account separation and duplicate-prone |
| `ak_financial_entries` | Generic multi-currency ledger for customer, personnel, supplier, and project statements | Optional `project_id`; exactly one card owner is enforced by PHP | `group_tag` supports Resmi/Gayri Resmi | Structurally strongest candidate for canonical ledger, but currently independently writable beside legacy tables |
| `ak_customers` | Customer master | Referenced by plans, payments, expenses, entries | None on master | Ownership lookup only |
| `ak_customer_projects` | Customer/project association | Many-to-many customer/project link | None | Does not automatically assign finance records to a project |
| `ak_projects` | Project master | Referenced optionally by all finance stores | None on master | Profitability grouping key; null linkage causes exclusion |
| `ak_employees` | Personnel master | Referenced by plans and ledger entries | None on master | No dedicated realized-payment table |
| `ak_expense_cards` | Supplier/expense-card master | Referenced by plans and ledger entries | None on master | No dedicated realized-payment table |

### Schema observations

- `ak_payment_plans.customer_id` and `project_id` have foreign keys. `employee_id` and `expense_card_id` are indexed but have no installer foreign keys.
- `ak_payments` has foreign keys to customer, project, and payment plan.
- `ak_expenses` has foreign keys to project and customer.
- `ak_financial_entries` has foreign keys to project, customer, employee, and expense card.
- Most finance ownership foreign keys use `ON DELETE SET NULL`, preserving amounts but potentially removing reporting ownership.
- Legacy `ak_payments` and `ak_expenses` are implicitly TRY. Ledger entries support TRY, USD, and EUR.

## Frontend Cashflow Map

| Frontend area | Data read | Main calculations | Source-of-truth assessment |
|---|---|---|---|
| `AdminDashboard` | Combined response from `dashboard.php` | Displays backend totals, monthly union totals, recent movements, customer plan follow-up | Mixed source; duplicate-prone |
| `AdminCollections` | `ak_payments`, customers, projects, plans | CRUD for realized customer collection | Operational source for customer cash receipts |
| `AdminExpenses` | `ak_expenses`, customers, projects | CRUD and category totals | Operational source for general expenses |
| `AdminCustomers` | Plans and payments | Account-scoped allocation, balance, paid/remaining | Safe for customer schedule follow-up if data entry is consistent |
| `AdminCustomerDetail` | Customer plans and payments | Explicit-link allocation plus unlinked FIFO, manual paid status | Strong customer receivable view; does not represent all ledger income |
| `FinancialStatementPage` customer | Ledger entries plus synthetic legacy payments/expenses; plans/payments | Ledger summaries and separate plan summaries | Two parallel summaries; duplicate rows possible |
| `FinancialStatementPage` project | Ledger entries plus project-linked legacy payments/expenses | Realized/planned income, expense, net by currency/group | Excludes null-project records; duplicate-prone |
| `FinancialStatementPage` personnel | Ledger entries and personnel plans | Ledger payment/cost summary; separate plan paid/remaining cards | Plans cannot be settled by `ak_payments`; manual status or separate ledger entry is required |
| `FinancialStatementPage` supplier | Ledger entries and supplier plans | Ledger expense summary; separate plan paid/remaining cards | Same split model as personnel |
| `AdminFinance` | All four finance tables | Converts payments/expenses to synthetic ledger entries, then calls `summarizeLedgerFinance` | Mixed source; consistent internally but duplicate-prone |
| `AdminReports` | All four finance tables | Project/general reports use synthetic combined ledger; customer reports use plans/payments; expense report uses only expenses | Different report tabs use different sources |
| Project finance cards | Combined entries filtered by `project_id` | Realized income/expense, planned income/expense, net | Not reliable if linkage is missing or events are duplicated |

## Backend Endpoint Map

| Endpoint | Tables | Behavior relevant to cashflow |
|---|---|---|
| `GET /api/admin/dashboard.php` | Payments, expenses, entries, plans, owners/projects | Adds ledger totals to legacy totals; uses `UNION ALL` for movements/monthly figures |
| `GET /api/admin/finance-summary.php` | All four finance tables | Returns raw full-table datasets; frontend performs calculations |
| `GET /api/admin/reports.php` | All four finance tables plus lookups | Returns raw datasets and legacy-only aggregate fields |
| `GET/POST/PATCH/DELETE /api/admin/financial-statement.php` | Entries, plans, payments, expenses, lookups | CRUD for ledger; GET merges legacy rows for project/customer statements |
| `GET/POST/PATCH/DELETE /api/admin/payment-plans.php` | Plans and payments | Manages obligations and synchronizes customer plan status from collections |
| `GET/POST/PATCH/DELETE /api/admin/payments.php` | Payments and plans | Manages customer collections and recalculates customer/account plan statuses |
| `GET/POST/PATCH/DELETE /api/admin/expenses.php` | Expenses | Manages realized legacy expenses with optional project/customer |
| `GET /api/admin/customers.php` | Customers, plans, payments, project links | Supplies customer balance and detail inputs |
| `GET/DELETE /api/admin/employees.php` | Employees, plans, entries | Master CRUD and deletion guards; no realized payment endpoint |
| `GET/DELETE /api/admin/expense-cards.php` | Expense cards, plans, entries | Master CRUD and deletion guards; no realized supplier-payment endpoint |

### Backend calculation duplication

- Customer collection allocation/status logic is separately implemented in:
  - `src/lib/finance.ts`
  - `payment-plans.php`
  - `payments.php`
  - `dashboard.php`
  - reminder logic in `notifications.php`
- Dashboard company totals directly add ledger and legacy totals.
- Project/customer financial statements merge ledger and legacy rows without deduplication.
- Finance and Reports repeat the legacy-to-ledger conversion in TypeScript.

## Calculation Helper Map

### `src/lib/finance.ts`

| Helper | Purpose | Safety notes |
|---|---|---|
| `safeNumber`, `sumBy` | Numeric normalization and summation | Safe basic utilities |
| `paidForPlan` | Sums payments explicitly linked to a plan | Does not include unlinked allocation |
| `effectivePaidForPlan` | Uses maximum of manual paid state and allocated collections | Prevents simple double addition, but manual settlement is not a dated cash event |
| `allocateCollectionsToPlans` | Keeps explicit links; applies unlinked customer/account FIFO | Correct operational rule for current customer model |
| `derivePlanStatus` | Computes paid/partial/overdue/waiting | Partially duplicated in PHP |
| `summarizeLedgerFinance` | Summarizes a ledger-like array by status, direction, currency, group, date | Safe only if input rows are deduplicated and canonically classified |
| `summarizeFinance` | Adds legacy payments/expenses to ledger totals and uses plans for receivables | Explicitly duplicate-prone; currently less central than the synthetic-ledger path |

### `src/lib/financialEntries.ts`

Used by `FinancialStatementPage` for signed multi-currency totals, project/card names, balances, and currency differences. It operates correctly on the supplied entries but cannot determine whether two rows represent the same business event.

### PHP logic

- `sync_customer_account_plan_statuses()` exists independently in both payment endpoints.
- `classify_dashboard_customer_plans()` independently implements allocation and follow-up classification.
- Backend summary SQL does not use a shared accounting service or canonical view.
- No origin ID, source table, transfer ID, reconciliation ID, or uniqueness rule connects a legacy transaction to a ledger entry.

## Customer Cashflow

### Current model

- Planned receivable: `ak_payment_plans` with `customer_id`.
- Realized collection: `ak_payments`.
- Optional alternate realized/planned customer movement: `ak_financial_entries` with `card_type = customer`.
- Customer/project relationship: `ak_customer_projects`, but finance rows require their own `project_id`.

### Paid and remaining logic

- Explicitly linked collections stay on their selected plan.
- Unlinked collections are allocated FIFO by due date within the same customer and account type.
- `effectivePaidForPlan()` uses the greater of manual paid amount and allocated collections, capped at plan amount.
- A manually marked paid plan can show as fully paid without an `ak_payments` row and therefore without a true cash date/method/document.
- Overdue views commonly exclude any partially paid plan from overdue totals because they require `paid <= 0`. The unpaid portion of a past-due partial plan is therefore not consistently reported as overdue cash gap.

### Account separation

- Resmi/Gayri Resmi is applied to customer plans and payments.
- Allocation groups by customer and account type.
- Legacy payments are converted to corresponding ledger group tags.
- Customer ledger entries can independently use either group, creating a second income path.

### Ownership and project linkage

- Customer ownership is required for `ak_payments`.
- Project linkage is optional. A payment can be linked to a customer and plan but not to the plan's project.
- The payment API validates customer/account compatibility with a linked plan but does not enforce matching `project_id`.
- `ak_customer_projects` does not repair or infer missing finance linkage.

### Cashflow safety

- **Customer receivable follow-up:** conditionally safe.
- **Realized customer cash:** safe only if `ak_payments` is the exclusive entry path.
- **Company/project income reporting:** unsafe while independent customer ledger income can duplicate collections.

## Personnel Cashflow

### Current model

- Personnel master: `ak_employees`.
- Planned personnel payments: `ak_payment_plans.employee_id`.
- Realized/planned personnel movements: `ak_financial_entries.employee_id`.
- No `ak_payments.employee_id` schema field or dedicated personnel-payment table exists.

### Calculation behavior

- Personnel statement ledger cards use realized/planned `Gider` entries.
- A separate payment-plan section calculates paid/remaining using plan status/manual `paid_amount`.
- `financial-statement.php` returns no payments for personnel, so allocation receives an empty collection list.
- Personnel plans are therefore settled only by manual status/paid amount, not by linking a dated realized ledger payment.

### Account and project separation

- Plans use `account_type`; ledger entries use `group_tag`.
- Both support optional project linkage, but there is no enforced equality between a plan and a related ledger payment because no relationship exists.
- UI validation requires a project for ledger entry creation, but backend `project_id` is nullable and does not verify project existence before insert.

### Cashflow safety

- **Personnel ledger cash totals:** conditionally safe when all payments are entered only as realized ledger expenses.
- **Personnel plan paid/remaining:** operational/manual, not reconciled to cash.
- **Personnel payable and cash gap:** unsafe as an authoritative figure because plans and ledger planned expenses can duplicate obligations.

## Supplier / Expense Card Cashflow

### Current model

- Supplier/expense-card master: `ak_expense_cards`.
- Planned supplier obligations: `ak_payment_plans.expense_card_id`.
- Realized/planned supplier movements: `ak_financial_entries.expense_card_id`.
- General `ak_expenses` rows cannot reference an expense card.

### Calculation behavior

- Supplier statements calculate realized/planned expenses from ledger entries.
- Payment-plan cards separately calculate total, paid, remaining, overdue, and upcoming values.
- Like personnel, no realized payment row is linked to a supplier plan. Manual plan status is the only plan settlement input.

### Account and project separation

- Resmi/Gayri Resmi exists separately on plans and ledger entries.
- Project linkage is optional on both and not reconciled.
- A supplier invoice can be entered as planned ledger expense, supplier plan, or both.
- A supplier payment can be entered as realized ledger expense and manually marked paid on the plan, with no shared transaction identity.

### Cashflow safety

- **Supplier ledger cash:** conditionally safe as a standalone ledger.
- **Supplier payable schedule:** conditionally safe as a standalone plan register.
- **Combined supplier cash/payable reporting:** unsafe because settlement and obligation records are not relationally connected.

## General Expenses

### Supported categories

The fixed frontend suggestions are:

- Malzeme
- İşçilik
- Ruhsat / Resmi İşlemler
- Mimari / Proje
- Taşeron
- Nakliye
- Şantiye Gideri
- Ofis Gideri
- Diğer

Custom category strings are also accepted, so demolition, machine rental, iron, cement, permits, government payments, and site costs can be recorded. However, category naming is uncontrolled and can fragment reporting through spelling/casing variants.

### Current source

- `AdminExpenses` writes `ak_expenses`.
- Expense Report reads only `ak_expenses`.
- Finance/General Summary/Project Finance convert `ak_expenses` into synthetic realized ledger expenses.
- A similar cost can also be entered directly into `ak_financial_entries`.

### Limitations

- `ak_expenses` has no `account_type`, currency, supplier/expense-card, invoice identity, payment status, or plan linkage.
- Every legacy expense is treated as TRY, Resmi, and Gerçekleşti.
- Both project and customer linkage are optional.
- Category describes cost type but does not establish counterparty or payable settlement.

### Cashflow safety

- Safe as a simple realized TRY expense register if used exclusively.
- Not safe for full supplier accounting, multi-currency reporting, Resmi/Gayri Resmi analysis, accrual/payable tracking, or deduplicated project profitability.

## Project Profitability

| Required metric | Current derivation | Reliability |
|---|---|---|
| Total customer income | Realized project-linked payments plus project-linked realized ledger income | Unsafe: duplicate and missing-link risks |
| Collected income | Same combined realized income | Unsafe unless entry paths are exclusive |
| Expected income | Project-linked planned ledger income in project reports; customer plans in separate customer views | Inconsistent; customer plans are not included in project report planned income unless duplicated into ledger |
| Personnel costs | Project-linked realized personnel ledger expenses | Conditionally safe; missing project linkage excludes costs |
| Supplier costs | Project-linked realized expense-card ledger expenses | Conditionally safe; legacy expenses cannot preserve supplier ownership |
| General expenses | Project-linked `ak_expenses` plus project-linked ledger expenses | Unsafe if duplicated |
| Official/unofficial breakdown | Ledger group and payment account type are available; legacy expense is forced Resmi | Incomplete |
| Net profit | Combined realized income minus combined realized expense | Not reliable because duplicate/missing-link risks remain |
| Cash gap | No single canonical formula; plans and planned ledger entries are separate | Not reliable |
| Overdue receivables | Customer payment plans/payments | Partial overdue remainder is inconsistently excluded |
| Overdue payables | Personnel/supplier plans can show overdue; no central project/company report | Incomplete and manually settled |

### Core project issue

Project profitability is grouping-dependent, not ownership-inferred. Every relevant payment, expense, plan, and ledger entry must carry the correct `project_id`. Customer/project association alone is insufficient. Null or mismatched project IDs cause valid company cash events to disappear from project profitability while remaining in company totals.

## Dashboard / Finance / Reports Consistency

| Comparison | Consistent? | Reason |
|---|---|---|
| Customer card vs customer payment report | Mostly | Both use plans/payments and scoped allocation |
| Customer card vs customer financial statement ledger cards | No | Card uses plan/collection model; statement summary includes ledger plus synthetic legacy entries |
| Personnel/supplier plan cards vs statement summary | No | Plans use manual paid state; summary uses ledger status/direction |
| Dashboard vs Finance | Numerically similar when all rows are linked and unique | Both combine legacy and ledger, but implementation is duplicated in PHP vs TypeScript |
| Dashboard vs Reports general summary | Potentially similar | Both combine all three transaction stores; date/group/currency handling differs by implementation |
| Finance project card vs Project Finance Report | Mostly | Both convert legacy rows to ledger-like entries and filter by project |
| Project statement vs project reports | Mostly for realized rows | Both merge project-linked legacy/ledger rows; planned customer plans are absent |
| Expense Report vs Finance total expense | No | Expense Report includes only `ak_expenses`; Finance also includes realized ledger expenses |
| Collections Report vs Finance total income | No | Collections Report includes only `ak_payments`; Finance also includes realized ledger income |
| Resmi/Gayri Resmi company totals | Incomplete | Legacy expense rows are always Resmi; dashboard headline totals do not expose group separation |

The screens can agree while all double-counting the same event. Numerical parity alone is not evidence of accounting correctness.

## Double-Counting Risk

1. A customer collection is saved in `ak_payments` and also entered as a realized customer ledger income.
2. A general/project expense is saved in `ak_expenses` and also entered as a realized ledger expense.
3. A personnel/supplier obligation is entered as both an `ak_payment_plans` row and a planned ledger expense.
4. A personnel/supplier payment is entered as a realized ledger expense while the plan is manually marked paid; separate summaries may present both as payment evidence.
5. A customer plan is manually marked paid and a collection exists. `effectivePaidForPlan()` avoids adding both inside plan calculations, but company realized cash still only reflects actual transaction rows, causing semantic disagreement rather than direct arithmetic duplication.
6. Dashboard `UNION ALL`, financial statement merges, Finance conversions, and Reports conversions have no deduplication key.
7. Imported legacy data may already contain corresponding ledger records from the previous system.

No table currently stores `source_type`, `source_id`, `ledger_entry_id`, `settles_plan_id`, or a business transaction UUID that can prove two rows are the same event.

## Missing Linkage Risk

1. `project_id` is optional on payments, expenses, plans, and ledger entries.
2. A linked payment plan and payment can have different projects; only customer and account type are validated.
3. Customer/project membership does not require finance records to use one of the customer's linked projects.
4. Personnel and supplier plans lack installer foreign keys to their owners.
5. Backend ledger creation accepts nullable/unverified `project_id`; frontend validation alone requires it.
6. Deletion with `ON DELETE SET NULL` can preserve amounts while removing project/customer/personnel/supplier attribution.
7. General expenses cannot link to supplier cards.
8. Personnel/supplier realized ledger entries cannot link to the plan they settle.
9. Legacy expenses have no Resmi/Gayri Resmi linkage.
10. Currency and account semantics are not shared across legacy and ledger models.

## P0 Issues

1. **No canonical realized cash transaction source**
   - `ak_payments`, `ak_expenses`, and `ak_financial_entries` are independently writable and summed together.
   - Authoritative cash balance, net cashflow, and project profit cannot be guaranteed.

2. **No transaction identity or deduplication contract**
   - The system cannot determine whether a legacy row and ledger row represent the same event.
   - Existing reports therefore cannot safely merge these sources.

3. **Project profitability is incomplete and can be materially wrong**
   - Null/mismatched project links exclude real income/costs.
   - Customer plan expected income is absent from project planned-income reporting unless separately entered into the ledger.
   - Duplicate legacy/ledger rows inflate realized profit/loss.

4. **Personnel/supplier plan settlement is not linked to realized payment**
   - A plan and a ledger payment are separate records with no reconciliation relationship.
   - Paid, remaining, overdue payable, and cash timing cannot be audited reliably.

## P1 Issues

1. Past-due partially paid customer plans are not consistently included in overdue totals.
2. General expenses cannot represent account type, currency, or supplier ownership.
3. Payment-to-plan project consistency is not validated.
4. `ak_payment_plans.employee_id` and `expense_card_id` lack database foreign keys.
5. Ledger backend ownership/project validation is weaker than frontend validation.
6. Planned customer income uses plans in customer screens but planned ledger income in project/company reports.
7. Expense and collection detail reports omit ledger-only transactions.
8. Category values are free text and can fragment cost reporting.
9. Accounting calculations are duplicated across frontend and PHP, increasing regression risk.

## P2 Issues

1. Full finance datasets are transferred to the browser and calculated client-side.
2. Legacy rows are forced to TRY; exchange-rate and base-currency policy is undefined.
3. Dashboard and report totals lack reconciliation metadata and drill-down provenance.
4. Manual paid status has no payment date, counterparty transaction, or immutable audit trail.
5. Hard deletion and `SET NULL` ownership behavior weaken historical attribution.
6. Existing tests cover customer allocation helpers but not PHP parity, project profitability, ledger deduplication, or personnel/supplier settlement.

## Recommended Phase 2

Run **Phase 2 — Canonical Cashflow Contract and Migration Design** without immediately rewriting calculations:

1. Define accounting event types: receivable plan, payable plan, realized receipt, realized payment, expense recognition, adjustment, cancellation, and transfer.
2. Approve `ak_financial_entries` as the canonical realized/planned ledger or select another explicit canonical model.
3. Design immutable linkage fields such as `source_type`, `source_id`, `payment_plan_id`, `counterparty_type`, and a unique business transaction ID.
4. Define whether `ak_payment_plans` represents only schedules and how customer, personnel, and supplier plans are settled by canonical transactions.
5. Produce reconciliation SQL that classifies existing rows as unique, probable duplicate, missing project, missing owner, or ambiguous.
6. Define project-link enforcement and permitted company-overhead records.
7. Define Resmi/Gayri Resmi, currency, and category requirements for every event type.
8. Specify migration order, rollback, and report acceptance tests before changing production behavior.

Phase 2 should end with an approved schema/data contract and reconciliation report. Implementation and finance logic changes should begin only after that approval.

## Validation

- `npm run build`: passed with Vite 5.4.21; 2,637 modules transformed.
- `npm run test`: passed, 2 test files and 6 tests.
- `php -l`: all 48 PHP files passed syntax validation.
- PHP emitted the existing nullable-parameter deprecation warning in `api/contact-request.php`; it is unrelated to cashflow behavior.
- No business logic, UI, schema, credentials, or production data were changed.
