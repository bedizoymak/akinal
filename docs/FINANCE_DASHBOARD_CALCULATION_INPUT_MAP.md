# Finance Dashboard Calculation Input Map

Read-only evidence report. No behavior was changed.

## Scope and Assumptions

Evidence sources reviewed:

- `public_html/api/admin/dashboard.php`
- `public_html/api/admin/finance-summary.php`
- `public_html/api/admin/reports.php`
- `public_html/api/admin/financial-statement.php`
- `public_html/api/admin/backend-canonical-read-model.php`
- `public_html/api/admin/canonical-read-flags.php`
- `src/pages/admin/AdminDashboard.tsx`
- `src/pages/admin/AdminFinance.tsx`
- `src/pages/admin/AdminReports.tsx`
- `src/components/admin/finance/FinancialStatementPage.tsx`
- `src/hooks/useFinanceData.ts`
- `src/lib/finance.ts`

Known data context supplied by user:

- `ak_financial_entries`: 764 rows, 760 `DEMO_DATA`, 4 real.
- `ak_payment_plans`: 408 rows.
- `ak_payments`: 0 rows.
- `ak_expenses`: 0 rows.
- `ak_projects`: 3 rows.
- `ak_financial_entries` is intended to become the canonical ledger.
- `ak_payment_plans` is intended as the planning/source schedule table.
- `ak_payments` and `ak_expenses` are legacy/operational tables but still appear in dashboard/report code.

Assumptions:

- This report uses static code evidence only. It does not execute production SQL and does not verify runtime feature flags.
- `canonical_read_select()` returns canonical values only when `CANONICAL_READ_MODEL_ENABLED` is truthy and required fields are present; otherwise it returns legacy values. Default in code is `enabled = false`, `shadow_compare = true`, `fail_closed = true`.
- Frontend reports often receive raw rows from `/api/admin/reports.php` or `/api/admin/finance-summary.php`; their formulas are therefore frontend formulas, not SQL aggregates.

## 1. Executive Summary

### Canonical-ledger based calculations

These calculations primarily use `ak_financial_entries`:

- Dashboard project realized revenue, realized expense, project net profit, official/unofficial project profit, realized cash position, recent canonical movements, project drilldowns, supplier/personnel realized cost, expense-category realized cost, and net cash available cash.
- Finance Summary cards in `AdminFinance.tsx` after legacy rows are converted into synthetic financial entries, then summarized through `summarizeLedgerFinance()`.
- Reports project finance and general summary after `mysqlFinanceEntries()` merges canonical ledger rows with legacy payments/expenses converted into synthetic entries.
- Financial Statement summary cards/charts use `entries` returned from `/api/admin/financial-statement.php`; for project/customer statements that `entries` array can include synthetic legacy payment/expense rows.

### Legacy-table based calculations

These calculations primarily use legacy/operational tables:

- `ak_payment_plans`: planned receivable/payable schedules, remaining amounts, overdue amounts, upcoming collections, customer cards, payment status charts, receivable obligations, overdue report.
- `ak_payments`: legacy collection totals, allocated paid amounts, plan status derivation, collection reports, recent movements, report aggregates. Current known row count is 0, but code still consumes it.
- `ak_expenses`: legacy expense totals, expense reports, recent movements, report aggregates. Current known row count is 0, but code still consumes it.
- `/api/admin/reports.php` `aggregates.total_payments` and `aggregates.total_expenses` are legacy-only through `ak_payments` and `ak_expenses`.

### Mixed calculations

These surfaces explicitly mix canonical and legacy data:

- Dashboard summary totals: `ak_financial_entries` realized TRY income/expense plus `ak_payments`/`ak_expenses` totals.
- Dashboard monthly financials: union/merge of `ak_financial_entries`, `ak_payments`, and `ak_expenses`.
- Dashboard recent movements: SQL `UNION ALL` of `ak_financial_entries`, `ak_payments`, and `ak_expenses`.
- Finance Summary: `financial_entries + paymentToFinancialEntry(ak_payments) + expenseToFinancialEntry(ak_expenses)`.
- Reports: `mysqlFinanceEntries()` merges `ak_financial_entries + ak_payments + ak_expenses`.
- Financial Statement project/customer entries: `fetch_statement_entries()` merges `ak_financial_entries` with synthetic `legacy-payment-*` rows from `ak_payments` and `legacy-expense-*` rows from `ak_expenses`.
- Payable obligations: `fetch_payable_obligations()` combines `ak_payment_plans` payable rows and planned gider rows from `ak_financial_entries`, then deduplicates by signature.

### Double counting risk exists

High risk:

- Any metric combining `ak_financial_entries` realized income/expense with `ak_payments`/`ak_expenses` if legacy rows are also shadow-written or imported into `ak_financial_entries`.
- Financial Statement project/customer `entries`, because backend merges canonical ledger and legacy operational rows before frontend totals/charts.
- Finance Summary and Reports, because frontend converts legacy rows into synthetic ledger entries and appends them to canonical ledger rows.

Medium risk:

- Payment plan remaining/overdue metrics combining `ak_payment_plans.paid_amount`, linked `ak_payments.payment_plan_id`, and unlinked payments allocated by customer/account.
- Payable obligations combining `ak_payment_plans` and planned `ak_financial_entries`, mitigated by `payable_obligation_signature()` but still heuristic.

Low risk:

- Pure counts such as project count, customer count, unread notifications.
- Pure canonical realized project/personnel/supplier rows where no legacy table is appended.

## 2. Dashboard Calculation Map

