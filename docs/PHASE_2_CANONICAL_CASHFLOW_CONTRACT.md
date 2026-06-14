# Phase 2 — Canonical Cashflow Contract and Migration Design

Audit/design date: 14 June 2026

## Executive Summary

- **Recommended canonical model:** Keep `ak_payment_plans` as the canonical obligation and due-date schedule. Make `ak_financial_entries` the canonical ledger for realized cash movements, accounting events, adjustments, refunds, transfers, opening balances, and explicitly classified forecasts. Preserve `ak_payments` and `ak_expenses` as read-only legacy source records during migration.
- **Main data-contract decisions:**
  - Every canonical ledger event receives an immutable `business_transaction_id`, explicit `event_type`, source provenance, counterparty, project policy, account type, currency, and audit metadata.
  - Settlement is represented by a relation between ledger transactions and plans. Plan status and paid amount become derived values, not independent accounting evidence.
  - A plan-linked planned ledger entry is a mirror/projection of the plan and must never be added to the plan amount in reporting.
  - A forecast not backed by a plan must be explicitly identified as an uncommitted forecast.
  - Resmi/Gayri Resmi, currency, direction, project, and counterparty must remain consistent across a plan and every settlement.
- **Main migration risks:** Existing rows lack transaction identity, legacy expenses lack account/currency/supplier fields, project links are nullable, manual paid amounts may have no cash record, and probable duplicates cannot always be resolved automatically.
- **Can implementation begin?** Schema and reconciliation tooling can begin after the P0 decisions in this document are approved. Reporting cutover and write-path changes must not begin until a non-destructive reconciliation report has classified existing production records.

This design confirms the direction proposed in Phase 1, with one important refinement: `ak_financial_entries` is the canonical ledger, but `ak_payment_plans` remains the canonical source for committed receivables/payables. Planned ledger entries cannot form a second independent obligation register.

## Canonical Accounting Objects

### Receivable plan

A committed amount expected from a customer.

- Canonical table: `ak_payment_plans`
- Owner: customer
- Direction: incoming
- Required: customer, project unless explicitly company-level, amount, currency, account type, due date, title
- Optional: payment method expectation, cheque/promissory metadata, description, document
- Settlement: one or more realized customer receipts
- Status: derived from active settlement allocations and cancellation state

### Payable plan

A committed amount expected to be paid to personnel, a supplier/expense card, government body, or another defined counterparty.

- Canonical table: `ak_payment_plans`
- Owner: personnel, expense card/supplier, or approved general-cost counterparty
- Direction: outgoing
- Required: counterparty, project or company-overhead classification, amount, currency, account type, due date, cost category
- Settlement: one or more realized outgoing ledger transactions
- Status: derived

### Realized customer receipt

Cash or cash-equivalent received from a customer.

- Canonical table: `ak_financial_entries`
- `event_type`: `customer_receipt`
- Direction: income
- Status: posted
- Required: customer, transaction date, amount, currency, account type, payment method
- Project: required when attributable to a project
- Plan: optional for advance/unallocated receipts; preferred when settling a known plan

### Realized personnel payment

Payment to employee, worker, subcontractor-personnel, or other personnel card.

- Canonical table: `ak_financial_entries`
- `event_type`: `personnel_payment`
- Direction: expense
- Required: employee, transaction date, amount, currency, account type, payment method
- Plan: required when paying a known payable; otherwise explicitly unplanned

### Realized supplier payment

Payment to a supplier or expense-card counterparty.

- Canonical table: `ak_financial_entries`
- `event_type`: `supplier_payment`
- Direction: expense
- Required: expense card, transaction date, amount, currency, account type, payment method

### Realized general expense

An outgoing cash event that does not require a reusable supplier card, such as a permit fee, government payment, small site cost, or office expense.

- Canonical table: `ak_financial_entries`
- `event_type`: `general_expense`
- Direction: expense
- Required: category, transaction date, amount, currency, account type
- Counterparty: optional only when genuinely unknown or one-time
- Project: required for project cost; null only with `allocation_scope = company_overhead`

### Planned income

Expected incoming value.

- Committed and dated: receivable plan in `ak_payment_plans`
- Non-committed forecast: ledger forecast with `event_type = forecast_income`, `status = forecast`, and no plan
- A plan mirror may exist for projection/audit, but is excluded from additive totals by `payment_plan_id`

### Planned expense

Expected outgoing value.

- Committed and dated: payable plan in `ak_payment_plans`
- Non-committed forecast: `forecast_expense`
- Plan-linked projection is non-additive

### Adjustment

A controlled correction to a posted accounting event without editing historical value in place.

