# Phase 4G - Remaining Gaps

**Date:** 2026-06-15  
**Scope:** Gaps after read-model parity remediation  
**Decision:** `READY_FOR_PHASE_4H` with cutover gates still required

## Remaining Cutover Gaps

These gaps do not block starting Phase 4H planning, but they do block immediate production read cutover.

| Gap | Impact | Required Next Action |
| --- | --- | --- |
| Backend read endpoints still return legacy-shaped aggregate data | Dashboard/report/card totals can still differ until endpoints are moved to the shared contract | Phase 4H must create or adapt backend read endpoints around the canonical read-model contract |
| Legacy customer FIFO/manual-paid helpers still exist for compatibility screens | Current UI can still display manual/FIFO-derived paid values in some legacy contexts | Phase 4H must decide which screens cut over to settlement-backed paid state and which remain audit-only |
| Legacy expenses lack account type and supplier identity | Supplier/category profitability cannot be fully authoritative for old expense rows | Keep unresolved legacy rows out of authoritative totals until classified |
| Supplier/vendor master remains conflated with expense-card identity | Supplier cards and category cards can still overlap conceptually | Define supplier identity cutover before final production read activation |
| Duplicate source identity is not schema-enforced | Parity can detect duplicate risk, but database cannot yet prevent all duplicates | Add approved uniqueness constraints in a separate schema-hardening phase |
| Runtime DDL remains in existing PHP request paths | Production request behavior can still alter schema opportunistically | Remove runtime DDL before production cutover |
| Lint is not clean project-wide | CI cannot use `npm run lint` as a clean gate yet | Clean existing `any` and hook-dependency lint debt or scope lint gate to changed files |
| Hosting-side isolated read-model parity has not been run | Local synthetic tests prove math, not production data classification | If DB verification is needed, run server-side through the approved hosting/config.php path only |

## Phase 4H Must Include

1. Backend read-model endpoint ownership for customer, project, personnel, supplier, and category cards.
2. One as-of-date per response.
3. One authoritative currency/account/project/owner/category filter contract.
4. Drill-down provenance for included, excluded, duplicate-risk, and unresolved rows.
5. Production-safe feature flag or route-level switch for read cutover.
6. Read-only parity report using hosting-side execution if production DB verification is needed.
7. Explicit decision on legacy manual/FIFO allocation display.
8. Explicit exclusion of unresolved legacy expenses from authoritative supplier/category profitability.
9. Rollback path to current read behavior.

## Not Done In Phase 4G

- No production DB parity run.
- No migrations.
- No source identity uniqueness constraint.
- No canonical write activation.
- No canonical settlement feature flag activation.
- No production data writes.
- No full backend read endpoint cutover.

## Validation Debt

`npm run lint` currently fails on existing project-wide lint issues unrelated to this phase, including:

- `@typescript-eslint/no-explicit-any` across existing admin pages and finance helpers;
- React hook dependency warnings;
- fast-refresh warnings in shared UI component files.

Phase 4G validation instead passed:

- unit/parity tests;
- TypeScript compile;
- production build;
- PHP canonical parity harness;
- PHP shadow-write harness.

## Final Decision

`READY_FOR_PHASE_4H`

The shared read-model math and parity fixtures are in place. Phase 4H should focus on controlled backend read cutover and production-safe parity approval, not migrations or write activation.