| metric_name | frontend_page | frontend_component | API_endpoint | backend_file | SQL_or_logic_summary | source_tables | source_columns | key_filters | formula | double_count_risk | recommendation_for_later |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Total projects | `/admin` | `AdminDashboard` summary card | `GET /api/admin/dashboard.php` | `dashboard.php` | `SELECT COUNT(*) AS total_projects FROM ak_projects` with other project stats | `ak_projects` | `id` | none | `COUNT(*)` | low | No action; count-only. |
| Active projects | `/admin` | `AdminDashboard` summary card | same | `dashboard.php` | `SUM(CASE WHEN project_status <> 'Tamamlandı' THEN 1 ELSE 0 END)` | `ak_projects` | `project_status` | none | count non-completed projects | low | Confirm Turkish status values are stable. |
| Published/draft projects | `/admin` | `AdminDashboard` summary card | same | `dashboard.php` | `SUM(CASE WHEN is_published = 1/0 THEN 1 ELSE 0 END)` | `ak_projects` | `is_published` | none | count published and draft rows | low | No action. |
| Total/new contact requests | `/admin` | `AdminDashboard` request cards | same | `dashboard.php` | `COUNT(*)`, `SUM(CASE WHEN status = 'Yeni' THEN 1 ELSE 0 END)` | `ak_contact_requests` | `id`, `status` | `status = 'Yeni'` for new | count rows | low | No finance risk. |
| Unread notifications | `/admin` | notification summary | same | `dashboard.php` | `SELECT COUNT(*) FROM ak_notifications WHERE is_read = 0` | `ak_notifications` | `is_read` | `is_read = 0` | count unread | low | No finance risk. |
| Total customers | `/admin` | `AdminDashboard` summary card | same | `dashboard.php` | `SELECT COUNT(*) AS total_customers FROM ak_customers` | `ak_customers` | `id` | none | `COUNT(*)` | low | No action. |
| Total payments / realized income | `/admin` | `AdminDashboard` top cards via `dashboard.totalIncome` | same | `dashboard.php`, `backend-canonical-read-model.php`, `canonical-read-flags.php` | `canonical_read_ledger_summary()` reads `ak_financial_entries WHERE status <> 'İptal'`; `canonical_read_payment_summary()` reads all `ak_payments` | `ak_financial_entries`, `ak_payments` | `amount`, `currency_tag`, `direction`, `status`, `entry_date`, `payment_date` | ledger: `currency_tag = 'TRY'`, `status='Gerçekleşti'`, `direction='Gelir'`; payments: none | `total_payments = (ledger entry_count > 0 ? realized_income_try : 0) + SUM(ak_payments.amount)` | high | Later decide whether `ak_payments` is source or shadow after ledger cutover. |
| Total expenses / realized expense | `/admin` | `AdminDashboard` top cards via `dashboard.totalExpenses` | same | same | Ledger expense summary plus legacy expense summary | `ak_financial_entries`, `ak_expenses` | `amount`, `currency_tag`, `direction`, `status`, `entry_date`, `expense_date` | ledger: TRY, realized, `direction='Gider'`; expenses: none | `total_expenses = (ledger entry_count > 0 ? realized_expense_try : 0) + SUM(ak_expenses.amount)` | high | Later remove or gate legacy addition if expenses are represented in ledger. |
| Basic net balance | `/admin` | `AdminDashboard` top card via `dashboard.netStatus` | same | same | Derived from selected financial summary | mixed | same as total payments/expenses | same | `basic_net_balance = total_payments - total_expenses` | high | Depends on high-risk mixed totals. |
| Planned income | `/admin` | `AdminDashboard` summary object | same | `backend-canonical-read-model.php` | `canonical_read_ledger_summary()` planned income | `ak_financial_entries` | `amount`, `currency_tag`, `direction`, `status` | `currency_tag='TRY'`, `status='Planlandı'`, `direction='Gelir'`, `status <> 'İptal'` | `SUM(amount)` | low/medium | Clarify whether planned receivables should come from ledger or `ak_payment_plans`. |
| Month income | `/admin` | `AdminDashboard` monthly/top values | same | same | ledger month income plus legacy payment month total | `ak_financial_entries`, `ak_payments` | `entry_date`, `payment_date`, `amount` | date `>= current month first day`; ledger TRY, realized gelir | `month_income = ledger.month_income_try + payments.month_total` | high | Same mixed-source risk as total payments. |
| Month expenses | `/admin` | `AdminDashboard` monthly/top values | same | same | ledger month expense plus legacy expense month total | `ak_financial_entries`, `ak_expenses` | `entry_date`, `expense_date`, `amount` | date `>= current month first day`; ledger TRY, realized gider | `month_expenses = ledger.month_expense_try + expenses.month_total` | high | Same mixed-source risk as total expenses. |
| Month net | `/admin` | `AdminDashboard` monthly/top values | same | same | Derived from mixed month income/expenses | mixed | same | same | `month_net = month_income - month_expenses` | high | Depends on high-risk mixed month totals. |
| Overdue collections | `/admin` | `Takip Gerektirenler`, command center | same | `backend-canonical-read-model.php`, `canonical-read-flags.php` | `canonical_read_customer_plan_buckets()` over plan states | `ak_payment_plans`, `ak_payments` | `amount`, `paid_amount`, `due_date`, `status`, `customer_id`, `payment_plan_id`, `account_type` | plans `customer_id IS NOT NULL`; exclude canceled; `remaining > 0`; `due_date < today` | allocate linked/unlinked payments, derive `remaining_amount`, then sum overdue remaining | medium | Validate allocation logic before using for legal receivable reporting. |
| Expected payments / upcoming collections | `/admin` | `Yaklaşan Tahsilatlar`, command center | same | same | same buckets as overdue | `ak_payment_plans`, `ak_payments` | same | `today <= due_date <= today + 30 days`, `remaining > 0` | `SUM(remaining_amount)` | medium | Rename to collections if customer receivable only. |
| Overdue/upcoming plan count | `/admin` | `Takip Gerektirenler` | same | same | count bucket rows | `ak_payment_plans`, `ak_payments` | same | same as overdue/upcoming | `count(bucket rows)` | medium | Same allocation dependency. |
| Active projects list | `/admin` | `Proje Durumu` | same | `dashboard.php` | `SELECT id,title,project_status,location,is_published,slug,sort_order FROM ak_projects WHERE project_status <> 'Tamamlandı' ORDER BY sort_order ASC, created_at DESC LIMIT 6` | `ak_projects` | listed columns | `project_status <> 'Tamamlandı'` | list only | low | No math risk. |
| Overdue/upcoming plan lists | `/admin` | follow-up lists | same | `dashboard.php` + canonical bucket helpers | plans joined to customers/projects | `ak_payment_plans`, `ak_payments`, `ak_customers`, `ak_projects` | plan amount/paid/due/status, customer/project names | customer plans only; bucket filters | list first 8 from derived buckets | medium | Validate status and remaining values against source rows. |
| Recent movements | `/admin` | `Son Hareketler` | same | `dashboard.php` | SQL `UNION ALL` ledger rows, legacy payments, legacy expenses | `ak_financial_entries`, `ak_payments`, `ak_expenses`, `ak_projects` | `id`, `title/description`, `amount`, dates, direction, group/account, status, project title | ledger `status <> 'İptal'`; no filters on legacy payments/expenses | append all sources, order by date/created_at, limit 8 | high | If legacy rows are also in ledger, duplicates can appear in recent movement list. |
| Monthly financial chart | `/admin` | `Aylık Finans Özeti` `BarChart` | same | `backend-canonical-read-model.php` | `canonical_read_monthly_financials()` merges ledger, payments, expenses from last 6 months | `ak_financial_entries`, `ak_payments`, `ak_expenses` | `entry_date/payment_date/expense_date`, `direction`, `amount` | ledger `status='Gerçekleşti'`, `currency_tag='TRY'`, date `>= start`; legacy date `>= start` | group by `YYYY-MM`; income += Gelir/payment; expenses += Gider/expense; net = income - expenses | high | Gate legacy rows after canonical cutover. |
| Unified customer cards | `/admin` | `Birleşik Finans Kartları / Müşteri Kartları` | same | `dashboard.php::fetch_customer_financial_cards()` | Reads customer plans/payments, computes state, groups by customer | `ak_customers`, `ak_payment_plans`, `ak_payments` | customer name; plan amount/paid/due/status/account; payment amount/plan/account | customer plans only; canceled skipped | contract=sum amount; collected=sum derived paid; remaining=sum remaining; overdue/upcoming=sum bucket remaining; official/unofficial by `account_type` | medium | Uses plan/payment schedule, not ledger; later reconcile with canonical settlements. |
| Unified project cards | `/admin` | `Birleşik Finans Kartları / Proje Kartları` | same | `dashboard.php::fetch_project_financial_cards()` | Realized revenue/expense from ledger; receivables from plans; payables from plan+planned ledger obligations | `ak_projects`, `ak_financial_entries`, `ak_payment_plans`, `ak_payments`, `ak_employees`, `ak_expense_cards` | project id; ledger amount/direction/group/status; plan amount/paid/due/account/project | ledger `project_id IS NOT NULL AND status='Gerçekleşti'`; plans `project_id IS NOT NULL`; payables exclude `status='İptal'` | revenue=sum realized Gelir; expenses=sum realized Gider; net=revenue-expenses; receivables=sum customer plan remaining; payables=sum payable obligations remaining; cash_position=net+(receivables-payables) | medium/high | Mixed canonical realized rows plus plan schedules; ensure planned ledger obligations and payment plans are not duplicate obligations. |
| Unified supplier cards | `/admin` | `Birleşik Finans Kartları / Tedarikçi Kartları` | same | `dashboard.php::fetch_supplier_financial_cards()` | Realized supplier gider from ledger plus payable obligations | `ak_expense_cards`, `ak_financial_entries`, `ak_payment_plans` | `expense_card_id`, `amount`, `direction`, `status`, `entry_date`, `group_tag`, plan fields | ledger `expense_card_id IS NOT NULL AND status='Gerçekleşti'`; only `direction='Gider'` counted; obligations from payable helper | total_paid += realized gider; total_purchases += realized gider + obligation amount; remaining/overdue from obligations | medium/high | `total_purchases` intentionally mixes paid actuals and planned obligations; validate if this should be exposure instead. |
| Unified personnel cards | `/admin` | `Birleşik Finans Kartları / Personel Kartları` | same | `dashboard.php::fetch_personnel_financial_cards()` | Realized personnel gider from ledger plus payable obligations | `ak_employees`, `ak_financial_entries`, `ak_payment_plans` | `employee_id`, `title`, `amount`, `direction`, `status`, `group_tag`, plan fields | ledger `employee_id IS NOT NULL AND status='Gerçekleşti'`; obligations from payable helper | salary/advance/reimbursement by title keyword; total cost += realized gider and remaining payable; remaining/overdue from obligations | medium/high | Title keyword classification is fragile; total cost mixes realized cost and remaining payable. |
| Cashflow command center | `/admin` | `Cashflow Command Center` cards/lists | same | `dashboard.php::fetch_cashflow_command_center()` | Aggregates from unified cards, payable state, realized cash position | mixed | card metrics, ledger group balances, payable obligations | inherited filters | receivables=sum customer card remaining; payables=payable state; net_cash_position=sum signed realized ledger by group; upcoming collections/payments from buckets | medium/high | Clearly separate cash-on-hand from receivable/payable forecasts later. |
| Net cash forecast | `/admin` | forecast cards/windows | same | `dashboard.php::fetch_net_cash_forecast()` | Uses ledger cash, receivable obligations, payable obligations | `ak_financial_entries`, `ak_payment_plans`, `ak_payments` | ledger amount/direction/group/status; plan remaining/due/account | ledger `status='Gerçekleşti'`; receivables customer plans; payables non-customer plans + planned ledger gider | available_cash=official+unofficial signed ledger; forecast=available+expectedCollections-currentPayables-expectedPayments; riskAdjusted=available+70% collections-overduePayables-expectedPayments | medium/high | Review double subtraction of `currentPayables` and `expectedPayments`; expected payments may be subset of current payables. |
| Cashflow action center | `/admin` | action lists | same | `dashboard.php::fetch_cashflow_action_center()` | Sorts/ranks unified cards and payable obligations | mixed | derived card fields and obligations | inherited filters | risk score formulas: overdue/contract*70 + remaining/contract*30; payment score from amount/due; project score from negative cash/profit/expense | medium | Ranking only, but inherits mixed-source metrics. |
| Management decision dashboard | `/admin` | management action lists | same | `dashboard.php::fetch_management_decision_dashboard()` | Sorts/ranks cards, forecast, category intelligence | mixed | derived fields | inherited | top profitable/loss/risky queues; shortage warnings compare net cash, upcoming payments, current payables/receivables | medium | Treat as directional until source-of-truth decisions are complete. |
| Financial drilldowns | `/admin` | `Finans Kaynak Satırları` | same | `dashboard.php::fetch_financial_drilldowns()` | Several SQL lists | mixed | varies by drilldown | see section 7 SQL follow-up | rows are selected source evidence, not summed except profit component subqueries | low/medium | Useful for validation; pending/overdue use `amount - paid_amount` and ignore allocated unlinked payments. |
| Expense category intelligence | `/admin` | `Gider Kategori Zekası` | same | `dashboard.php::fetch_expense_category_intelligence()` | Realized gider ledger by category plus payable obligations | `ak_financial_entries`, `ak_expense_cards`, `ak_payment_plans` | amount/status/group/project/employee/expense_card/category | ledger `direction='Gider' AND status='Gerçekleşti'`; obligations from payable helper | realized_cost=sum ledger; planned_cost=sum obligation amount; cash_pressure=sum obligation remaining; total_exposure=realized+planned | medium/high | Planned obligations can duplicate planned ledger gider or payment plans; signature dedupe helps but is not a true key. |

