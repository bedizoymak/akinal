# Phase 3A — Canonical Decision Lock and Read-Only Reconciliation Inventory

Audit design date: 14 June 2026

## Executive Summary

- **What this phase checks:** The inventory measures row volumes, probable duplicates, missing ownership/project attribution, invalid account and currency values, unsupported manual settlement evidence, cheque/senet maturity quality, project-profitability gaps, and finance-history deletion risks.
- **What it does not change:** It does not alter schema, application behavior, UI, credentials, or database records. It does not declare probable matches to be confirmed duplicates and does not repair any anomaly.
- **Phase 3B readiness:** Not yet established. Phase 3B additive schema is conditionally available only after this inventory is run against a staging copy or verified backup, every result set is exported, and all Blocker findings are either reduced to zero or covered by an approved migration policy.

The current schema has no canonical settlement table and no source identity linking `ak_payments` or `ak_expenses` to `ak_financial_entries`. Matching queries therefore produce reconciliation candidates, not accounting proof.

## Locked Accounting Decisions

The following decisions are approved inputs to all later migration work:

1. `ak_financial_entries` is the canonical ledger.
2. `ak_payment_plans` is the canonical schedule and obligation table.
3. `ak_payments` and `ak_expenses` are legacy operational sources. They remain preserved for migration provenance but must not remain independent accounting sources after cutover.
4. TRY is the base reporting currency.
5. Supported transaction currencies are TRY, USD, and EUR.
6. A cheque or promissory note becomes realized cash only when cleared/paid at maturity. Issuance or receipt alone is not realized cash.
7. Manual `paid_amount` or a manually selected paid status is not valid accounting evidence after migration.
8. Plan settlement must be represented by persisted canonical settlement records.
9. Resmi and Gayri Resmi settlements must never cross.
10. Project attribution is required unless the event is explicitly classified as `company_overhead`.
11. Posted canonical ledger entries are immutable and must not be hard-deleted. Corrections require reversal or an auditable adjustment.
12. Customer FIFO allocation may remain only when the allocation result is persisted as settlement rows.
13. An expense card currently represents a supplier plus expense-account hybrid. Phase 3B must preserve this behavior while making its canonical counterparty classification explicit.

These decisions supersede conflicting legacy behavior during migration design. They do not change current runtime behavior in Phase 3A.

## SQL Inventory File

Read-only inventory:

`docs/sql/phase_3a_reconciliation_inventory.sql`

The file targets the current pre-migration schema defined by `public_html/install-schema.php`. It contains only read operations and emits independent result sets labeled A01 through J05.

Because canonical provenance and settlement fields do not exist yet:

- Duplicate reports use conservative matching criteria and must be manually reviewed.
- Personnel/supplier paid-plan reports can only search for probable ledger counterparts.
- Planned obligation matches do not prove that a ledger row mirrors a payment plan.
- Amounts are not converted. Legacy payments and expenses are treated as implicit TRY, while ledger amounts remain grouped by `currency_tag`.

## How To Run Safely

1. Record the deployed application commit and database schema version.
2. Verify that a restorable database backup exists before any production read.
3. Run the SQL against a staging clone or fresh backup first.
4. Use a database account limited to read access where operationally possible.
5. Run each labeled result set separately if the SQL client cannot retain multiple result grids.
6. Export each result set with its label, execution date, environment, and database identifier.
7. Review query duration and server load on staging before running against production.
8. Never add destructive or data-changing statements to this inventory file.
9. Do not “fix while reviewing.” Record anomalies and address them only in an approved cleanup/migration phase.
10. Keep exports outside Git when they contain names, identifiers, notes, financial values, or other sensitive production data.

Production execution is a manual operational step. This repository phase does not connect to or read production data.

## Expected Result Sets

