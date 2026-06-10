# Second Pass Scope

- Rechecked the protected admin route tree, shared finance helpers, customer/personnel/supplier detail cards, dashboard, finance summary, reports, notification generation, deletion endpoints, media/project image lifecycle, authentication, schema setup, runtime migrations, response sizes, dependency advisories, and responsive finance layouts.
- Compared the same payment-plan records across detail cards, customer list totals, dashboard overdue/upcoming cards, finance charts, reports, PHP status synchronization, and reminder generation.
- Reviewed linked and unlinked tahsilat allocation, manual paid/partial states, overdue priority, Resmi/Gayri Resmi isolation, deletion traceability, API object existence checks, and previous-audit regressions.
- Started the local Vite application successfully. Authenticated browser CRUD and viewport testing could not be completed because no disposable credentials/data were available and the in-app browser surface was unavailable.

# Newly Found Critical Issues

1. **The finance summary contained a previous-audit regression that could break rendering when expenses existed. Fixed.**
   - The expense converter referenced an out-of-scope `payment.account_type`.
   - The payment converter simultaneously forced every legacy collection into the Resmi group.
   - Expenses now remain Resmi and collections preserve their own Resmi/Gayri Resmi classification.

2. **No unresolved newly found Critical issue remains after the verified fixes below.**

# Newly Found High Priority Issues

1. **Explicit payment-plan links were ignored by global FIFO allocation. Fixed.**
   - A collection linked to a later plan could pay an earlier plan instead.
   - Explicit `payment_plan_id` allocations now stay on that plan.
   - Only collections without a plan link use due-date FIFO, preserving the existing fallback behavior.
   - Allocation remains isolated by customer and `account_type`.

2. **Unlinked collections were discarded by customer/detail views. Fixed.**
   - Detail, list, finance, dashboard, and report calculations now include unlinked collections through the same scoped FIFO fallback.

3. **Payment reminders were not generated during normal frontend use. Fixed.**
   - The frontend never requested `generate=1`, so payment reminders could remain absent indefinitely.
   - Notification reads now trigger idempotent daily generation.
   - Fully covered, manually paid, partially paid, deleted, or no-longer-relevant generated reminders are removed instead of remaining as misleading active warnings.

4. **Deleting a payment plan could silently detach actual collections. Fixed.**
   - `ON DELETE SET NULL` preserved the money row but removed its plan trace.
   - Plan deletion now returns `409` while linked tahsilat records exist.

5. **Finance and report totals ignored manual partial amounts and could disagree with detail cards. Fixed.**
   - Manual Ödendi and Kısmi Ödendi amounts now participate in paid/remaining totals.
   - Customer reports, overdue reports, finance status charts, and dashboard overdue/upcoming calculations now use the same account-scoped classification.

6. **Personnel and supplier deletion checks ignored financial-ledger entries. Fixed.**
   - Existing payment-plan guards now also block deletion while `ak_financial_entries` still reference the record.

7. **Production dependency advisories were actionable without major upgrades. Fixed.**
   - Compatible lockfile updates patched React Router, PostCSS, lodash, glob/minimatch, picomatch, YAML, and related transitive packages.
   - `npm audit --omit=dev` now reports zero vulnerabilities.

# Newly Found Medium Priority Issues

1. **Allocation logic still exists in several frontend and PHP implementations.**
   - The implementations were aligned in this pass and frontend regression tests were added.
   - A shared backend service/module is still needed to prevent future drift.

2. **Generated reminder deduplication has a concurrency race.**
   - Two simultaneous generation requests can pass the read-before-insert check.
   - A database uniqueness rule or atomic insert strategy is required.

3. **Authenticated CRUD behavior remains unverified against disposable data.**
   - Static review and automated tests cannot prove transaction rollback, foreign-key behavior, upload permissions, or production session/cookie behavior end to end.

4. **Customer and project deletion can still detach historical finance records.**
   - Installer foreign keys use `ON DELETE SET NULL` for plans, collections, expenses, documents, and ledger entries.
   - Blocking, archiving, or anonymizing these deletions requires an explicit retention policy.

5. **Project image deletion and project deletion can leave orphaned files.**
   - `project-images.php` removes database rows without deleting the physical upload.
   - Project deletion cascades gallery rows but does not clean uploaded files.
   - Safe cleanup requires reference checks across gallery, cover, media, and site-setting usage.

6. **Large admin responses remain unpaginated.**
   - Reports, finance summary, payments, expenses, customers, and projects can return complete tables.
   - This will increase PHP memory, transfer size, and browser render cost as production data grows.

7. **Finance-heavy mobile pages rely heavily on horizontal scrolling.**
   - The layouts have responsive grids and overflow protection, but 760-1080 px tables and dense chart labels still need device-level authenticated QA.

# Newly Found Low Priority Issues

1. **Full dependency audit still reports two Moderate dev-only advisories.**
   - They originate from the Vite 5 development server/esbuild chain.
   - The available automatic fix requires a breaking Vite 8 upgrade; production dependencies are clean.

2. **Lint debt remains substantial.**
   - `npm run lint` reports 188 errors and 14 warnings, primarily existing `any` usage and hook dependency warnings.
   - The count improved from the previous audit, but broad typing cleanup was outside this pass.

3. **Large on-demand chunks remain.**
   - pdfmake is about 1,011 KB, pdfmake fonts 855 KB, and the chart chunk 399 KB before gzip.

4. **Several list hooks can present an empty state after an API failure without a dedicated retry/error surface.**
   - Reports are the clearest example; fixing this consistently should be a focused UX reliability task.

# Previous Audit Risks Rechecked

