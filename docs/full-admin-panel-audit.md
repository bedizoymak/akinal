# Audit Scope

- Audited 38 React routes, including the protected `/admin` tree and 24 active/redirected admin paths in `src/App.tsx`.
- Inspected 22 admin page modules, 9 shared admin components, finance helpers/types/API client code, and 33 PHP files under `public_html/api/admin`.
- Reviewed authentication/session enforcement, CRUD behavior, dashboard/report totals, customer/personnel/supplier finance flows, account-type isolation, media/upload handling, notifications, settings, SQL tools, deployment helpers, responsive structures, Turkish UI text, and failure/empty states.
- Checked MySQL installer compatibility, runtime schema mutations, foreign-key deletion behavior, tracked/ignored configuration, upload execution protection, dependency advisories, lint status, tests, and production bundle output.
- The repository builds successfully. The authenticated production data flows were not mutated during the audit.
- Browser-level authenticated CRUD and mobile testing could not be completed without production credentials and disposable fixture data. Responsive findings are therefore based on component/CSS inspection and build output, not destructive production interaction.

# Critical Issues

1. **Backend authorization trusted any session user, not the admin role. Fixed.**
   - `public_html/api/auth.php` previously accepted any session containing an ID.
   - The React guard checked `role === "admin"`, but direct PHP API calls bypassed that client-only check.
   - The server now requires the `admin` role and revalidates the current account against `ak_admin_users` on every protected request, including `is_active`.

2. **No unresolved Critical issue remains after the safe fixes in this audit.**
   - The remaining security and accounting items below are High priority because they require deployment coordination or an explicit business rule.

# High Priority Issues

1. **Payment allocation is global FIFO and ignores explicit payment-plan links. Not fixed.**
   - `src/lib/finance.ts` `allocateCollectionsToPlans()` totals all scoped collections and allocates them by due date.
   - `public_html/api/admin/payment-plans.php` and `payments.php` repeat the same customer/account FIFO behavior.
   - A collection linked to one plan can therefore influence another earlier plan. This may be intentional account-level allocation, but changing it without an accounting decision could rewrite historical balances.

2. **Legacy tables and the financial ledger can double-count the same business event. Not fixed.**
   - Dashboard, finance, and reports combine `ak_payments` / `ak_expenses` with `ak_financial_entries`.
   - If users record one transaction in both systems, totals, charts, and PDFs count both rows.
   - A source-of-truth/migration rule is required before deduplication can be implemented safely.

3. **The protected SQL Editor remains an unrestricted database console. Not fixed.**
   - `public_html/api/admin/sql-editor.php` permits INSERT/UPDATE/DELETE and schema operations after confirmation.
   - SELECT-like queries use `fetchAll()` without a row or execution-time limit.
   - SQL snippets are written to the server error log and may include confidential values.
   - This feature was explicitly enabled for administrators, so it was not disabled during this audit. Recommended: separate break-glass permission, IP restriction, row cap, timeout, and dedicated audit storage.

4. **No CSRF token framework exists for state-changing admin requests. Not fixed.**
   - Session cookies use `SameSite=Lax`, `HttpOnly`, and HTTPS-aware `Secure`, which reduces exposure.
   - POST/PATCH/DELETE endpoints do not validate a CSRF token or Origin/Referer.
   - A coordinated frontend/API rollout is required to avoid breaking all admin mutations.

5. **Production dependencies contain known advisories. Not fixed.**
   - `npm audit --omit=dev` reports 10 vulnerabilities: 7 High and 3 Moderate.
   - High findings include React Router open-redirect/XSS exposure plus lodash, glob, minimatch, and picomatch advisories.
   - Automated `npm audit fix` was not applied because dependency upgrades require route/export regression testing.

6. **Runtime DDL is performed during normal admin requests. Not fixed.**
   - Customer, payment-plan, payment, statement, and site-settings endpoints issue `SHOW COLUMNS` and `ALTER TABLE`.
   - This requires production ALTER privileges, can lock tables, and makes schema state depend on which page was opened first.
   - The installer was updated with current payment-plan columns, but existing runtime migrations should be replaced by versioned deployment migrations.

7. **Deletion rules can detach financial history. Not fixed where policy is unclear.**
   - Customer deletion can set payment plans, collections, expenses, documents, and ledger ownership to NULL through foreign keys.
   - Payment-plan deletion sets `ak_payments.payment_plan_id` to NULL, preserving money but removing its plan trace.
   - Personnel/supplier payment-plan owner columns have no foreign keys in existing installations. This audit now blocks deleting personnel/supplier cards that still have payment plans, but customer/history retention needs an explicit archive policy.