## 3. Finance Summary Calculation Map

Backend endpoint: `GET /api/admin/finance-summary.php`.

Backend behavior:

```sql
SELECT * FROM ak_payment_plans;
SELECT * FROM ak_payments;
SELECT * FROM ak_expenses;
SELECT * FROM ak_financial_entries;
SELECT * FROM ak_customers;
SELECT id, title, slug FROM ak_projects ORDER BY sort_order ASC, created_at DESC;
```

All finance summary math below is in `src/pages/admin/AdminFinance.tsx` and `src/lib/finance.ts`.

| metric_name | frontend_page | frontend_component | API_endpoint | backend_file | SQL_or_logic_summary | source_tables | source_columns | key_filters | formula | double_count_risk | recommendation_for_later |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Finance entry input array | `/admin/finans-dashboard` | `AdminFinance` | `/api/admin/finance-summary.php` | `finance-summary.php` | backend returns raw rows; frontend builds `financeEntries = financialEntries + paymentToFinancialEntry(payments) + expenseToFinancialEntry(expenses)` | `ak_financial_entries`, `ak_payments`, `ak_expenses` | ledger columns; payment amount/date/account/project/customer; expense amount/date/project/customer | no backend filters | synthetic payment rows become `Gelir/Gerçekleşti/TRY`; synthetic expense rows become `Gider/Gerçekleşti/TRY` | high | Add source de-duplication before canonical cutover. |
| Gerçekleşen Gelir | `/admin/finans-dashboard` | `Stat` | same | same | `summarizeLedgerFinance({ financialEntries })` | mixed array | `amount`, `currency_tag`, `direction`, `status`, `entry_date` | `currency_tag='TRY'`; canonical metric realized income | `stats.totalReceived = overall.totalIncome = realizedIncome` | high | If `ak_payments` are mirrored in ledger, this doubles them. |
| Planlanan Gelir | same | `Stat` | same | same | `summarizeLedgerFinance()` planned income | mixed array but usually ledger only | same | `status='Planlandı'`, `direction='Gelir'`, currency TRY | `stats.totalReceivable = overall.receivable = plannedIncome` | medium | Does not use `ak_payment_plans`; compare with schedule table. |
| Gerçekleşen Gider | same | `Stat` | same | same | `summarizeLedgerFinance()` realized expense | mixed array | same | `status='Gerçekleşti'`, `direction='Gider'`, currency TRY | `stats.totalExpense = overall.totalExpense` | high | If `ak_expenses` are mirrored in ledger, this doubles them. |
| Planlanan Gider | same | `Stat` | same | same | `summarizeLedgerFinance()` planned expense | mixed array but usually ledger only | same | `status='Planlandı'`, `direction='Gider'`, currency TRY | `stats.totalPayable = overall.payable` | medium | Compare with non-customer `ak_payment_plans`. |
| Net Durum | same | `Stat` | same | same | derived frontend value | mixed array | same | same | `stats.net = realizedIncome - realizedExpense` | high | Inherits mixed realized income/expense risk. |
| Bu Ay Beklenen Tahsilat | same | `Stat` | same | same | month-scoped `summarizeLedgerFinance()` | mixed array | `entry_date`, `amount`, status/direction | `entry_date` between month start/end; planned income | `stats.expectedThisMonth = month.receivable` | medium/high | Does not use payment plan due dates; uses ledger/synthetic entry dates. |
| Bu Ay Gerçekleşen Gelir | same | `Stat` | same | same | month-scoped realized income | mixed array | same | month date range, realized income | `stats.receivedThisMonth = month.totalIncome` | high | Legacy payment rows appended to ledger. |
| Bu Ay Gerçekleşen Gider | same | `Stat` | same | same | month-scoped realized expense | mixed array | same | month date range, realized expense | `stats.expenseThisMonth = month.totalExpense` | high | Legacy expense rows appended to ledger. |
| Genel Finans Dağılımı | same | `PieCard` | same | same | `overallPie` uses the four stats above | mixed | derived stats | positive values displayed | pie values: realized income, planned income, realized expense, planned expense | high | Chart inherits stat risks. |
| Ödeme Durumu Dağılımı | same | `PieCard` | same | same | `statusPie` allocates collections to plans | `ak_payment_plans`, `ak_payments` | plan amount/paid/status/due/customer/account; payment amount/customer/plan/account | group by `customer_id|account_type` | `effectivePaidForPlan()`, `derivePlanStatus()`, count bucket amount as paid or remaining | medium | Allocation should be reconciled with canonical settlements. |
| Proje Bazlı Finans Durumu | same | project cards/pies | same | same | per project `summarizeLedgerFinance({ financialEntries: financeEntries.filter(project_id) })` | mixed array, `ak_projects` | project id/title; entry project_id/amount/status/direction | entry `project_id = project.id` | received, receivable, expense, payable, net from ledger summary | high | Same synthetic legacy row duplication risk. |
| Yaklaşan Ödemeler 30 Gün | same | table | same | same | frontend `upcoming` from plans, payments, customers, projects | `ak_payment_plans`, `ak_payments`, `ak_customers`, `ak_projects` | amount, paid_amount, due_date, status, customer_id, project_id, account_type | derived unpaid, not canceled/paid, `0 <= daysUntil <= 30` | remaining = amount - effectivePaidForPlan(); status from `derivePlanStatus()` | medium | Current known `ak_payments=0`; manual paid only unless plan status says paid/partial. |
| Geciken Ödemeler | same | table | same | same | same as upcoming but overdue | `ak_payment_plans`, `ak_payments`, `ak_customers`, `ak_projects` | same | `daysUntil < 0`, unpaid, not canceled/paid | remaining shown | medium | Same allocation/manual paid risk. |