- `event_type`: `adjustment`
- Must reference `adjusts_entry_id`
- Uses signed effect through direction and amount
- Requires reason, created-by identity, and audit timestamp

### Cancellation

Invalidates a plan or ledger event without deleting it.

- Plan cancellation changes lifecycle state and records actor, reason, and timestamp
- Posted ledger cancellation creates a reversing entry; the original remains immutable
- Forecast entries may be marked canceled before posting

### Transfer

Movement between internal cash/bank accounts with no company income or expense effect.

- Two linked ledger legs share one `business_transaction_id`
- One outgoing and one incoming transfer entry
- Excluded from income, expense, profit, receivable, and payable totals
- Included only in account-balance reports

### Opening balance

Migration/beginning balance required to establish a counterparty, project, or account position.

- `event_type`: `opening_balance`
- Must include effective date and migration/source explanation
- Must not pretend to be current-period cashflow
- Included in balance reports, excluded from period cash movement unless explicitly requested

### Currency difference

Realized foreign exchange gain/loss or settlement difference.

- `event_type`: `currency_difference`
- Required: related transaction/plan, base currency, foreign currency, applied rate, base amount
- Included in profit according to direction; excluded from original receipt/payment amount

### Refund

Return of previously received customer money or recovery of previously paid expense.

- `customer_refund`: outgoing, references original receipt/customer
- `expense_refund`: incoming, references original expense/payment/counterparty
- Never represented by editing the original amount

## Table Responsibility Contract

### `ak_payment_plans`

- Canonical role: committed receivable/payable schedule and maturity source
- Legacy role: existing customer/personnel/supplier plan records
- Allowed writes after migration: create, amend before settlement under audit, cancel/archive
- Disallowed writes: manual paid amount as independent settlement evidence; hard delete after any settlement/history
- Ownership: exactly one counterparty type and ID
- Project: required for project obligations; company overhead requires explicit scope/reason
- Account: canonical lowercase `account_type` enum
- Currency: required; currently missing and must be added
- Deletion: archive/cancel only after use; hard delete only unused draft/test rows

### `ak_financial_entries`

- Canonical role: immutable accounting/cash ledger and forecast register
- Legacy role: existing generic ledger entries requiring classification
- Allowed writes: new canonical event, reversal, adjustment, allocation metadata
- Disallowed writes: destructive edit of posted amount/date/direction/owner; independent duplicate creation from legacy modules
- Ownership: explicit counterparty type/ID contract; transfer may use internal account instead
- Project: required or explicitly company overhead/unallocated
- Account: canonical account type
- Currency: required ISO code; base amount/rate required for converted reporting
- Deletion: no hard delete for posted entries; reverse/cancel

### `ak_payments`

- Canonical role after migration: none
- Legacy role: preserved customer collection source and compatibility view
- Allowed writes during transition: only through a dual-write adapter that atomically creates/links canonical ledger entry
- Allowed writes after cutover: none
- Disallowed: direct independent creation/update/delete
- Ownership/project/account: retained for audit; canonical values live on linked ledger event
- Deletion: never delete migration history; archive if needed

### `ak_expenses`

- Canonical role after migration: none
- Legacy role: preserved simple expense source
- Allowed writes during transition: compatibility adapter with atomic canonical ledger creation
- Allowed writes after cutover: none
- Disallowed: independent expense creation
- Missing historical fields: account, currency, supplier; migration defaults require provenance flags
- Deletion: preserve; archive only

### Master tables

| Table | Canonical role | Required future behavior |
|---|---|---|
| `ak_customers` | Customer counterparty master | Archive instead of delete when finance history exists |
| `ak_projects` | Profit/cost center master | Archive instead of delete; project linkage retained permanently |
| `ak_employees` | Personnel counterparty master | Archive when inactive; no deletion with finance history |
| `ak_expense_cards` | Supplier/expense counterparty master | Clarify whether every card is supplier, cost center, or both; archive with history |

## Canonical Transaction Field Contract

### Core identity and provenance

| Field | Contract |
|---|---|
| `id` | Immutable UUID primary key |
| `business_transaction_id` | Immutable UUID grouping all legs/allocations of one business event |
| `event_type` | Controlled accounting object type |
| `source_type` | `native`, `legacy_payment`, `legacy_expense`, `legacy_ledger`, `migration`, `import`, or approved integration |
| `source_id` | Immutable source row ID where applicable |
| `source_version` | Optional source contract/version |
| `payment_plan_id` | Plan directly settled or mirrored; nullable for unallocated/unplanned events |
| `parent_entry_id` | Original entry for refund/reversal/adjustment |

Unique rule: `(source_type, source_id)` must be unique when `source_id` is present.

