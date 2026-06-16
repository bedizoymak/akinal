# Phase 4B - Cashflow Logic Audit and Roadmap

**Date:** 2026-06-15  
**Scope:** Planning and audit only  
**Database activity:** None  
**Final decision:** `READY_FOR_PHASE_4C`

## Executive Decision

The project is ready for a narrowly scoped Phase 4C implementation, but it is not ready for migration, canonical read cutover, canonical write activation, or production cashflow sign-off.

Phase 4A established a credible canonical model: payment plans are obligations, financial entries are accounting/cash events, and settlements are the only allocation authority. The current application does not yet enforce that model. Legacy tables and the ledger remain independently writable and independently counted; plan status has several authorities; posted ledger rows can be edited or deleted; and account, owner, project, status, and expense semantics are inconsistent across sources.

Phase 4C must therefore implement only the disabled canonical transaction boundary and its automated tests. It must not change live reads or writes.

## Sources Reviewed

- `docs/FULL_PRODUCTION_GO_LIVE_AUDIT.md`
- `docs/PHASE_4A_CANONICAL_SETTLEMENT_PLAN.md`
- `docs/ENGINEERING_GUARDRAILS.md`
- MySQL schema in `public_html/install-schema.php`
- Finance APIs under `public_html/api/admin/`
- Canonical validation in `public_html/api/admin/canonical-finance-service.php`
- Finance calculations in `src/lib/finance.ts`
- Customer, project, personnel, supplier/expense-card, collection, expense, finance, dashboard, and report UI paths
- Existing finance and canonical contract tests

No local PDO connectivity test was used. No SQL was executed because this audit could be completed from the current schema and code. If later data verification is required, it must use the known-working hosting-side SQL Editor/configuration path.

## Current Cashflow Source Map

| Source | Current role | Main owners | Material fields | Current risks |
| --- | --- | --- | --- | --- |
| `ak_payment_plans` | Receivable/payable obligations and due dates | Customer, employee, expense card; project optional | amount, `paid_amount`, due date, account type, status, method/instrument fields, new canonical metadata | Status and paid value are both stored and calculated; manual state can conflict with evidence; one table represents different business domains |
| `ak_payments` | Customer collection records | Customer and optional project/plan | amount, date, account type, method | Customer-centric; no employee/supplier ownership in schema; linked and implicit FIFO allocation coexist; no canonical provenance |
| `ak_expenses` | Realized general/project/customer expense records | Project/customer optional | category, amount, date | No account type, currency, paid/planned state, supplier/personnel identity, obligation, or settlement evidence |
| `ak_financial_entries` | Unified manual ledger and future canonical ledger | Customer, employee, expense card, project | direction, status, group/account, amount/currency plus additive canonical fields | Old and canonical vocabularies coexist; direct CRUD is allowed; duplicates legacy events; provenance is optional; posted rows are mutable/deletable |
| `ak_payment_plan_settlements` | Additive canonical allocation table | Plan and ledger entry | allocated amount, currency, account type, reversal fields | Correct target model, but not yet the runtime authority |
| `ak_customers` / `ak_customer_projects` | Customer identity and project association | Customer/project | status and relationship | No archive accounting contract; deletion/cascade can remove business context |
| `ak_projects` | Project identity and public/project metadata | Project | project status and descriptive fields | Profitability has no single backend calculation authority |
| `ak_employees` | Personnel identity/card | Employee | identity, role, status | Cost records are spread between plans and ledger; no dedicated paid event source in legacy model |
| `ak_expense_cards` | UI label currently used as supplier/expense card | Generic expense card | name, category, status | Conflates supplier/vendor identity with expense category/card; lacks supplier legal/payment metadata |
| Dashboard/reports/finance summary | Aggregate read surfaces | All domains | fetch all legacy and ledger rows | Different screens can count different source combinations and formulas |

## Current Source-of-Truth Conflicts

### 1. Realized cash events

- Customer collections live in `ak_payments`.
- General expenses live in `ak_expenses`.
- Equivalent realized income and expense rows can also live in `ak_financial_entries`.
- `financial-statement.php` unions legacy payments/expenses with ledger entries for display, while other screens summarize ledger or legacy arrays differently.
- There is no enforced unique `source_type + source_id` identity preventing the same event from being counted twice.

### 2. Plan paid amount and status

Plan state can currently come from:

- linked `ak_payments`;
- unlinked customer/account FIFO allocation;
- manually stored `ak_payment_plans.paid_amount`;
- manually stored `ak_payment_plans.status`;
- frontend `effectivePaidForPlan` and `derivePlanStatus` calculations;
- canonical settlement helpers, which are not yet active runtime authority.

This permits the same plan to be pending, partial, paid, or overdue depending on the endpoint or screen.

### 3. Official and unofficial accounts