## 4. Reports Calculation Map

Backend endpoint: `GET /api/admin/reports.php`.

Backend raw datasets:

```sql
SELECT * FROM ak_customers ORDER BY created_at DESC;
SELECT * FROM ak_payment_plans ORDER BY due_date ASC;
SELECT * FROM ak_payments ORDER BY payment_date DESC;
SELECT * FROM ak_expenses ORDER BY expense_date DESC;
SELECT * FROM ak_financial_entries ORDER BY entry_date DESC, created_at DESC;
SELECT * FROM ak_projects ORDER BY sort_order ASC, created_at DESC;
SELECT * FROM ak_customer_projects ORDER BY created_at ASC;
SELECT * FROM ak_contact_requests ORDER BY created_at DESC;
```

Backend aggregates:

- `canonical_read_select('reports.aggregates', canonical_read_legacy_reports_aggregates(db()), canonical_read_reports_aggregates(db()), ...)`
- Both current legacy and canonical report aggregate functions count projects/customers/contact requests and sum only `ak_payments.amount` and `ak_expenses.amount`.

| metric_name | frontend_page | frontend_component | API_endpoint | backend_file | SQL_or_logic_summary | source_tables | source_columns | key_filters | formula | double_count_risk | recommendation_for_later |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Reports aggregates total projects/customers/contacts | `/admin/raporlar` | data payload, not primary rendered card in current file | `/api/admin/reports.php` | `reports.php`, `backend-canonical-read-model.php`, `canonical-read-flags.php` | `count(SELECT id FROM ak_projects/customers/contact_requests)` | `ak_projects`, `ak_customers`, `ak_contact_requests` | `id` | none | counts | low | No finance risk. |
| Reports aggregates total payments | same | data payload | same | same | `canonical_read_payment_summary(SELECT amount,payment_date FROM ak_payments)['total']` | `ak_payments` | `amount`, `payment_date` | none | `SUM(amount)` | low for duplicate inside endpoint; high if compared to ledger elsewhere | Decide whether report aggregate should become ledger based. |
| Reports aggregates total expenses | same | data payload | same | same | `canonical_read_expense_summary(SELECT amount,expense_date FROM ak_expenses)['total']` | `ak_expenses` | `amount`, `expense_date` | none | `SUM(amount)` | low for duplicate inside endpoint; high if compared to ledger elsewhere | Decide whether report aggregate should become ledger based. |
| Project Finance Report rows | `/admin/raporlar` tab `proje` | `ProjectFinanceReport` | same | `reports.php` | frontend `mysqlFinanceEntries(data)` appends ledger + synthetic payments + synthetic expenses; per project `summarizeLedgerFinance()` | `ak_financial_entries`, `ak_payments`, `ak_expenses`, `ak_projects` | entry/project id, amount/date/status/direction/currency; project id/title | project filter; date range on `entry_date` | totalReceived=summary.totalIncome; totalReceivable=summary.receivable; totalSpent=summary.totalExpense; totalPayable=summary.payable; net=summary.netBalance; collectionRate=received/receivable; expenseRate=spent/received | high | Same mixed synthetic row risk; `receivable` comes from planned ledger, not payment plans. |
| Customer Payment Report | `/admin/raporlar` tab `musteri` | `CustomerPaymentReport` | same | `reports.php` | frontend enriches plans using payments and `summarizePaymentPlansWithCanonicalState()` | `ak_customers`, `ak_projects`, `ak_payment_plans`, `ak_payments` | plan amount/paid/due/status/customer/project/account; payment amount/date/customer/project/account | customer/project/status/date filters; date range on plan due and payment date | totalDebt=planSummary.planned; collected=planSummary.paid; remaining=planSummary.remaining; overdue=planSummary.overdue; lastPay=max payment_date | medium | Uses schedule/payment allocation, not ledger; compare with canonical settlements later. |
| Collections Report | `/admin/raporlar` tab `tahsilat` | `CollectionsReport` | same | `reports.php` | filters `payments.data`; total uses `summarizeLegacyExpenseRowsWithCanonicalAdapter()` on mapped rows | `ak_payments`, `ak_customers`, `ak_projects` | amount/payment_date/customer/project/payment_method | customer/project/method/date filters | rows from payments; total effectively sum row amount through adapter | low/medium | Current known `ak_payments=0`; adapter naming is confusing for payments. |
| Expenses Report | `/admin/raporlar` tab `gider` | `ExpensesReport` | same | `reports.php` | filters `expenses.data`; sums rows | `ak_expenses`, `ak_projects` | amount/expense_date/project/category/title | project/category/date filters | `total = rows.reduce(sum + amount)` | low/medium | Legacy-only; will be incomplete if canonical ledger is the source. |
| General Summary Report cards | `/admin/raporlar` tab `ozet` | `GeneralSummaryReport` | same | `reports.php` | frontend `mysqlFinanceEntries(data)` then `summarizeLedgerFinance()` | `ak_financial_entries`, `ak_payments`, `ak_expenses` | entry/synthetic amount/date/status/direction/currency | optional month date range | realized income, planned income, realized expense, planned expense, net, month expected/collected/spent | high | Same mixed synthetic row risk. |
| General Finance Distribution pie | same | `PieChart` | same | same | uses General Summary values | mixed | derived values | positive values displayed | pie values = realized income, planned income, realized expense, planned expense | high | Inherits summary risk. |
| Monthly realized income/expense chart | same | `BarChart` | same | same | loops last 6 months and calls `summarizeLedgerFinance({from,to})` | mixed | entry_date, amount/status/direction/currency | month range | monthly realized income and expense | high | Inherits mixed synthetic row risk. |
| Overdue Payments Report | `/admin/raporlar` tab `gecikme` | `OverdueReport` | same | `reports.php` | frontend enriches customer payment plans and filters overdue unpaid | `ak_payment_plans`, `ak_payments`, `ak_customers`, `ak_projects` | amount/paid/due/status/customer/project | `due_date < today`, `paid <= 0`, not paid/canceled, optional filters | `totalOverdue = SUM(remaining)` | medium | Excludes partially paid overdue plans because filter requires `paid <= 0`; confirm intended. |