### Ownership

| Field | Contract |
|---|---|
| `counterparty_type` | `customer`, `employee`, `supplier`, `government`, `internal`, `other`, `none` |
| `counterparty_id` | Required for customer/employee/supplier; validated against matching master |
| `customer_id`, `employee_id`, `expense_card_id` | May remain temporarily for compatibility, but must agree with canonical counterparty |
| `project_id` | Required for project-attributable events |
| `allocation_scope` | `project`, `company_overhead`, `unallocated` |
| `allocation_note` | Required for company overhead/unallocated |

### Accounting classification

| Field | Contract |
|---|---|
| `account_type` | Canonical `resmi` or `gayri_resmi`; replaces semantic duplication with `group_tag` |
| `direction` | `income`, `expense`, or `transfer`; presentation maps to Turkish labels |
| `status` | `draft`, `forecast`, `posted`, `canceled`, `reversed`, `archived` |
| `amount` | Positive decimal in transaction currency |
| `currency` | ISO 4217 code; initially TRY/USD/EUR |
| `exchange_rate` | Rate to reporting/base currency on transaction date |
| `base_amount` | Locked reporting-currency amount for posted events |
| `transaction_date` | Cash/accounting effective date |
| `due_date` | Required on plans/forecasts, not normally on realized cash events |

### Payment and maturity

- `payment_method`
- `transaction_reference`
- `cheque_maturity_date`
- `cheque_no`
- `bank_name`
- `promissory_maturity_date`
- Optional future internal cash/bank account ID

Cheque/senet maturity belongs primarily to the plan/instrument. The realized cash transaction date records actual clearing/payment. Issuing or receiving a cheque is not automatically cash realization unless the approved accounting policy says so.

### Cost and descriptive metadata

- `category_code`
- `subcategory_code`
- `description`
- `document_id` or stable document reference
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `archived_at`
- `archived_by`
- `canceled_at`
- `canceled_by`
- `cancellation_reason`
- `reversal_entry_id`
- `migration_confidence`: `exact`, `probable`, `ambiguous`, `manual`
- `reconciliation_status`

## Settlement Rules

### General

- A plan is settled only by posted canonical transactions allocated to it.
- Plan `paid_amount` and status are computed projections, not independently editable accounting facts.
- Allocation must match plan currency, account type, counterparty, and project unless an authorized exception is documented.
- Settlement allocations should be stored separately if one transaction can settle multiple plans or one plan can receive multiple transactions.

Recommended relation:

```text
ak_payment_plan_settlements
- id
- payment_plan_id
- financial_entry_id
- allocated_amount
- currency
- created_by
- created_at
- reversed_at
```

Unique `(payment_plan_id, financial_entry_id)` prevents accidental duplicate allocation.

### Customer receivable

- Posted `customer_receipt` settles one or more customer receivable plans.
- An unallocated customer advance remains unapplied cash and does not reduce a plan until allocated.
- Existing unlinked FIFO may remain as an optional allocation command, but the result must be persisted as settlement rows rather than recalculated differently in each screen.

### Personnel payable

- Posted `personnel_payment` settles personnel payable plans.
- A salary/advance payment without a plan is marked unplanned.
- Plans cannot be manually set paid without a posted settlement, except migration adjustments with explicit provenance.

### Supplier payable

- Posted `supplier_payment` settles supplier payable plans.
- Invoice recognition and payment are distinct if accrual tracking is required: plan/obligation records expected liability; posted payment records cash outflow.

### General expense payable

- Immediate cash expense: one posted `general_expense`, no plan required.
- Future/due expense: payable plan first, posted general-expense payment later.
- A government or one-time counterparty may use an explicit non-master counterparty classification.

### Partial payment

- Allocated amount is less than remaining plan amount.
- Plan becomes partially settled.
- If due date has passed, remaining balance is overdue even though some amount was paid.

### Overpayment

- Allocation cannot exceed plan remaining amount.
- Excess becomes unallocated counterparty credit/advance or is allocated to another compatible plan.
- Silent clipping is prohibited.

### Early payment

- Allowed before due date.
- Plan becomes settled/partial according to allocated amount.
- Expected cashflow excludes settled amount from future inflow/outflow.

### Overdue partial payment

- Paid portion remains realized cash.
- Remaining portion remains overdue.
- Status presented as partial/overdue according to UI contract, but calculations always use both flags: `is_partial` and `is_overdue`.

### Cancellation

- A plan with no settlement may be canceled.
- A partially settled plan requires settlement handling before cancellation: retain allocations, create refund/credit decision, and cancel only remaining obligation.
- Posted transactions are reversed, not deleted.

### Refund