| ID | Area | Expected output |
|---|---|---|
| A01 | Core counts | Row counts for plans, payments, expenses, and ledger entries |
| A02 | Plan ownership | Plan count/amount by customer, employee, expense card, missing owner, or multiple owners |
| A03 | Plan status | Count and amount by stored plan status |
| A04 | Ledger distribution | Count and amount by direction, status, group, and currency |
| A05 | Project linkage | Linked/unlinked count and amount for every finance source |
| B01-B02 | Collection duplicates | Probable payment/ledger pairs and ambiguous multi-match payments |
| B03-B04 | Expense duplicates | Probable expense/ledger pairs and ambiguous multi-match expenses |
| B05 | Obligation duplicates | Probable plan/planned-ledger pairs |
| C01-C04 | Missing project | Unlinked plans, payments, expenses, and ledger rows |
| C05 | Project conflict | Explicit payment-plan links with different projects |
| C06-C07 | Inferable project risk | Customer-owned entries/payments lacking project despite customer-project relationships |
| D01 | Plan owner validity | Plans with zero or multiple owners |
| D02 | Ledger owner validity | Ledger rows inconsistent with `card_type` |
| D03 | Orphan references | Missing master/project/plan references |
| E01 | Account validity | Null or invalid plan/payment account and ledger group values |
| E02 | Legacy assumption | Count/amount currently forced into Resmi TRY treatment |
| E03 | Account conflict | Explicit payment-plan links crossing account type |
| F01 | Currency validity | Null or unsupported ledger currency |
| F02-F03 | Mixed currency | Projects and owners containing multiple transaction currencies |
| G01 | Manual paid | Plans containing manual paid amount |
| G02 | Paid without link | Paid plans with no explicitly linked legacy payment |
| G03 | Overdue partial | Past-due partial plans with remaining manual amount |
| G04 | Payable evidence | Personnel/supplier paid plans with no probable realized ledger payment |
| H01 | Maturity summary | Cheque/senet count and amount by maturity state |
| H02 | Maturity mismatch | Method and maturity-field inconsistencies |
| H03 | Manual maturity settlement | Matured instruments marked paid without explicit customer payment |
| I01 | Profitability coverage | Linked/unlinked realized inventory by source, direction, and currency |
| I02 | Project inventory | Per-project realized amount without cross-source deduplication |
| I03 | Missing project cash | Project-linked customer plans with no same-project realized payment |
| I04-I05 | Overhead candidates | Unlinked legacy and ledger expenses requiring classification |
| J01 | Detachment | Finance rows already missing owner or project context |
| J02-J05 | Archive protection | Masters/projects with finance history |

An empty anomaly result is desirable but must still be logged as zero. Summary result sets are informational and are not expected to be empty.

## How To Interpret Results

### OK

- An anomaly result set returns zero rows.
- Counts and totals reconcile to independently recorded source totals.
- A mixed-currency result reflects intentional transactions and no direct cross-currency sum is used.
- A project-null expense is confirmed and documented as company overhead.

### Warning

- A probable duplicate has one plausible match but no canonical source identity.
- A project or owner uses multiple supported currencies.
- A legacy expense requires the known Resmi/TRY migration assumption.
- A master with finance history is active and will need archive protection in Phase 3B.
- A finance row lacks a project but has a clearly documented overhead purpose.

Warnings require classification, provenance, and migration treatment. They do not necessarily block additive schema.

### Blocker

- Orphan or contradictory ownership.
- Zero/multiple plan owners.
- Explicit payment-plan project or account mismatch.
- Unsupported/null currency or account classification.
- A paid/partially paid plan has no defensible realized transaction or approved opening-settlement treatment.
- Probable duplicate matching is ambiguous because one source row has multiple candidates.
- A material number or amount of project-attributable records cannot be linked to a project.
- Existing records would violate Phase 3B constraints or cannot be preserved without loss.

Blockers prevent migration writes and reporting cutover. Additive nullable columns may be technically deployable, but should not be treated as migration readiness.

### Manual review required

- Every probable duplicate pair.
- Every manual paid plan.
- Every cheque/senet record marked paid under the old evidence model.
- Every company-overhead candidate.
- Every null project that could map to more than one customer project.
- Every historical account/currency default whose original provenance is unknown.

The reviewer must not infer accounting truth from amount/date similarity alone.

## Phase 3B Readiness Criteria

Phase 3B additive schema may proceed only when all conditions below are recorded:

1. A complete run log exists for A01-J05 on a representative staging copy.
2. **Zero destructive anomalies:** D01, D02, D03, E01, E03, and F01 return zero unresolved rows.
3. **Zero unresolved cross-account conflicts:** no settlement candidate crosses Resmi/Gayri Resmi.
4. **Zero unresolved explicit project conflicts:** C05 returns zero unresolved rows.
5. **Zero unresolved ambiguous duplicates:** every B02/B04 row has an approved manual classification before any canonical migration write.
6. **Manual paid coverage is complete:** every G01/G02/G04/H03 row has one approved treatment: existing transaction match, migration opening settlement, reversal/correction requirement, or explicitly excluded invalid state.
7. **Project scope is classified:** every active null-project finance row is assigned a proposed project, classified as `company_overhead`, or recorded as a migration blocker.
8. **Currency policy is executable:** all ledger currencies are supported and no mixed-currency total is accepted without stored conversion data in Phase 3B.
9. **Duplicate exposure is quantified:** B01/B03/B05 candidate counts and amounts are signed off, including false-positive rules.
10. **Archive protection scope is known:** all masters returned by J02-J05 are covered by the Phase 3B archive/deletion contract.
11. Backup restore has been tested in the target staging environment.
12. The exact schema migration and rollback plan has been reviewed without changing existing finance values.