## 5. Financial Statement Calculation Map

Backend endpoint: `GET /api/admin/financial-statement.php?kind={project|customer|employee|expense}&id=...`.

Backend entity lookups:

- project: `SELECT id, title, location, project_status FROM ak_projects WHERE id = :id`
- customer: `SELECT id, customer_type, full_name, company_name, phone, email, tax_or_identity_number, status FROM ak_customers WHERE id = :id`
- employee: `SELECT * FROM ak_employees WHERE id = :id`
- expense card: `SELECT * FROM ak_expense_cards WHERE id = :id`

| metric_name | frontend_page | frontend_component | API_endpoint | backend_file | SQL_or_logic_summary | source_tables | source_columns | key_filters | formula | double_count_risk | recommendation_for_later |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Statement entries | `/admin/projeler/:id/finans`, `/admin/musteriler/:id/finans`, `/admin/personeller/:id/finans`, `/admin/gider-kartlari/:id/finans` | `FinancialStatementPage` | `/api/admin/financial-statement.php` | `financial-statement.php::fetch_statement_entries()` | `SELECT * FROM ak_financial_entries WHERE {project_id/customer_id/employee_id/expense_card_id} = :id ORDER BY entry_date DESC, created_at DESC`; for project/customer append synthetic legacy payments and expenses | `ak_financial_entries`, plus `ak_payments`/`ak_expenses` for project/customer | owner IDs, amount, currency_tag, group_tag, direction, status, dates, document_url | owner column equals id; legacy only for `kind === project || customer` | entries array sorted by date/created_at | high for project/customer; low for employee/expense | Add source identity/de-dupe before ledger cutover. |
| Summary realized income | statement pages | `SummaryCards` | same | backend raw entries; frontend `getSummary()` | `metricTotalsByCurrency(entries, "realizedIncome")` using `calculateCanonicalCardMetrics()` | statement entries | amount/currency/direction/status | per currency; canonical realized income | sum realized income by currency | high for project/customer due mixed entries | Treat project/customer statement totals as mixed until legacy disabled. |
| Summary realized expense | same | `SummaryCards` | same | same | `metricTotalsByCurrency(entries, "realizedExpense")` | statement entries | same | per currency; canonical realized expense | sum realized expense by currency | high for project/customer | Same. |
| Summary planned income | same | `SummaryCards` | same | same | `metricTotalsByCurrency(entries, "totalPlannedReceivable")` | statement entries | same | planned income metric | sum planned income by currency | medium | For customer, may not match `ak_payment_plans` tab. |
| Summary planned expense | same | `SummaryCards` | same | same | `metricTotalsByCurrency(entries, "plannedCategoryCost")` | statement entries | same | planned expense metric | sum planned expense by currency | medium | Compare with payable plans. |
| Official balance | same | `SummaryCards` | same | same | `sumEntriesByCurrency(entries.filter(status !== 'İptal' && group_tag === 'Resmi'), true)` | statement entries | amount/currency/direction/group/status | `status != İptal`, `group_tag='Resmi'` | signed sum by currency; Gelir positive, Gider negative | high for project/customer | Mixed entries can duplicate realized legacy rows. |
| Unofficial balance | same | `SummaryCards` | same | same | same with `group_tag='Gayri Resmi'` | statement entries | same | `status != İptal`, `group_tag='Gayri Resmi'` | signed sum by currency | high for project/customer | Same. |
| Remaining income / receivable | same | `SummaryCards` | same | same | `positiveCurrencyDifference(plannedIncome, realizedIncome)` | statement entries | derived planned/realized totals | per currency | `max(0, plannedIncome - realizedIncome)` | high for project/customer | May be inconsistent with payment plan remaining. |
| Remaining expense / payable | same | `SummaryCards` | same | same | `positiveCurrencyDifference(plannedExpense, realizedExpense)` | statement entries | derived planned/realized totals | per currency | `max(0, plannedExpense - realizedExpense)` | medium/high | Compare with `paymentPlans` tab. |
| Project current/all profitability charts | project finance statement | `ChartCard`, `getProjectChartData()` | same | same | frontend filters entries to currency and realized | statement entries | amount/currency/status/direction | `currency_tag = chartCurrency`, `status='Gerçekleşti'`; current month for current chart | income=sum Gelir; expense=sum Gider; net=income-expense but chart value is `abs(net)` | high for project/customer legacy append | Net bar loses sign in value; color indicates sign. |
| Customer/card movement charts | customer/personnel/expense statements | `ChartCard`, `getCardChartData()` | same | same | frontend sums realized/planned by direction/status | statement entries | amount/currency/status/direction | selected currency; kind-specific direction/status | customer: realized payment, planned payment, refund; employee/supplier: realized expense, planned expense, canceled | high for customer; low/medium others | Same mixed-entry caveat for customer. |
| Project distribution chart | non-project statements | `ChartCard`, `getDistributionData()` | same | same | sum absolute signed entry amount by project | statement entries, project lookup | project_id, amount, direction, currency, status | `currency_tag=chartCurrency`, `status!='İptal'`, has `project_id` | `SUM(ABS(signedEntryAmount)) GROUP BY project_id` in frontend | high for customer | Distribution is volume, not net. |
| Payment plan account summary | statement pages with plan tabs | `PlanChartCard`, account cards | same | `financial-statement.php::fetch_statement_payment_plans()` and `fetch_statement_payments()` | backend plans: `SELECT * FROM ak_payment_plans WHERE {customer_id/employee_id/expense_card_id}=:id`; payments only for customer | `ak_payment_plans`, `ak_payments` | plan amount/paid/due/status/account; payment amount/customer/account/payment_plan_id | kind in customer/employee/expense; account group; owner match | paid from status/paid_amount or allocated payments; remain=amount-paid; balance=sum unpaid remain; overdue=sum unpaid overdue; future/current buckets | medium | Plan tab can disagree with ledger summary cards. |
| Statement row filters | statement pages | movement table | same | backend returns all; frontend filters | statement entries | entry date/project/card/group/direction/status/currency/search | UI filters | no aggregation; displayed row list | inherited | No formula risk beyond source set. |