- Refund references original transaction.
- Original plan settlement may be reduced/reopened through reversal allocation.
- Refund uses the same counterparty, project, account type, and currency unless an approved exception is recorded.

### Manual paid restriction

- Normal users cannot write `paid_amount` or force `Ödendi`.
- Migration-only opening settlement may create an opening-balance ledger entry and settlement allocation.
- Administrative correction requires adjustment/reversal, actor, reason, and audit record.

## Project Profitability Rules

All formulas operate per currency unless a locked base-currency amount is explicitly used. Canceled/reversed/archived events are excluded.

### Project expected income

```text
sum(active customer receivable plan amount)
+ sum(uncommitted forecast income not linked to a plan)
```

Plan-linked ledger projections are excluded to avoid duplication.

### Project collected income

```text
sum(posted customer_receipt base_amount)
+ posted expense_refund or other approved project income
- posted customer_refund
```

Transfers and opening balances are excluded from current-period collected income.

### Project remaining receivable

```text
sum(max(0, active receivable plan amount - active settlement allocations))
```

### Project overdue receivable

Same remaining-receivable formula restricted to due date before report date. Partially paid plans contribute their remaining amount.

### Project expected expense

```text
sum(active payable plan amount)
+ sum(uncommitted forecast expense not linked to a plan)
```

### Project paid expense

```text
sum(posted personnel_payment)
+ sum(posted supplier_payment)
+ sum(posted general_expense)
+ other approved posted expense events
- expense_refund
```

### Project remaining payable

```text
sum(max(0, active payable plan amount - active settlement allocations))
```

### Project overdue payable

Remaining payable restricted to past-due plans.

### Project realized profit

```text
project collected income - project paid expense
```

This is realized cash profit, not accrual accounting profit.

### Project expected profit

```text
project expected income - project expected expense
```

An alternate forecast-at-completion metric may combine actual plus remaining:

```text
(collected income + remaining receivable)
- (paid expense + remaining payable)
```

The UI/report must name these metrics distinctly.

### Project cash gap

Forward-looking:

```text
remaining payable due within horizon - remaining receivable due within horizon
```

Positive value means additional cash funding is required.

Current liquidity gap:

```text
overdue payable - overdue receivable
```

### Official/unofficial split

Every formula can be filtered by account type. Combined totals are the arithmetic sum of the two independent groups; settlement never crosses groups.

### Company overhead

- Company overhead is never silently assigned to a project.
- `allocation_scope = company_overhead` and category are required.
- Project profitability excludes overhead by default.
- A separate management report may allocate overhead to projects using an approved allocation method. Allocated management views must not rewrite source transactions.

## Official / Unofficial Account Rules

- Canonical stored values: `resmi`, `gayri_resmi`.
- UI remains Turkish: `Resmi Hesap`, `Gayri Resmi Hesap`.
- Plan, transaction, settlement, refund, reversal, and adjustment must retain the same account type.
- Cross-account settlement is prohibited.
- Legacy `group_tag` is mapped deterministically:
  - `Resmi` -> `resmi`
  - `Gayri Resmi` -> `gayri_resmi`
- Legacy expense rows have unknown account provenance. Defaulting them to Resmi is a migration assumption, not verified fact; mark `migration_confidence`.
- Reports must support separate and combined views.
- Access/privacy rules for unofficial data require a business decision before coding.

## Currency Rules

- Store transaction currency and positive amount.
- Plans and settlements must use the same currency unless an explicit conversion event is used.
- Posted events require a locked base-currency rate and base amount when company-wide TRY reporting is needed.
- Historical reports use stored rates, never today's market rate.
- Currency difference is a separate event.
- Do not sum TRY/USD/EUR amounts directly.
- Legacy payments/expenses migrate as TRY with source provenance.
- Opening balances preserve original currency.
- Refunds normally use original currency; cross-currency refunds require explicit rate/difference entries.

## Category and Cost-Type Rules

Use controlled category codes with Turkish display labels. Suggested top-level contract:

| Code | Turkish UI label |
|---|---|
| `material` | Malzeme |
| `labor` | İşçilik |
| `demolition` | Yıkım |
| `machine_rental` | Makine Kiralama |
| `iron_steel` | Demir / Çelik |
| `cement_concrete` | Çimento / Beton |
| `permit_official` | Ruhsat / Resmi İşlemler |
| `government_payment` | Kamu Ödemeleri |
| `architecture_engineering` | Mimari / Proje |
| `subcontractor` | Taşeron |
| `transportation` | Nakliye |
| `construction_site` | Şantiye Gideri |
| `office` | Ofis Gideri |
| `tax_fee` | Vergi / Harç |
| `utility` | Elektrik / Su / Doğalgaz |
| `other` | Diğer |