- Plans and payments use `account_type` values `resmi`/`gayri_resmi`.
- Legacy ledger UI uses `group_tag` values `Resmi`/`Gayri Resmi`.
- Canonical ledger adds nullable `account_type`, while compatibility fallback derives it from `group_tag`.
- `ak_expenses` has no account field and is currently adapted as `Resmi` and `Gerçekleşti` regardless of business reality.

Official/unofficial separation is therefore not provable for legacy expenses and is dependent on normalization for ledger rows.

### 4. Planned versus actual

- Plans represent obligations, but can contain manually paid values.
- Ledger status uses Turkish legacy values while canonical status uses values such as `forecast`, `posted`, `canceled`, and `reversed`.
- Legacy expenses are always treated as realized.
- Cheque/senet fields exist, but maturity does not prove clearing; current screens can treat status labels as cash evidence.

### 5. Owner and card identity

- Customers, personnel, and expense cards can own plans and ledger entries.
- Legacy payments only model customers.
- `expense_card_id` is used as the compatibility supplier identifier, but `ak_expense_cards` is also an expense-category/card concept.
- Project-level entries can be attached without a counterparty, while some customer plans and payments have optional projects.

Supplier identity and expense category are not cleanly separated, and project attribution can differ between obligation and payment.

## Calculation Risk Audit

### Customer balance

Required formula by currency and account type:

`remaining receivable = active receivable plan amount - active settlements`

Current risks:

- manual `paid_amount` can duplicate linked/unlinked payments;
- unlinked FIFO can consume plans without a persisted allocation trail;
- payments and matching ledger receipts can both enter totals;
- canceled/archived plans are not uniformly excluded;
- refunds and reversals lack one enforced treatment;
- multi-currency values can be added without approved base-currency conversion;
- overdue logic can differ between stored status and calculated due-date state.

### Project profitability

Required views must remain distinct:

- realized income;
- realized expense;
- remaining receivables;
- remaining payables;
- realized net cash = realized income - realized expense;
- forecast completion profit = realized income + remaining receivables - realized expense - remaining payables.

Current risks:

- legacy and ledger duplication;
- plans counted as income/expense and again as realized events;
- customer receipts with missing/different project attribution;
- company overhead incorrectly assigned to a project or omitted;
- official/unofficial amounts merged;
- currencies summed as if all were TRY;
- canceled, reversed, archived, or deleted-context rows included inconsistently.

### Personnel cost

- Personnel plans exist, but legacy payments cannot settle them directly.
- Personnel ledger entries can independently represent planned or realized expense.
- Manual plan paid state can appear without a payment event.
- Purpose/category and project allocation are optional/inconsistent.
- The UI may show plan totals and ledger totals without persisted settlement evidence.

### Supplier cost

- Supplier is represented through a generic expense card rather than a dedicated supplier master.
- Legacy expenses have category/project but no supplier, account type, or paid/planned state.
- Supplier plans and supplier ledger entries can duplicate one obligation/event.
- Material/service classification is free-form across title, description, category, and canonical codes.

### Partial payment and overdue state

Canonical rule:

- paid = active settlements equal plan amount;
- partial = active settlements are greater than zero and below plan amount;
- overdue = remaining amount is positive and due date is before the as-of date;
- pending = no settlement and not overdue;
- canceled/archived plans never become overdue.

Current risks are manual paid amounts, skipped already-paid states, implicit FIFO, rounding, over-allocation under concurrency, and inconsistent as-of dates/time zones.

### Deleted and archived records

- Legacy APIs support hard deletion of payments, expenses, and ledger entries.
- Foreign keys can set owner/project references to null or cascade relationship rows.
- Canonical archive/cancel/reversal columns exist but are not consistently used.
- Historical profitability can change after deletion or owner removal.

Posted financial history must become immutable; corrections must use reversal/adjustment events and archived counterparties must retain reportable identity.

## Required Domain Model

### Customer financial card

Must show separate official/unofficial and currency buckets for total receivables, settled amount, remaining amount, overdue amount, unallocated receipts, refunds/reversals, and due-date schedule. Every paid amount must trace to active settlements and posted entries.

### Project financial/profitability card

Must show realized income/expense, receivables/payables, realized net cash, forecast completion profit, and category/counterparty breakdown. It must expose unassigned-project events rather than silently excluding them.

### Personnel expense card

Must show purpose, project, account type, currency, planned obligation, posted payment, remaining payable, due/overdue state, and settlement history.

### Supplier/vendor payable card

Must distinguish supplier identity from expense category. It must show material/service, project, account type, currency, obligation, posted payment, remaining payable, and settlement history.

### Expense taxonomy

Use controlled category codes with optional subcategories, including demolition, machine rental, iron/steel, cement/concrete, permits/licenses, government payments, labor/personnel, subcontractor, utilities, transport, construction stages, and other approved classes. Display labels may be Turkish; stored codes must be stable.

## Production-Safe Roadmap

### Phase 4C - Disabled canonical transaction foundation