## 6. Source Table Input Map

| table | calculations consuming it | columns used as inputs | keys/link fields |
| --- | --- | --- | --- |
| `ak_financial_entries` | dashboard summary, monthly financials, recent movements, project/supplier/personnel cards, cash position, net cash forecast, expense category intelligence, financial drilldowns, finance summary, reports, financial statements | `id`, `project_id`, `customer_id`, `employee_id`, `expense_card_id`, `entry_date`, `amount`, `currency_tag`, `group_tag`, `direction`, `status`, `title`, `description`, `document_url`, `created_at` | links to `ak_projects.id`, `ak_customers.id`, `ak_employees.id`, `ak_expense_cards.id`; soft source/payment plan fields exist but are not consistently used in current dashboard formulas |
| `ak_payment_plans` | overdue/upcoming collections, customer financial cards, project receivables, payables, net cash forecast, finance summary payment status, reports customer/overdue, financial statement plan tabs, drilldowns | `id`, `title`, `amount`, `paid_amount`, `due_date`, `status`, `customer_id`, `project_id`, `employee_id`, `expense_card_id`, `account_type`, `canceled_at`, `archived_at` | `customer_id -> ak_customers.id`; `project_id -> ak_projects.id`; soft `employee_id`, `expense_card_id`; payment allocation via `ak_payments.payment_plan_id` and `customer_id/account_type` |
| `ak_payments` | dashboard mixed total income, monthly financials, recent movements, payment plan allocation, finance summary synthetic income, reports synthetic income/collections, financial statement legacy rows and customer plan tab | `id`, `customer_id`, `project_id`, `payment_plan_id`, `amount`, `account_type`, `payment_date`, `payment_method`, `description`, `document_url`, `created_at`, `updated_at` | `customer_id -> ak_customers.id`; `project_id -> ak_projects.id`; `payment_plan_id -> ak_payment_plans.id`; allocation by `customer_id + account_type` |
| `ak_expenses` | dashboard mixed total expenses, monthly financials, recent movements, finance summary synthetic expense, reports synthetic expense/expense report, financial statement project/customer legacy rows | `id`, `project_id`, `customer_id`, `title`, `category`, `amount`, `expense_date`, `description`, `document_url`, `created_at`, `updated_at` | `project_id -> ak_projects.id`; `customer_id -> ak_customers.id` |
| `ak_customers` | customer counts, customer plan buckets/cards, reports, payment allocation grouping, customer statement entity, drilldowns | `id`, `company_name`, `full_name`, `customer_type`, `phone`, `email`, `tax_or_identity_number`, `status`, `created_at` | `ak_payment_plans.customer_id`, `ak_payments.customer_id`, `ak_financial_entries.customer_id` |
| `ak_projects` | project counts/lists, project cards, project statements, project report, recent movement labels, drilldowns | `id`, `title`, `slug`, `location`, `project_status`, `is_published`, `sort_order`, `created_at` | `ak_financial_entries.project_id`, `ak_payment_plans.project_id`, `ak_payments.project_id`, `ak_expenses.project_id` |
| `ak_employees` | personnel cards, personnel statements, payable obligations labels, personnel drilldowns | `id`, `full_name`, `status`, `role` | `ak_financial_entries.employee_id`, `ak_payment_plans.employee_id` |
| `ak_expense_cards` | supplier cards, expense-card statements, category intelligence, payable obligation labels | `id`, `name`, `category`, `status` | `ak_financial_entries.expense_card_id`, `ak_payment_plans.expense_card_id` |