- Subcategory is optional but controlled where used.
- Existing free-text categories are mapped, not overwritten.
- Unknown historical values map to `other` while preserving original text.
- Category does not replace counterparty, project, account type, or event type.

## Deletion / Archive Rules

- Posted ledger events are immutable and never hard-deleted.
- Correction uses reversal plus replacement/adjustment.
- Plans with history are canceled/archived, not deleted.
- Draft unused records may be hard-deleted before posting.
- Customers, projects, personnel, and suppliers with financial history are archived.
- Foreign keys for canonical finance history should use `RESTRICT` for protected masters or preserve immutable snapshot fields; `SET NULL` alone is insufficient.
- Legacy source rows remain preserved through migration and rollback retention.
- Documents referenced by finance history are archived and reference-protected.
- Every archive/cancellation records actor, timestamp, and reason.

## Migration Strategy

### Phase A: freeze contract and inventory

- Approve P0 decisions.
- Back up database and uploaded documents.
- Run read-only row counts, null-link checks, value distributions, and duplicate candidates.
- Record deployed commit/schema.

### Phase B: additive schema

- Add canonical fields and indexes without removing legacy fields/tables.
- Add settlement relation and migration/reconciliation status.
- Add missing foreign keys only after orphan analysis.
- Do not switch reads or writes.

### Phase C: classify existing ledger

- Map current entries to event types using owner, direction, status, title/category, and provenance.
- Mark ambiguous rows for manual review.
- Preserve original values.

### Phase D: migrate legacy payments

- For each `ak_payments` row:
  - Find exact existing ledger link by source fields.
  - Otherwise search probable duplicates by customer, project, account, amount, date, method, and description.
  - Exact unique match: link and mark reconciled.
  - No match: create canonical `customer_receipt`.
  - Multiple/probable matches: quarantine for review.
- Create persisted plan settlements from explicit links first.
- Convert approved historical FIFO allocation into settlement rows only after reconciliation.

### Phase E: migrate legacy expenses

- Match by project, customer/counterparty where available, amount, date, title, and document.
- Create `general_expense` only when no canonical match exists.
- Mark account type assumption and TRY assumption.
- Route ambiguous supplier/category/project cases to review.

### Phase F: reconcile plans

- Classify owner/direction.
- Add currency/account/project scope.
- Replace manual paid amounts with linked settlements or migration opening settlements.
- Do not erase historical manual fields until acceptance.

### Phase G: shadow reporting

- Run old and canonical reports side by side.
- Compare totals by day, project, counterparty, account, category, and currency.
- Investigate every difference outside approved migration adjustments.

### Phase H: write cutover

- New UI/API writes create canonical ledger/settlement records.
- Legacy endpoints either become read-only or use atomic adapters.
- Prevent independent duplicate writes with database uniqueness constraints.

### Phase I: read cutover

- Dashboard, Finance, Reports, cards, and statements read canonical query/service outputs.
- Remove synthetic `UNION ALL` and frontend legacy conversions from active calculations.
- Keep legacy drill-down for audit.

### Phase J: stabilization

- Monitor reconciliation exceptions and report parity.
- Keep rollback compatibility for an agreed period.
- Archive legacy modules only after sign-off; do not delete tables.

### Duplicate detection

Exact duplicate:

- Explicit source link, matching business transaction ID, or unique source pair.

Probable duplicate:

- Same counterparty, direction, amount, currency, account type, date within approved tolerance, project, and similar reference/document/title.

Ambiguous:

- Multiple candidates, missing owner/project, manual paid state without cash row, or conflicting account/currency.

Automated migration may create/link only exact or approved high-confidence records. Ambiguous records remain unchanged and excluded from cutover acceptance until reviewed.

### Null linkage handling

- Null project with clear plan/project/customer relationship: propose, do not silently apply without deterministic rule and review report.
- Genuine overhead: classify explicitly.
- Unknown project: retain `unallocated` and block project profitability acceptance.
- Null owner: infer only from exact plan/source relation; otherwise quarantine.

### Rollback

- Additive schema only before cutover.
- Keep legacy rows and original columns untouched.
- Every migrated canonical row includes source identity and migration batch.
- Rollback switches read/write feature flags to legacy behavior and disables canonical writes.
- Delete only migration-generated rows from a named batch after verifying they have no post-cutover dependencies; never issue broad destructive rollback SQL.

### Data validation

- Row counts by source/migration status.
- Sum by source/date/project/account/currency.
- One source row to at most one canonical event.
- Settlement allocation never exceeds plan or transaction.
- No posted canonical event lacks required ownership/scope.
- No plan status disagrees with settlement sum.