8. **Notification reminders do not use the same paid/remaining classification as detail cards. Not fixed.**
   - `public_html/api/admin/notifications.php` evaluates stored status and due date without combining `paid_amount` and linked collections.
   - Partial/manual payments can therefore generate misleading reminder records.
   - The correct fix depends on the unresolved allocation rule in item 1.

9. **Automated coverage is effectively absent. Not fixed.**
   - `npm run test` executes one placeholder test in `src/test/example.test.ts`.
   - Finance allocation, status transitions, account isolation, CRUD authorization, upload validation, and dashboard aggregates have no regression tests.

# Medium Priority Issues

1. **Admin bundle weight remains high.**
   - Production build output includes approximately 1,011 KB pdfmake, 855 KB pdfmake fonts, and 542 KB chart vendor chunks before gzip.
   - Routes are split, but first use of reports/charts/PDF exports remains costly on mobile or slow admin connections.

2. **Project image lifecycle can leave orphaned files.**
   - Deleting a project/gallery row through `project-images.php` removes the database row but not necessarily the uploaded file.
   - Uploading images for a new project before saving can also leave files if the user abandons the form.
   - Media cleanup needs reference counting or a scheduled orphan scanner.

3. **Several list/report APIs return complete tables without pagination.**
   - Finance summary, reports, customers, payments, expenses, and project endpoints load full datasets.
   - This is acceptable at small scale but will increase memory, response size, and render cost as records grow.

4. **Site settings have no recovery/create flow when the singleton row is missing.**
   - The admin page shows an error state, while the API only updates a supplied ID.
   - A controlled singleton bootstrap/upsert is needed.

5. **Project ordering under active filters was unsafe. Fixed.**
   - Drag indices came from filtered rows but were applied directly to the full array.
   - Reordering now moves only visible records while preserving hidden records, and rolls back on API failure.

6. **Missing-record routes could appear as infinite loading or editable blank records. Fixed.**
   - Customer detail and project edit now show explicit load/not-found errors.
   - Project, image, payment, expense, personnel, and supplier API updates/deletes now reject nonexistent IDs where changed.

7. **Upload limits were absent. Fixed.**
   - Project/media images now have a 10 MB limit, documents 15 MB, and site assets 2 MB.
   - `public_html/uploads/.htaccess` already disables script execution and directory listing.

8. **SVG site-asset upload allowed same-origin active content. Fixed.**
   - New site-asset uploads now allow ICO, PNG, and WEBP only.
   - Existing SVG references are not deleted; production should review any already-uploaded SVG files.

9. **Financial-entry API enum/ownership validation was incomplete. Fixed.**
   - Currency, group, direction, status, owner existence, date, and positive amount are now validated server-side.

10. **Fresh installer schema lagged behind runtime payment-plan fields. Fixed.**
    - `public_html/install-schema.php` now includes owner, partial-payment, method, cheque, and promissory-note columns used by current code.

# Low Priority Issues

1. **Lint debt is substantial.**
   - `npm run lint` reports 193 errors and 14 warnings, dominated by `any` types and hook dependency warnings.
   - This does not block `vite build`, but it weakens static guarantees in the most calculation-heavy modules.

2. **Some internal diagnostic exceptions remain English.**
   - Low-level push/signature errors are developer-facing. User-visible admin labels, media-source text, login errors, method errors, and the brand spelling touched in this audit were normalized to Turkish.

3. **Tracked `.env` policy needs guardrails.**
   - The tracked `.env` currently contains only a configured Turnstile site key, which is public by design.
   - `public_html/api/config.php` is correctly ignored. Future secrets must not be added to the tracked `.env`.

4. **Setup/import utilities remain deployed in the repository.**
   - Installer/import/admin-user scripts are disabled by constants and use placeholders.
   - `run-demo-import.php` additionally requires an admin session, feature flag, and token.
   - Production deployment should still exclude or delete these files to reduce accidental exposure.

5. **Authenticated mobile behavior needs a fixture-based visual pass.**
   - Tables generally use horizontal overflow or mobile cards, and grids have responsive breakpoints.
   - Dense finance charts, callout labels, long modal forms, and the project image editor remain the highest-risk small-screen areas.

# Fixes Applied