## 7. Double Counting Risk Register

| risk_id | combination | affected metrics/screens | evidence | risk | notes |
| --- | --- | --- | --- | --- | --- |
| DCR-001 | `ak_financial_entries + ak_payments` | dashboard total payments, month income, monthly chart, recent movements | `totalPayments = ledger.realized_income_try + payments.total`; `canonical_read_monthly_financials()` merges payments; recent movements `UNION ALL` includes payments | high | Current `ak_payments=0`, so present runtime risk is dormant, but formula risk is high. |
| DCR-002 | `ak_financial_entries + ak_expenses` | dashboard total expenses, month expenses, monthly chart, recent movements | `totalExpenses = ledger.realized_expense_try + expenses.total`; monthly merge; recent movements `UNION ALL` includes expenses | high | Current `ak_expenses=0`, so dormant now. |
| DCR-003 | `ak_financial_entries + ak_payments` | Finance Summary cards/charts, project cards | `AdminFinance.financeEntries = financialEntries + pays.map(paymentToFinancialEntry)` | high | Synthetic payment rows are indistinguishable in summary formulas except `is_legacy_payment`. |
| DCR-004 | `ak_financial_entries + ak_expenses` | Finance Summary cards/charts, project cards | `AdminFinance.financeEntries = financialEntries + exps.map(expenseToFinancialEntry)` | high | Same issue for legacy expenses. |
| DCR-005 | `ak_financial_entries + ak_payments + ak_expenses` | Reports Project Finance and General Summary | `mysqlFinanceEntries(data)` appends financial entries, payments as income, expenses as expense | high | Reports can double count after legacy rows are represented in ledger. |
| DCR-006 | `ak_financial_entries + ak_payments + ak_expenses` | Financial Statement project/customer summaries/charts | backend `fetch_statement_entries()` merges ledger with synthetic legacy payments/expenses for project/customer | high | Employee and expense-card statements do not append legacy payments/expenses. |
| DCR-007 | `ak_payment_plans + ak_payments` | overdue/upcoming collections, customer cards, payment status distribution, customer reports | `canonical_read_plan_states()` combines manual paid, linked payments, and unlinked payments by customer/account | medium | Risk is less duplicate counting and more paid allocation ambiguity. |
| DCR-008 | `ak_payment_plans + ak_financial_entries` | payable obligations, project payables, supplier/personnel cards, expense category planned cost, cash forecast | `fetch_payable_obligations()` starts with non-customer payment plans then adds planned ledger gider if signature not seen | medium/high | Signature dedupe is heuristic: owner, owner IDs, project, amount, due date, account type. |
| DCR-009 | `ak_payment_plans + ak_payments` | financial drilldown pending/overdue rows | drilldown SQL uses `GREATEST(pp.amount - pp.paid_amount, 0)` and does not allocate `ak_payments` | medium | Drilldown may disagree with dashboard bucket calculations when payments exist. |
| DCR-010 | `ak_payment_plans + ak_financial_entries` | Net cash forecast windows | receivables from payment plans; payables from payment plans plus planned ledger; cash from realized ledger | medium | Forecast combines schedule and ledger intentionally, but needs source-of-truth governance. |

## 8. Follow-up SQL Queries

Run these in production/staging to validate current numbers. These are read-only `SELECT` statements.

### Source row counts and demo/real split

```sql
SELECT 'ak_financial_entries' AS table_name, COUNT(*) AS row_count FROM ak_financial_entries
UNION ALL SELECT 'ak_payment_plans', COUNT(*) FROM ak_payment_plans
UNION ALL SELECT 'ak_payments', COUNT(*) FROM ak_payments
UNION ALL SELECT 'ak_expenses', COUNT(*) FROM ak_expenses
UNION ALL SELECT 'ak_projects', COUNT(*) FROM ak_projects
UNION ALL SELECT 'ak_customers', COUNT(*) FROM ak_customers
UNION ALL SELECT 'ak_employees', COUNT(*) FROM ak_employees
UNION ALL SELECT 'ak_expense_cards', COUNT(*) FROM ak_expense_cards;
```

```sql
SELECT
  COALESCE(migration_confidence, 'NULL') AS migration_confidence,
  COUNT(*) AS row_count,
  SUM(CASE WHEN direction = 'Gelir' THEN amount ELSE 0 END) AS income_amount,
  SUM(CASE WHEN direction = 'Gider' THEN amount ELSE 0 END) AS expense_amount
FROM ak_financial_entries
GROUP BY COALESCE(migration_confidence, 'NULL')
ORDER BY row_count DESC;
```

### Dashboard summary parity

```sql
SELECT
  SUM(CASE WHEN status = 'Gerçekleşti' AND direction = 'Gelir' AND currency_tag = 'TRY' THEN amount ELSE 0 END) AS ledger_realized_income_try,
  SUM(CASE WHEN status = 'Gerçekleşti' AND direction = 'Gider' AND currency_tag = 'TRY' THEN amount ELSE 0 END) AS ledger_realized_expense_try,
  SUM(CASE WHEN status = 'Planlandı' AND direction = 'Gelir' AND currency_tag = 'TRY' THEN amount ELSE 0 END) AS ledger_planned_income_try,
  COUNT(*) AS non_canceled_ledger_rows
FROM ak_financial_entries
WHERE status <> 'İptal';
```