## Reconciliation SQL Plan

The following are drafts. Run read-only in staging/backup first and adapt to final field names.

### Legacy payment without ledger entry

```sql
SELECT p.*
FROM ak_payments p
LEFT JOIN ak_financial_entries fe
  ON fe.source_type = 'legacy_payment'
 AND fe.source_id = p.id
WHERE fe.id IS NULL;
```

### Ledger customer income without legacy payment

```sql
SELECT fe.*
FROM ak_financial_entries fe
LEFT JOIN ak_payments p
  ON fe.source_type = 'legacy_payment'
 AND fe.source_id = p.id
WHERE fe.event_type = 'customer_receipt'
  AND fe.status = 'posted'
  AND p.id IS NULL;
```

### Probable duplicate customer collection

```sql
SELECT p.id AS payment_id, fe.id AS entry_id, p.customer_id, p.amount, p.payment_date
FROM ak_payments p
JOIN ak_financial_entries fe
  ON fe.customer_id = p.customer_id
 AND fe.direction IN ('Gelir', 'income')
 AND fe.amount = p.amount
 AND ABS(DATEDIFF(fe.entry_date, p.payment_date)) <= 1
 AND COALESCE(fe.project_id, '') = COALESCE(p.project_id, '')
WHERE NOT (fe.source_type = 'legacy_payment' AND fe.source_id = p.id);
```

### Expense without ledger entry

```sql
SELECT e.*
FROM ak_expenses e
LEFT JOIN ak_financial_entries fe
  ON fe.source_type = 'legacy_expense'
 AND fe.source_id = e.id
WHERE fe.id IS NULL;
```

### Ledger expense without legacy expense

```sql
SELECT fe.*
FROM ak_financial_entries fe
LEFT JOIN ak_expenses e
  ON fe.source_type = 'legacy_expense'
 AND fe.source_id = e.id
WHERE fe.direction IN ('Gider', 'expense')
  AND fe.status IN ('Gerçekleşti', 'posted')
  AND e.id IS NULL;
```

### Probable duplicate general expense

```sql
SELECT e.id AS expense_id, fe.id AS entry_id, e.amount, e.expense_date, e.title
FROM ak_expenses e
JOIN ak_financial_entries fe
  ON fe.direction IN ('Gider', 'expense')
 AND fe.amount = e.amount
 AND ABS(DATEDIFF(fe.entry_date, e.expense_date)) <= 1
 AND COALESCE(fe.project_id, '') = COALESCE(e.project_id, '')
 AND LOWER(TRIM(fe.title)) = LOWER(TRIM(e.title))
WHERE NOT (fe.source_type = 'legacy_expense' AND fe.source_id = e.id);
```

### Plan without project

```sql
SELECT *
FROM ak_payment_plans
WHERE project_id IS NULL
  AND status <> 'İptal';
```

### Payment with mismatched plan project

```sql
SELECT p.id, p.project_id AS payment_project, pp.project_id AS plan_project
FROM ak_payments p
JOIN ak_payment_plans pp ON pp.id = p.payment_plan_id
WHERE COALESCE(p.project_id, '') <> COALESCE(pp.project_id, '');
```

### Plan without exactly one owner

```sql
SELECT *
FROM ak_payment_plans
WHERE
  (customer_id IS NOT NULL)
  + (employee_id IS NOT NULL)
  + (expense_card_id IS NOT NULL) <> 1;
```

### Personnel/supplier plan without settlement

```sql
SELECT pp.*
FROM ak_payment_plans pp
LEFT JOIN ak_payment_plan_settlements s
  ON s.payment_plan_id = pp.id
 AND s.reversed_at IS NULL
WHERE (pp.employee_id IS NOT NULL OR pp.expense_card_id IS NOT NULL)
GROUP BY pp.id
HAVING COALESCE(SUM(s.allocated_amount), 0) = 0
   AND pp.status IN ('Ödendi', 'Kısmi Ödendi');
```

### Null/invalid account classification

```sql
SELECT 'plan' AS source, id, account_type AS value
FROM ak_payment_plans
WHERE account_type IS NULL OR account_type NOT IN ('resmi', 'gayri_resmi')
UNION ALL
SELECT 'payment', id, account_type
FROM ak_payments
WHERE account_type IS NULL OR account_type NOT IN ('resmi', 'gayri_resmi')
UNION ALL
SELECT 'entry', id, group_tag
FROM ak_financial_entries
WHERE group_tag IS NULL OR group_tag NOT IN ('Resmi', 'Gayri Resmi');
```

### Unsupported currency

