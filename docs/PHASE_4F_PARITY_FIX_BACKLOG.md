# Phase 4F - Parity Fix Backlog

**Date:** 2026-06-15  
**Scope:** Backlog for Phase 4G parity implementation  
**Runtime behavior changed:** No  
**Database activity:** None  
**Decision:** `READY_FOR_PHASE_4G`

## Phase 4G Objective

Build a disabled, test-only canonical read-model parity harness that compares current card/report outputs against the Phase 4F formula catalog. Phase 4G must still avoid cutover, migrations, production writes, schema changes, and UI behavior changes.

## P0 - Must Fix Before Any Read Cutover

| ID | Backlog Item | Reason | Acceptance Criteria |
| --- | --- | --- | --- |
| P0-01 | Implement canonical metric fixtures for customer, project, personnel, supplier, and category cards | Formula contract needs executable parity proof | Synthetic fixtures cover official, unofficial, partial, overdue, unallocated, reversal, archived, and duplicate-risk states |
| P0-02 | Create read-model parity reporter | Current screens use multiple formulas | Reporter emits metric, owner, project, account type, currency, canonical amount, current amount, delta, row counts, and mismatch class |
| P0-03 | Add duplicate/double-count detector for legacy plus canonical evidence | Legacy payments/expenses and ledger rows can count the same event | Detector flags same source identity or same business signature and excludes flagged rows from canonical totals |
| P0-04 | Replace FIFO/manual-paid assumptions in canonical formulas | FIFO and manual `paid_amount` are not allocation evidence | Canonical remaining/paid/overdue uses active settlements only; manual values appear only as compatibility mismatch evidence |
| P0-05 | Enforce account-type separation in parity | Official and unofficial payments must never mix | Every parity report is bucketed by `resmi` and `gayri_resmi`; cross-account allocation is a hard mismatch |
| P0-06 | Enforce currency separation in parity | Mixed currency totals can produce false profitability | TRY/USD/EUR compare independently; base TRY appears only when exchange/base fields are valid |
| P0-07 | Add reversal/archive/canceled filters to parity fixtures | Active totals must exclude inactive events | Reversed, canceled, legacy `İptal`, and archived rows do not affect active metric totals |
| P0-08 | Expose unresolved legacy expense rows | Legacy expenses lack account type and supplier identity | Unresolved rows are counted in a separate debt bucket and excluded from authoritative totals |

## P1 - Required For Production-Safe Cards

| ID | Backlog Item | Reason | Acceptance Criteria |
| --- | --- | --- | --- |
| P1-01 | Build customer card parity cases | Customer balance is highest-risk cashflow metric | Planned, realized, remaining, overdue, official, unofficial, and unallocated collections reconcile to formula catalog |
| P1-02 | Build project profitability parity cases | Realized net and forecast profit are currently easy to conflate | Project card reports realized income, realized expense, remaining receivable, remaining payable, realized net cash, and forecast completion profit separately |
| P1-03 | Build personnel card parity cases | Personnel paid state must not be manual-only | Payroll planned, realized, remaining, overdue, project allocation, and account split reconcile |
| P1-04 | Build supplier/vendor parity cases | Supplier identity and expense category are currently conflated | Supplier payable, realized payment, material/service breakdown, project allocation, and account split reconcile |
| P1-05 | Normalize category mapping fixtures | Free-form categories cannot be authoritative | Required category codes map deterministically; unmapped categories report as unresolved |
| P1-06 | Add current UI/API output adapters | Parity needs to compare against existing behavior without changing it | Current customer/project/personnel/supplier/category outputs can be normalized into parity snapshots |
| P1-07 | Add drill-down row provenance to parity output | Totals must be explainable | Each metric can list included, excluded, duplicate-risk, and unresolved source rows |

## P2 - Hardening Before Cutover Planning

| ID | Backlog Item | Reason | Acceptance Criteria |
| --- | --- | --- | --- |
| P2-01 | Add base-currency validation fixtures | Foreign-currency profitability needs explicit conversion proof | Base totals fail closed when `base_amount` or `exchange_rate` is missing/invalid |
| P2-02 | Add deleted/archived owner fixtures | Historical cards must not lose identity | Archived entities are excluded from active totals but retained in audit drill-down |
| P2-03 | Add report/dashboard parity snapshots | Dashboards and reports must match cards | Dashboard/report totals reconcile to the same backend formulas as card totals |
| P2-04 | Add hosting-side isolated parity run plan | DB-dependent verification must run server-side when needed | Plan uses `public_html/api/config.php` path and isolated fixtures only; no local `localhost` DB proof |
| P2-05 | Add precision/rounding fixtures | Over-allocation and partial payment are precision-sensitive | Currency precision rules are deterministic and reject over-allocation |

## Known Non-Blocking Debts For Phase 4G

These do not block Phase 4G specification parity work, but they block read cutover:

- Source identity uniqueness is not schema-enforced yet.
- Supplier/vendor master data remains conflated with expense-card concepts.
- Legacy expenses do not have authoritative account type or supplier identity.
- Runtime DDL remains present in some current request paths.
- Production hosting-side fixture parity has not been approved or run.
- Current UI/API behavior remains unchanged by design.

## Phase 4G Acceptance Criteria

Phase 4G can pass when:

- All Phase 4F formulas have executable parity fixtures.
- Customer, project, personnel, supplier/vendor, and category parity reports run locally against synthetic data without production DB access.
- Any hosting-side verification uses the approved server-side DB path and isolated fixtures only.
- No production data is written.
- No schema or migration code is introduced.
- No UI read path is cut over.
- Every mismatch is classified as amount, currency, account type, owner/project, status, duplicate/double-count risk, or unresolved legacy classification.
- Final Phase 4G report states whether Phase 4H can start.

## Final Decision

`READY_FOR_PHASE_4G`

Phase 4F produced the financial mathematics contract needed for Phase 4G parity implementation. This does not authorize production read cutover.