Acceptable warnings:

- Supported mixed currencies, provided reporting remains currency-separated until conversion fields exist.
- Legacy expense Resmi/TRY assumptions, provided every affected row receives explicit migration provenance.
- Confirmed company overhead, provided it is classified explicitly.
- Unique probable matches, provided they remain review candidates until source identity is persisted.

Any unresolved Blocker result means Phase 3B is **not ready**.

## Reconciliation Run Log Template

Use one row per exported result set. Store detailed sensitive exports outside Git.

| Run date | Environment | Database | Result set | Row count | Amount total | Severity | Action |
|---|---|---|---|---:|---:|---|---|
| YYYY-MM-DD HH:MM TZ | staging/production | redacted identifier | A01 |  |  | OK/Warning/Blocker/Manual review |  |
|  |  |  | A02 |  |  |  |  |
|  |  |  | B01 |  |  |  |  |
|  |  |  | C01 |  |  |  |  |
|  |  |  | D01 |  |  |  |  |
|  |  |  | E01 |  |  |  |  |
|  |  |  | F01 |  |  |  |  |
|  |  |  | G01 |  |  |  |  |
|  |  |  | H01 |  |  |  |  |
|  |  |  | I01 |  |  |  |  |
|  |  |  | J01 |  |  |  |  |

Add rows until every result set A01-J05 is represented. For multi-currency outputs, record amount totals separately per currency rather than combining them.

## P0 Blockers To Look For

1. Legacy and ledger rows that appear to represent the same material transaction, especially multi-match ambiguity.
2. Paid customer, personnel, or supplier plans without traceable realized cash evidence.
3. Plans or ledger entries with invalid/missing owners.
4. Orphan references caused by missing foreign keys or previous `SET NULL` behavior.
5. Explicitly linked payments whose project or account differs from the plan.
6. Unsupported currencies or invalid Resmi/Gayri Resmi classifications.
7. Material project income or expense that cannot be attributed to a project or approved overhead.
8. Cheque/senet records treated as realized cash before cleared/paid maturity.
9. Finance history attached to masters that current hard-delete behavior could detach or erase.

## P1 Risks To Look For

1. High volumes of unique probable duplicates that still require manual confirmation.
2. Legacy expenses whose Resmi/TRY assumption may be wrong.
3. Customer records linked to multiple projects while payments/entries have null project.
4. Free-text categories or titles that make duplicate matching unreliable.
5. Mixed supported currencies without historical exchange rates.
6. Planned ledger entries that duplicate plan obligations.
7. Partial overdue plans whose remaining balance is understated by current reports.
8. Null-project expense rows that mix valid overhead with missing project attribution.
9. Large result sets or slow joins indicating that Phase 3B needs reconciliation indexes and batched tooling.

## Recommended Phase 3B

Proceed with **Phase 3B — Additive Canonical Schema and Constraint Foundation** only after the readiness criteria are met.

Phase 3B should:

1. Add canonical identity, provenance, event type, account, currency/base amount, project scope, archive, reversal, and audit fields without removing legacy columns.
2. Add `ak_payment_plan_settlements` with plan/ledger references, allocation amount, currency, reversal metadata, and uniqueness protection.
3. Add missing owner foreign keys only after D03 is clean.
4. Keep new constraints initially compatible with classified legacy rows; tighten them after migration reconciliation.
5. Protect posted ledger history and finance-linked masters from hard deletion.
6. Include versioned forward and rollback SQL tested on a disposable MySQL database.
7. Make no reporting or write-path cutover in the additive-schema phase.

## Validation

- `npm run build`: passed. Vite 5.4.21 transformed 2,637 modules and completed the production build in 16.70 seconds.
- `npm run test`: passed. Vitest 3.2.6 reported 2 test files passed and 6 tests passed.
- `php -l` for all `public_html` PHP files: passed. All 48 PHP files completed syntax validation successfully.
- SQL safety review: passed. All 43 statements begin with an allowed read operation; zero forbidden data/schema-changing keywords were found outside comments.
- Database execution: Manual verification required. No staging or production database credentials/data were accessed in this phase.
- This phase changes documentation and read-only reconciliation tooling only.