```sql
SELECT *
FROM ak_financial_entries
WHERE currency_tag IS NULL OR currency_tag NOT IN ('TRY', 'USD', 'EUR');
```

### Detached ownership

```sql
SELECT fe.*
FROM ak_financial_entries fe
LEFT JOIN ak_customers c ON c.id = fe.customer_id
LEFT JOIN ak_employees em ON em.id = fe.employee_id
LEFT JOIN ak_expense_cards ec ON ec.id = fe.expense_card_id
WHERE (fe.customer_id IS NOT NULL AND c.id IS NULL)
   OR (fe.employee_id IS NOT NULL AND em.id IS NULL)
   OR (fe.expense_card_id IS NOT NULL AND ec.id IS NULL);
```

### Settlement over-allocation

```sql
SELECT pp.id, pp.amount, SUM(s.allocated_amount) AS allocated
FROM ak_payment_plans pp
JOIN ak_payment_plan_settlements s
  ON s.payment_plan_id = pp.id
 AND s.reversed_at IS NULL
GROUP BY pp.id, pp.amount
HAVING SUM(s.allocated_amount) > pp.amount;
```

## UI Behavior Contract

All user-facing labels remain Turkish. The visual design remains unchanged unless a later scoped phase explicitly approves UX changes.

### Müşteriler / customer cards

- Plan totals come from canonical receivable plans.
- Collected totals come from posted customer receipts.
- Remaining and overdue include partial-plan remainders.
- Resmi and Gayri Resmi never cross.

### Tahsilatlar

- Creating a collection creates one canonical customer receipt and optional settlement allocation atomically.
- A plan selection inherits/validates customer, project, currency, and account.
- Unallocated advance is visibly distinct from settled collection.

### Giderler

- Creates canonical general expense or supplier payment according to selected counterparty.
- Requires Resmi/Gayri Resmi, currency, project/overhead scope, and controlled category.
- Legacy rows remain viewable but are marked read-only after cutover.

### Gider Kartları

- Supplier payable plans and posted supplier payments use the same settlement relationship.
- Remaining/overdue values derive from settlements.

### Personeller

- Personnel plans and payments follow the supplier settlement model.
- Manual paid status is removed from normal flow.

### Projeler / project card

- Shows expected, realized, remaining, overdue, and cash-gap metrics from canonical queries.
- Unallocated/overhead records are not silently included.

### Finans Özeti

- Reads a server-side canonical summary.
- Does not merge legacy tables in the browser.
- Supports account and currency filters without direct mixed-currency summation.

### Raporlar

- Every report uses the same canonical service/view.
- Collection and expense detail reports include all canonical events, with source provenance.
- Exported totals match dashboard and cards for identical filters.

### Dashboard

- Uses canonical posted cash for realized totals.
- Uses plans plus unlinked forecasts for expected totals.
- Recent movements show canonical event provenance.

### Statement cards

- Customer, personnel, supplier, and project statements use canonical ledger events.
- Plan section uses canonical plans and persisted settlements.
- Legacy source links remain available for audit but are non-additive.

## Implementation Phase Plan

### Phase 3A: decision lock and reconciliation inventory

- Files: documentation plus new read-only SQL/script location
- Goal: approve enums/policies and produce anomaly counts
- Validation: SQL read-only review, `npm run build`, `npm run test`, all PHP lint
- Rollback: no data/schema change

### Phase 3B: additive migration schema

- Files: versioned migration SQL, installer reference, schema tests
- Goal: add canonical fields, settlement table, indexes, archive/audit fields
- Validation: apply to disposable MySQL; schema assertions; rollback script review
- Rollback: reverse only newly added objects before any canonical writes

### Phase 3C: canonical domain service and tests

- Files: focused PHP finance service, TypeScript types/client, tests
- Goal: central validation, settlement, status, and summary contract
- Validation: unit/integration tests, build, lint on touched files, PHP lint
- Rollback: feature flag keeps old endpoints active

### Phase 3D: migration dry-run tooling

- Files: migration/reconciliation scripts and generated ignored reports
- Goal: classify exact/probable/ambiguous rows without writes
- Validation: repeatable counts and checksums
- Rollback: none; read-only

### Phase 3E: batch migration in staging

- Files: reviewed migration runner only
- Goal: create canonical rows/source links in transactions
- Validation: source-to-canonical uniqueness, sums, settlement caps, report parity
- Rollback: migration-batch-specific reversal/removal before cutover

### Phase 3F: shadow reads

- Files: dashboard/finance/report endpoints and comparison tests
- Goal: calculate old and canonical totals side by side without UI switch
- Validation: fixture matrix by project/account/currency/counterparty
- Rollback: disable canonical shadow feature