- Enforced server-side admin role and active-account validation for every protected endpoint.
- Localized admin authentication, method, media-source, demo-import, and brand-facing text.
- Corrected dashboard overdue/upcoming totals so aggregates are no longer limited to the first eight rows.
- Limited dashboard receivables to customer plans and included manual `paid_amount`.
- Changed the dashboard expected-collection card to the actual upcoming 30-day customer-plan total.
- Preserved `gayri_resmi` classification in dashboard movements, finance summary normalization, reports, and financial statements.
- Corrected customer-list paid totals to use the same account-separated/manual/partial logic as customer detail.
- Preserved manual partial amounts during collection-driven status synchronization.
- Added positive amount, ISO date, owner, enum, payment-method, and plan/customer/account consistency validation.
- Added transactional customer/project-link create/update behavior and deduplicated project IDs.
- Added clear frontend error feedback for tahsilat, gider, customer, project duplicate/delete, and ordering failures.
- Added missing-record handling for customer/project pages and changed CRUD endpoints.
- Prevented deletion of personnel/supplier cards with linked payment plans.
- Added upload size limits, removed new SVG site-asset uploads, and kept existing MIME checks.
- Added SQL Editor page metadata without adding a sidebar entry.
- Updated the installer with the current payment-plan schema.

# Issues Not Fixed And Why

- FIFO versus explicit-link collection allocation: requires an accounting decision and data migration plan.
- Legacy tables versus `ak_financial_entries`: requires a single source-of-truth and deduplication policy.
- Customer/payment-plan historical deletion behavior: requires archive and legal/accounting retention rules.
- CSRF tokens: requires coordinated frontend/API/session rollout and regression testing.
- SQL Editor restrictions: feature is intentionally enabled; hardening requires an operational access policy.
- Dependency upgrades: require route, PDF, chart, and build regression testing.
- Runtime DDL removal: requires versioned migration tooling and production rollout sequencing.
- Notification recalculation: depends on the final payment-allocation rule.
- Pagination: requires API contract and UI state changes across several modules.
- Full authenticated/mobile CRUD smoke test: no disposable authenticated dataset was available.

# Validation

- `npm run build` - passed.
- `npm run test` - passed, but only 1 placeholder test exists.
- `npm run lint` - failed with 193 errors and 14 warnings; documented above.
- `npm audit --omit=dev` - 10 advisories: 7 High, 3 Moderate.
- `php -l` - passed for every changed PHP file.
- `git diff --check` - passed; only repository line-ending notices were emitted.
- `public_html/uploads/.htaccess` - script execution and directory listing protections are present.
- Admin API protection scan - all protected endpoints call `require_admin()` directly or through `me.php`; logout remains intentionally idempotent.
- Authenticated browser smoke testing was not performed because the in-app browser was unavailable and production credentials/data were not used.

# Commit Hash

- The commit containing this report is identified by the Git message `Audit admin panel`; its hash is reported after commit because a commit cannot embed its own final hash.

# Full Diff

The complete patch is available in the commit. File-by-file scope:

| Area | Files | Change |
|---|---|---|
| Authentication | `public_html/api/auth.php`, `public_html/api/admin/login.php`, `public_html/api/response.php` | Server role/revocation checks and Turkish errors |
| Dashboard | `public_html/api/admin/dashboard.php`, `src/pages/admin/AdminDashboard.tsx`, `src/lib/apiTypes.ts` | Full aggregate totals, customer scoping, expected/overdue counts |
| Customer finance | `public_html/api/admin/customers.php`, `payment-plans.php`, `payments.php`, `src/pages/admin/AdminCustomers.tsx`, `AdminCustomerDetail.tsx` | Transactions, validation, paid/partial consistency, missing states |
| Finance/report | `public_html/api/admin/financial-statement.php`, `src/pages/admin/AdminFinance.tsx`, `AdminReports.tsx` | Account-type preservation and strict payload validation |
| Expenses/cards | `public_html/api/admin/expenses.php`, `employees.php`, `expense-cards.php`, `src/pages/admin/AdminExpenses.tsx` | Positive amounts, record checks, protected deletes, errors |
| Projects | `public_html/api/admin/projects.php`, `project-images.php`, `src/pages/admin/AdminProjects.tsx`, `AdminProjectEdit.tsx` | Missing records, filtered ordering, rollback, CRUD feedback |
| Upload/media | `media.php`, `media-upload.php`, all three document/image upload endpoints, `upload-site-asset.php`, `src/pages/admin/AdminSettings.tsx` | Limits, SVG block, Turkish labels |
| Admin UI | `src/components/admin/AdminLayout.tsx`, `AdminAuth.tsx`, `AdminCollections.tsx`, `AdminSettings.tsx` | Metadata, brand spelling, error handling |
| Deployment | `public_html/install-schema.php`, `run-demo-import.php`, `send-push-test.php` | Current schema and Turkish operational messages |

Patch size before this report: 39 source files, approximately 430 insertions and 148 deletions. No unrelated feature or visual redesign was introduced.
