Work only inside:

`C:\Users\Bediz\Documents\akinalinsaat.com`

The repository root already contains these two source files:

1. `AKINAL_ADMIN_FULL_E2E_QA_REPORT_2026-08-06_C.md`
2. `AKINAL_ADMIN_QA_FIX_TODO_2026-08-06_C.md`

Your task is to inspect the repository, verify the root cause of every finding in the QA report, implement the fixes locally, add regression coverage, update the TODO checklist with evidence, and create a final implementation report.

This is now a code-correction task, not another browser-only QA walkthrough.

## Read-first requirement

Before changing any code:

1. Read the complete QA report.
2. Read the complete TODO file.
3. Run `git status`.
4. Record all pre-existing modified/untracked files.
5. Do not overwrite or revert changes that were already present.
6. Inspect the actual frontend, PHP API, migrations, and calculation paths related to each finding.
7. Treat the report's root-cause notes as investigation leads, not as automatically proven facts.

## Strict safety and scope constraints

- Do not work outside the specified repository.
- Do not deploy.
- Do not connect to FTP or cPanel.
- Do not execute any production migration.
- Do not write to the production database.
- Do not create, edit, or delete live records.
- Do not change production credentials or protected configuration files.
- Do not modify `ak_profiles` or `ak_user_roles`, including their schema or behavior.
- Do not commit, push, or open a pull request.
- Do not perform unrelated refactors, package upgrades, broad redesigns, or formatting sweeps.
- Preserve existing correct financial behavior.
- Use the smallest coherent change set that fixes the verified causes.
- Never hard-code the QA example amounts as a solution.
- Do not mark an item complete without test or code-path evidence.

## Required implementation order

Work in this order because the first four findings block delivery:

### Phase 1 — Delivery blockers

1. BUG-01: employee roles, cost periods, project assignments, and allocations
2. BUG-02: Dashboard versus Net Durum date-scope mismatch
3. BUG-03: overpayment disappears from customer-detail KPI cards
4. BUG-04: Project Finance inflation-adjusted KPI and sign formatting

Finish root-cause analysis, implementation, and targeted regression coverage for these four before moving on.

### Phase 2 — Functional and financial consistency

5. BUG-05: overdue status missing from Project Finance income rows
6. BUG-06: incorrect media album/favorite counters
7. BUG-07: orphan notifications
8. BUG-08: inconsistent aggregate treatment of overpayments
9. BUG-09: partially paid balance missing from `YAKLAŞAN ÖDEME`

### Phase 3 — UX and form quality

10. BUG-10: replace native `window.confirm()` deletion dialogs
11. BUG-11: aggregate and field-level form validation
12. BUG-12: financial input autocomplete/input mode
13. BUG-13: inflation table labeling

## Mandatory shared financial rules

Do not solve BUG-02, BUG-03, BUG-08, and BUG-09 with unrelated page-specific patches. Use shared, testable rules.

### Actual collected income

- Actual collected income uses the full persisted `paid_amount`.
- Do not cap actual payment at the planned amount.
- Cash-based metrics described as realized “up to today” must apply an explicit date cutoff.
- Screens claiming the same metric and scope must use the same cutoff.

### Record and customer balance

- Record balance is `planned_amount - paid_amount`.
- A record or customer balance may be negative when there is an overpayment.
- Customer detail must preserve the real planned amount and the real paid amount.

### Aggregate outstanding receivable

- An overpayment must not hide another customer's open debt.
- Aggregate outstanding receivable must be calculated per record:
  `SUM(MAX(planned_amount - paid_amount, 0))`
- Actual collections still include the complete `paid_amount`.
- If an overpayment/advance aggregate is needed, calculate it separately:
  `SUM(MAX(paid_amount - planned_amount, 0))`
- Avoid adding a large new UI surface unless necessary, but keep overpayment visible at record/customer level.

### Upcoming payment

- Include future-dated records with a positive remaining balance.
- Include the remaining balance of partially paid records.
- Exclude fully paid and overpaid records.
- Preserve the existing upcoming-payment date window, but define it in one place.

## BUG-01 special instructions

The report shows missing employee tables in production and a maintenance migration that appears intended to create them. Do not execute that production migration.