### Phase 3G: write adapters

- Files: payments, expenses, financial statement, plan endpoints
- Goal: atomic canonical writes while preserving temporary compatibility rows
- Validation: transaction rollback, duplicate retries, idempotency, settlement tests
- Rollback: feature flag to legacy write path; retain canonical batch for reconciliation

### Phase 3H: UI read cutover

- Files: API client/types and limited existing admin pages
- Goal: replace mixed client calculations with canonical responses without redesign
- Validation: build, tests, authenticated browser CRUD and mobile smoke test
- Rollback: endpoint/read feature flag

### Phase 3I: legacy write lock

- Files: legacy endpoints/config and operational documentation
- Goal: make legacy tables read-only to application flows
- Validation: attempted direct writes fail clearly; canonical writes pass
- Rollback: controlled temporary adapter re-enable

### Phase 3J: production reconciliation and sign-off

- Goal: deploy with backup, run reconciliation, compare reports, obtain business approval
- Validation: acceptance criteria below and production smoke checklist
- Rollback: restore feature flags or database backup according to failure severity

## P0 Decisions Required Before Coding

1. Confirm `ak_financial_entries` as the canonical ledger and `ak_payment_plans` as the canonical obligation schedule.
2. Decide whether cheque/senet counts as realized cash at issuance/receipt or only at clearing/maturity.
3. Approve base reporting currency and exchange-rate source/timing policy.
4. Approve whether every project-attributable record must require a project and how company overhead is represented.
5. Approve counterparty taxonomy, especially whether `ak_expense_cards` means supplier, generic expense account, or both.
6. Approve treatment of current manual paid amounts lacking a transaction: opening settlement, ambiguous review, or non-cash adjustment.
7. Approve official/unofficial access, reporting, export, and retention policy.
8. Approve archive/legal retention duration and who can reverse/cancel posted events.
9. Approve whether unlinked customer collections remain FIFO-allocatable or must be manually allocated.
10. Approve project expected-profit and cash-gap definitions presented to management.

## P1 Engineering Risks

1. Probable duplicate matching can create false positives if amount/date are common.
2. Existing null project/owner records may prevent clean profitability acceptance.
3. Runtime DDL must be removed before migration deployment is trustworthy.
4. Shared hosting execution limits may require small resumable batches.
5. Dual-write adapters can diverge without database transactions/idempotency.
6. Existing reports may appear to decrease after legitimate deduplication; business sign-off is required.
7. Multi-currency historical entries may lack reliable exchange rates.
8. `SET NULL` deletion behavior can undermine canonical ownership unless archive rules are implemented first.
9. Current limited tests are insufficient for migration/cutover.
10. Legacy documents and source rows may have incomplete provenance.

## Acceptance Criteria

- Every posted canonical event has one event type, direction, status, currency, account type, transaction date, ownership/scope, and business transaction ID.
- Every migrated legacy payment/expense is linked to exactly one canonical event or explicitly marked ambiguous/excluded.
- No source row maps to multiple canonical events.
- Plan settlements never exceed plan or transaction available amount.
- Plan status equals computed settlement state.
- Past-due partial plans contribute remaining amount to overdue totals.
- Project totals include all and only project-linked canonical events/plans.
- Company overhead is separately reported.
- Resmi/Gayri Resmi settlement never crosses.
- Currency totals are separated or converted using stored rates.
- Dashboard, Finance, Reports, and cards return identical totals for identical filters.
- Reconciliation differences are zero or documented/approved.
- Legacy tables remain preserved and application writes are locked after cutover.
- Migration rollback is tested on a staging copy.
- Required build, test, PHP lint, API integration, and authenticated browser smoke tests pass.

## Recommended Phase 3

Proceed with **Phase 3A — Canonical Decision Lock and Read-Only Reconciliation Inventory**.

The phase should create:

1. An approved enum/policy decision record for the ten P0 items.
2. Read-only reconciliation SQL/scripts with no schema or production writes.
3. A data-quality report containing counts and amounts for exact matches, probable duplicates, ambiguous rows, null project/owner records, manual paid plans, account/currency anomalies, and detached ownership.
4. A migration readiness decision based on actual production/staging data.

Do not begin write cutover or report replacement until Phase 3A demonstrates that existing records can be classified safely.

## Validation

- `npm run build`: passed. Vite 5.4.21 transformed 2,637 modules and completed the production build in 17.70 seconds.
- `npm run test`: passed. Vitest 3.2.6 reported 2 test files passed and 6 tests passed.
- `php -l` for all `public_html` PHP files: passed. All 48 PHP files completed syntax validation successfully.
- This document introduces no business logic, UI, schema, credential, or production-data change.