Implement an isolated backend service behind a default-off server-side flag. Add transaction commands for canonical entry creation, legacy-backed idempotent entry creation, explicit settlement, reversal, and derived plan state. Use `FOR UPDATE`, active settlement sums, immutable posted records, and strict account/currency/counterparty/project validation.

Acceptance criteria:

- No live endpoint routes through the new service while the flag is off.
- No schema migration or production data change is included.
- One transaction covers compatibility row, canonical entry, settlement, and derived-state persistence where applicable.
- Duplicate source identity and idempotent retry tests pass.
- Concurrent over-allocation tests prove only available amounts can commit.
- Official/unofficial, currency, owner, project, direction, and event-type mismatch tests fail closed.
- Posted entries cannot be edited/deleted; tested reversal is the correction path.
- PHP is authoritative; TypeScript contract fixtures match it.

### Phase 4D - Classification and reconciliation specification

Produce hosting-side, read-only inventories and deterministic classification manifests for every legacy plan, payment, expense, and ledger row. Resolve supplier/card semantics and category mappings.

Acceptance criteria:

- Row counts and totals reconcile by table, currency, account type, status, owner, project, and demo/non-demo scope.
- Every legacy event is classified exact match, probable match, no match, ambiguous, or blocked.
- No ambiguous/blocked record is approved for migration.
- Every manual-paid plan has evidence or an explicit unresolved disposition.
- Legacy expenses with unknown account type are not silently marked official.

### Phase 4E - Additive schema hardening and migration rehearsal

After separate approval, add missing uniqueness/audit constraints and any approved supplier/category structure in a disposable restored environment. Remove runtime DDL only after schema parity is proven.

Acceptance criteria:

- Backup/restore rehearsal succeeds.
- Migration is idempotent and rollback boundaries are documented.
- Zero duplicate source identities, over-allocations, crossing settlements, or orphan canonical references.
- Runtime requests execute no DDL.
- Production remains unchanged.

### Phase 4F - Historical canonicalization

Run approved, restartable migration batches on a restored environment, then production only under a separate change authorization.

Acceptance criteria:

- Every migrated legacy event has deterministic provenance.
- Pre/post totals reconcile by all required dimensions.
- Demo data reconciles separately.
- Posted history is preserved; no destructive conversion occurs.
- Unresolved rows remain excluded from cutover totals.

### Phase 4G - Shadow writes and parity

Enable the canonical service only in controlled staging. One command may maintain compatibility and canonical records atomically; independent dual writes are forbidden.

Acceptance criteria:

- Customer receipt, partial/full settlement, unallocated receipt, refund, personnel payment, supplier payment, expense, cheque/senet clearing, and reversal scenarios pass.
- Fault injection proves full rollback.
- Legacy and canonical views reconcile within exact currency precision.
- No duplicate business event is created by retries.

### Phase 4H - Canonical read cutover

Move cards, dashboards, reports, exports, and profitability formulas to one backend canonical read model. Legacy tables remain audit-only and are excluded from totals.

Acceptance criteria:

- All screens use the same backend metric definitions and as-of date.
- Official/unofficial and currency buckets never merge.
- Customer, project, personnel, and supplier card totals reconcile to drill-down rows.
- Project realized cash and forecast profit are displayed as separate metrics.
- Legacy-versus-canonical parity gates are signed off before activation.

### Phase 4I - Canonical write cutover and retention controls

Make the canonical transaction service the only mutation boundary. Replace posted edit/delete with reversal and apply archive-first identity retention.

Acceptance criteria:

- Direct mutations to legacy finance tables are rejected or internal-only.
- Active finance references block hard deletion.
- Reversal and archive audit trails include actor, reason, time, and source.
- Operational monitoring and rollback routing are tested.
- Production cashflow smoke tests pass on hosting.

## Exact Phase 4C Scope

Phase 4C should implement:

1. A transaction-oriented canonical command service beside the existing validation service.
2. Commands for `createCanonicalEntry`, `createLegacyBackedEntry`, `settlePlan`, `reverseCanonicalEntry`, and `derivePlanState`.
3. Repository functions with row locks and no request-time DDL.
4. Idempotency/source identity handling.
5. Immutable posted-event and reversal rules.
6. Unit, contract, MySQL integration, concurrency, and rollback tests using isolated synthetic data.
7. A server-side feature flag that defaults off and is not enabled in production.
8. A Phase 4C implementation report proving no live behavior changed.

Phase 4C must not:

- migrate historical rows;
- alter production schema or data;
- change dashboard/report/card reads;
- route production writes through the service;
- infer unknown expense account types;
- silently allocate unlinked receipts by FIFO;
- introduce a new DB connection path.

## Final Decision

`READY_FOR_PHASE_4C`

Rationale: the canonical contract, additive settlement schema, and identified runtime boundaries are sufficient to build and test a disabled atomic service. The project remains blocked from migration and cutover until the later reconciliation, rehearsal, parity, and acceptance gates pass.