You must:

- Inspect and validate the migration for idempotency and data safety.
- Inspect all affected GET and POST endpoints.
- Fix the contradictory `HTTP 200 + success:true + table_missing:true` behavior.
- Return a consistent, safe, machine-readable error when schema is unavailable.
- Separate frontend loading, empty, and error states.
- Add a visible retry action that sends a real new request.
- Remove the incorrect `employee-allocations.php` request/fallback and use the actual allocation endpoint.
- Verify CRUD behavior against a safe local/test schema if available.
- Verify that employee cost is not counted twice in project finance.
- Create a production migration runbook, but do not run it.

If production migration execution remains the only unresolved external step, report it explicitly rather than pretending BUG-01 is fully production-verified.

## Preserve documented non-bug scope differences

Do not accidentally merge metrics that intentionally cover different sources:

- Dashboard `Beklenen Tahsilat` covers customer receivables.
- Gelenler `Kalan Alacak` covers customer receivables plus government progress payments.
- Customers `Toplam Tahsilat` covers customer collections only.
- Dashboard/Net Durum total income also includes collected government progress payments.

If these distinctions remain intentional, improve labels or helper text where needed instead of changing the mathematics.

## Preserve the verified financial baseline

The QA report verified the demo project's financial core. Your changes must not break these values:

- Planned customer income: ₺1,400,000
- Actual customer income: ₺620,000
- Planned government progress payment: ₺300,000
- Actual government progress payment: ₺90,000
- Total planned income: ₺1,700,000
- Total actual income: ₺710,000
- Remaining receivable: ₺990,000
- Planned expense: ₺860,000
- Actual expense: ₺475,000
- Remaining expense: ₺385,000
- Actual net profit: ₺235,000

Also preserve:

- partial-payment behavior,
- date persistence,
- runtime overdue calculation,
- 30/30/30/10 progress-payment totals,
- project/customer/supplier relationships,
- cascade deletion behavior,
- project-filtered expense KPIs,
- existing foreign-currency conversion behavior.

## Implementation method

For every bug:

1. Locate all relevant frontend and backend code.
2. Explain the verified root cause briefly in your working notes.
3. Identify whether the logic is duplicated elsewhere.
4. Prefer a shared helper/query/calculation when multiple screens use the same business metric.
5. Implement the smallest coherent correction.
6. Add or update regression tests.
7. Run the narrowest relevant tests immediately.
8. Then run the broader validation commands.
9. Update the corresponding TODO checkboxes only after evidence exists.

Do not guess filenames. Use repository search to locate the exact implementations.

## Testing requirements

Discover and use the repository's existing scripts. At minimum, run all applicable checks:

- TypeScript type-check
- lint
- unit tests
- integration/API tests
- production build
- PHP syntax checks for changed PHP files
- existing project QA/regression scripts

Where coverage is missing, add focused tests for the affected calculation or API behavior.

Required financial edge cases include:

- no payment,
- partial payment,
- full payment,
- overpayment,
- past date,
- today,
- future date,
- month/year boundaries,
- deletion and recalculation,
- multiple customers where one has an overpayment,
- partially paid upcoming payment,
- missing inflation data,
- positive/negative/zero inflation difference display.

Do not use production data for tests.

## Required output files

Update:

`AKINAL_ADMIN_QA_FIX_TODO_2026-08-06_C.md`

Create:

`AKINAL_ADMIN_QA_FIX_IMPLEMENTATION_REPORT_2026-08-06_C.md`

The implementation report must be in Turkish and contain:

1. Summary
2. Initial repository state
3. Changed files
4. Verified root cause for each BUG-01 through BUG-13
5. Implemented change for each bug
6. Tests added or changed
7. Commands executed and exact results
8. Remaining blocked or unverified items
9. Production migration runbook for employee tables
10. Known risks
11. Deployment prerequisites
12. Final recommendation

## Final response format

At the end, provide:

- changed files,
- bugs fixed,
- tests/build results,
- anything still blocked,
- manual production steps required,
- confirmation that no deploy, production migration, commit, or push was performed.

Do not claim PASS merely because the code compiles. A finding is complete only when its business behavior is covered by a test or a safely reproducible local verification.