- Server-side admin role and active-user revalidation remains present on protected endpoints. Login and logout are the only intentionally unauthenticated admin PHP endpoints.
- CSRF tokens or strict same-origin mutation validation are still absent. `SameSite=Lax`, `HttpOnly`, and HTTPS-aware `Secure` cookies reduce but do not eliminate the risk.
- Legacy `ak_payments`/`ak_expenses` and `ak_financial_entries` can still double-count one business event. No deduplication was attempted without a source-of-truth decision.
- Seven admin API files still perform `SHOW COLUMNS` and/or `ALTER TABLE` during requests. Versioned deployment migrations remain necessary.
- SQL Editor remains a powerful administrator database console with the previously documented operational risks.
- Runtime list/report APIs still load full datasets; no contract-changing pagination was added.
- Media upload size/MIME protections and upload execution blocking remain intact.
- Resmi/Gayri Resmi isolation was rechecked in customer detail, customer list, finance conversion, reports, dashboard allocation, PHP status sync, and reminders.

# Fixes Applied

- Preserved collection account type and removed the finance expense conversion runtime error.
- Honored explicit plan links and retained scoped FIFO only for unlinked collections.
- Included unlinked collections consistently in customer/account calculations.
- Added manual paid/partial awareness to shared remaining calculations, finance charts, and reports.
- Aligned dashboard overdue/upcoming values with detail-card allocation and payment-priority rules.
- Enabled normal frontend reminder generation and removed obsolete generated reminders.
- Blocked payment-plan deletion while linked collections exist.
- Blocked personnel/supplier deletion while ledger entries exist.
- Added missing-record checks for financial-entry update/delete.
- Added five focused allocation/status regression tests.
- Applied compatible dependency security updates.

# Issues Not Fixed And Why

- Customer/project archive and deletion retention: legal/accounting policy is required.
- Legacy tables versus financial ledger: a migration and deduplication rule is required.
- Manual `paid_amount` versus actual tahsilat double-entry semantics: current `max(manual, collected)` behavior was preserved to avoid rewriting balances.
- CSRF framework: requires coordinated frontend/API rollout and session regression testing.
- Runtime DDL removal: requires versioned migration tooling and deployment sequencing.
- SQL Editor hardening: requires an operational break-glass access policy.
- Pagination: requires API contract and UI-state changes across multiple modules.
- Physical orphan cleanup: requires cross-reference checks and a scheduled cleanup strategy.
- Authenticated browser CRUD/mobile smoke test: no disposable authenticated environment was available.

# Manual QA Checklist

- Create Resmi and Gayri Resmi plans for one customer; verify no totals cross account tabs.
- Link a tahsilat to the later-dated plan; verify the earlier plan remains unpaid.
- Add an unlinked tahsilat; verify FIFO applies only within that customer/account.
- Test Ödendi, Kısmi Ödendi, Bekliyor, and Vadesi Geçti transitions in both directions.
- Verify partial paid rows stay out of overdue-colored cards/charts/reminders while remaining balance stays visible.
- Compare customer detail, customer list, dashboard, finance summary, customer report, and overdue report totals.
- Attempt to delete a plan with linked tahsilat; verify the clear validation error and preserved history.
- Attempt to delete personnel/supplier records with plans and with ledger entries.
- Generate notifications, then pay/edit/delete the plan and confirm obsolete reminders disappear.
- Test create/edit/delete rollback with invalid project/customer/owner IDs.
- Upload, replace, and delete project images; inspect both database rows and physical files.
- Test customer, personnel, supplier, finance, reports, and long modals at 360 px, 768 px, and desktop widths.
- Exercise session expiry, deactivated admin access, CSRF-origin scenarios, and concurrent reminder requests in staging.

# Validation

- `npm run build` - passed with Vite 5.4.21.
- `npm run test` - passed: 2 test files, 6 tests.
- `npm run lint` - failed with 188 errors and 14 warnings; existing debt documented above.
- `npm audit --omit=dev` - passed with 0 vulnerabilities.
- Full `npm audit` - 2 Moderate dev-only advisories; fixing them requires a breaking Vite upgrade.
- `php -l` - passed for all 7 changed PHP files.
- `git diff --check` - passed; only line-ending notices were emitted.
- Local Vite server startup - passed.
- Authenticated browser CRUD/mobile validation - not completed due unavailable browser surface and disposable credentials/data.

# Commit Hash

- The commit containing this report is identified by the Git message `Second pass admin panel audit`; the final hash is reported after commit because a commit cannot contain its own final hash.

# Full Diff

| Area | Files | Change |
|---|---|---|
| Allocation core | `src/lib/finance.ts`, `payment-plans.php`, `payments.php` | Explicit-link allocation, unlinked FIFO fallback, manual paid/partial consistency |
| Customer/detail parity | `AdminCustomerDetail.tsx`, `AdminCustomers.tsx`, `FinancialStatementPage.tsx` | Include scoped unlinked collections and preserve account isolation |
| Dashboard/finance/reports | `dashboard.php`, `AdminFinance.tsx`, `AdminReports.tsx` | Unified paid/remaining/overdue totals and account tags |
| Notifications | `notifications.php`, `apiClient.ts` | Generate during normal reads, use current plan state, remove obsolete reminders |
| History protection | `payment-plans.php`, `employees.php`, `expense-cards.php`, `financial-statement.php` | Block destructive detachment and add missing-record checks |
| Tests | `src/test/finance-allocation.test.ts` | Five linked/unlinked/manual/status regression tests |
| Dependencies | `package-lock.json` | Compatible security updates; no major framework upgrade |

The complete patch is contained in the commit. No visual redesign, route removal, API contract redesign, or speculative accounting migration was introduced.