```sql
SELECT
  (SELECT COALESCE(SUM(amount), 0) FROM ak_payments) AS legacy_payment_total,
  (SELECT COALESCE(SUM(amount), 0) FROM ak_expenses) AS legacy_expense_total,
  (SELECT COALESCE(SUM(amount), 0) FROM ak_payments WHERE payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS legacy_payment_month_total,
  (SELECT COALESCE(SUM(amount), 0) FROM ak_expenses WHERE expense_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS legacy_expense_month_total;
```

### Duplicate source checks

```sql
SELECT source_type, COUNT(*) AS row_count, SUM(amount) AS total_amount
FROM ak_financial_entries
WHERE source_type IS NOT NULL
GROUP BY source_type
ORDER BY row_count DESC;
```

```sql
SELECT
  p.id AS payment_id,
  p.amount AS payment_amount,
  p.payment_date,
  fe.id AS matching_entry_id,
  fe.amount AS entry_amount,
  fe.entry_date,
  fe.source_type,
  fe.source_id
FROM ak_payments p
JOIN ak_financial_entries fe
  ON (
    fe.source_id = p.id
    OR (
      fe.customer_id = p.customer_id
      AND fe.project_id <=> p.project_id
      AND fe.amount = p.amount
      AND fe.entry_date = p.payment_date
      AND fe.direction = 'Gelir'
      AND fe.status = 'Gerçekleşti'
    )
  )
LIMIT 100;
```

```sql
SELECT
  e.id AS expense_id,
  e.amount AS expense_amount,
  e.expense_date,
  fe.id AS matching_entry_id,
  fe.amount AS entry_amount,
  fe.entry_date,
  fe.source_type,
  fe.source_id
FROM ak_expenses e
JOIN ak_financial_entries fe
  ON (
    fe.source_id = e.id
    OR (
      fe.project_id <=> e.project_id
      AND fe.customer_id <=> e.customer_id
      AND fe.amount = e.amount
      AND fe.entry_date = e.expense_date
      AND fe.direction = 'Gider'
      AND fe.status = 'Gerçekleşti'
    )
  )
LIMIT 100;
```

### Payment plan remaining and overdue validation

```sql
SELECT
  pp.id,
  pp.customer_id,
  pp.project_id,
  pp.account_type,
  pp.amount,
  pp.paid_amount,
  COALESCE(SUM(CASE WHEN p.payment_plan_id = pp.id THEN p.amount ELSE 0 END), 0) AS linked_payment_amount,
  GREATEST(pp.amount - GREATEST(pp.paid_amount, COALESCE(SUM(CASE WHEN p.payment_plan_id = pp.id THEN p.amount ELSE 0 END), 0)), 0) AS simple_remaining,
  pp.due_date,
  pp.status
FROM ak_payment_plans pp
LEFT JOIN ak_payments p ON p.payment_plan_id = pp.id
WHERE pp.customer_id IS NOT NULL
  AND pp.status <> 'İptal'
GROUP BY pp.id
ORDER BY pp.due_date ASC
LIMIT 200;
```

```sql
SELECT
  account_type,
  COUNT(*) AS overdue_plan_count,
  SUM(GREATEST(amount - paid_amount, 0)) AS overdue_remaining_by_paid_amount
FROM ak_payment_plans
WHERE customer_id IS NOT NULL
  AND status <> 'İptal'
  AND due_date < CURDATE()
  AND GREATEST(amount - paid_amount, 0) > 0
GROUP BY account_type;
```

### Payable obligation duplicate-signature validation

```sql
SELECT
  owner_type,
  employee_id,
  expense_card_id,
  project_id,
  amount,
  due_date,
  account_type,
  COUNT(*) AS matching_rows
FROM (
  SELECT
    CASE WHEN employee_id IS NOT NULL THEN 'personnel'
         WHEN expense_card_id IS NOT NULL THEN 'supplier'
         ELSE 'general' END AS owner_type,
    employee_id,
    expense_card_id,
    project_id,
    ROUND(amount, 2) AS amount,
    due_date,
    account_type,
    'payment_plan' AS source_type
  FROM ak_payment_plans
  WHERE customer_id IS NULL AND status <> 'İptal'
  UNION ALL
  SELECT
    CASE WHEN employee_id IS NOT NULL THEN 'personnel'
         WHEN expense_card_id IS NOT NULL THEN 'supplier'
         ELSE 'general' END AS owner_type,
    employee_id,
    expense_card_id,
    project_id,
    ROUND(amount, 2) AS amount,
    entry_date AS due_date,
    CASE WHEN group_tag = 'Gayri Resmi' THEN 'gayri_resmi' ELSE 'resmi' END AS account_type,
    'financial_entry' AS source_type
  FROM ak_financial_entries
  WHERE direction = 'Gider' AND status = 'Planlandı'
) obligations
GROUP BY owner_type, employee_id, expense_card_id, project_id, amount, due_date, account_type
HAVING COUNT(*) > 1
ORDER BY matching_rows DESC, due_date ASC;
```

### Project profitability validation

```sql
SELECT
  pr.id,
  pr.title,
  COALESCE(SUM(CASE WHEN fe.direction = 'Gelir' AND fe.status = 'Gerçekleşti' THEN fe.amount ELSE 0 END), 0) AS realized_revenue,
  COALESCE(SUM(CASE WHEN fe.direction = 'Gider' AND fe.status = 'Gerçekleşti' THEN fe.amount ELSE 0 END), 0) AS realized_expense,
  COALESCE(SUM(CASE WHEN fe.direction = 'Gelir' AND fe.status = 'Gerçekleşti' THEN fe.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN fe.direction = 'Gider' AND fe.status = 'Gerçekleşti' THEN fe.amount ELSE 0 END), 0) AS net_profit
FROM ak_projects pr
LEFT JOIN ak_financial_entries fe ON fe.project_id = pr.id
GROUP BY pr.id, pr.title
ORDER BY ABS(net_profit) DESC;
```

### Official/unofficial cash validation

```sql
SELECT
  group_tag,
  SUM(CASE WHEN direction = 'Gelir' THEN amount ELSE -amount END) AS signed_cash_position
FROM ak_financial_entries
WHERE status = 'Gerçekleşti'
GROUP BY group_tag;
```

## 9. Validation Performed

- Ran code search only across scoped backend and frontend files.
- Read scoped calculation files.
- Did not run migrations.
- Did not clean or modify data.
- Did not modify application code.
- Did not run build/typecheck because this documentation-only task did not require code validation.

Changed files:

- `docs/FINANCE_DASHBOARD_CALCULATION_INPUT_MAP.md`
