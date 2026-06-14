# Akınal İnşaat Full Production Go-Live Audit

Audit date: 14 June 2026

## Executive Summary

- **Go-live status: NO-GO**
- **Estimated readiness: 72%**
- Main blockers:
  - No authenticated staging/production smoke test has verified login, session persistence, CRUD, finance transitions, uploads, deletion behavior, and mobile layouts against the deployed PHP/MySQL environment.
  - CSRF protection or strict same-origin mutation validation is absent from authenticated state-changing APIs.
  - The administrator SQL editor is enabled in the current local deployment configuration and permits unrestricted data/schema changes without row caps, execution timeout, separate break-glass permission, or durable audit storage.
  - Deployment parity is unproven: there is no CI workflow, no checked deployment manifest, and no evidence in this audit that the current `main`, built assets, PHP files, schema, upload rules, and server configuration are all live together.
- Main risks:
  - Normal requests still execute `SHOW COLUMNS` and `ALTER TABLE`.
  - Customer/project hard deletion can detach or erase business context; no approved archive/retention policy exists.
  - Some upload deletion paths can leave orphan files, while abandoned uploads can remain unreferenced.
  - Major list/report APIs are unpaginated and fetch complete tables.
  - Legacy payment/expense tables and the unified financial ledger can double-count a business event if both are used.
  - Lint fails with 188 errors and 15 warnings; automated coverage is limited to six tests, five of which cover finance allocation/status helpers.

The project builds, tests, and passes PHP syntax validation. Production npm dependencies have no known audit findings. Server-side administrator role/active-user validation, upload MIME/size controls, upload execution blocking, payment allocation fixes, manual/partial paid behavior, account isolation, reminder cleanup, and destructive finance guards remain present. These are meaningful improvements, but they do not replace deployed authenticated verification.

## Sources Reviewed

- **Markdown files:** 108 files under `docs/*.md`, reviewed newest to oldest. Reports were treated as claims and checked against current source.
- **Commit history:** repository history from `c50d4b1` (1 January 2025 template commit) through local `main` at `faf0a00` (11 June 2026), with detailed review focused on the PHP/MySQL migration and production work from `4bfdb2a` (29 May 2026) through `faf0a00`. Local `main` was one commit ahead of `origin/main` during the audit.
- **Source areas:** package/lock files, Vite/TypeScript/ESLint/Vitest configuration, route/auth hooks, API client/types, finance helpers/tests, all admin pages/components, public pages and forms, all 48 PHP files under `public_html`, installer/import/setup tools, upload rules, deployment scripts, and repository workflow configuration.
- **GitHub Actions:** no `.github/workflows` directory exists.
- **Manual production access:** not available. Authenticated and data-mutating production checks are marked **Manual verification required**.

## Timeline From Markdown Files

Newest to oldest, consolidated to avoid repeating one report per small commit:

- **10 June 2026 - second admin audit:** fixed explicit-plan allocation, unlinked FIFO handling, manual paid/partial consistency, finance/report parity, reminder generation/cleanup, plan deletion guards, missing-record checks, and dependency advisories. It left CSRF, runtime DDL, SQL editor hardening, pagination, archive policy, orphan cleanup, duplicate finance sources, and authenticated/mobile QA open. Current source confirms that these open items remain.
- **9 June 2026 - first admin audit:** added server-side role and active-user revalidation, API existence checks, deletion guards, upload limits, error surfaces, and account-type corrections. The later allocation/reminder regressions documented in that report were fixed on 10 June and remain covered by focused tests.
- **4 June 2026 - finance correction series:** repeatedly revised payment allocation, manual/partial status, paid amount consistency, Resmi/Gayri Resmi isolation, customer/personnel/supplier parity, charts, account summaries, payment method/maturity fields, and plan deletion UX. Current source preserves the explicit-link plus scoped-unlinked-FIFO model and account isolation. The density of successive corrections shows historically high regression risk.
- **3 June 2026 - launch polish and SQL editor:** added launch-readiness work, content UX, reports/PDF changes, market data, navigation, and the protected SQL editor. The editor was later explicitly enabled and is still enabled in local configuration.
- **1 June 2026 - structured admin QA:** six QA phases addressed dashboard/finance cards, charts, expenses, PDFs, project location, quick-create flows, personnel labels, Turnstile cleanup, and a reusable admin blueprint. These were mostly static/build-level corrections; deployed authenticated proof remains absent.
- **30-31 May 2026 - Supabase-to-PHP/MySQL migration:** introduced the MySQL installer, PHP API, public/admin migrations, auth, contact/cookie flows, import utilities, media handling, web push, favicon/settings, and production-readiness reports. Turnstile was removed and restored across several commits before the current protected contact flow. Setup/import tools are now disabled in source, but remain web-root files and should not be deployed after setup.
- **Earlier May 2026 - initial public/admin/CRM/finance implementation:** established the React site, Supabase-era admin, CRM, finance, notifications, reports, settings, SEO, chatbot, and project import/export. Later reports correctly identify this period as the origin of duplicated finance models and migration complexity.

### Repeated or regressed themes

- Finance status/allocation logic was corrected across many consecutive commits and once regressed in the finance summary before the second audit. Current focused tests reduce, but do not eliminate, this risk because PHP aggregate endpoints and UI workflows are not integration-tested.
- Turnstile was removed, restored, debugged, and CSP-adjusted repeatedly. Current backend verification is present, but production keys, hostname behavior, CSP, and successful submission require manual verification.
- Project publication, media handling, dashboard totals, and account isolation received multiple follow-up fixes, indicating that deployed smoke tests should explicitly cover them.
- Previous reports consistently listed CSRF, runtime DDL, SQL editor hardening, pagination, archive policy, orphan cleanup, and authenticated/mobile QA. Current source confirms these are documented but not fixed.

## Validation Results

### `npm ci`

- Passed.
- Installed 536 packages and audited 537 packages.
- Reported 2 vulnerabilities: 1 moderate and 1 high, both in the development Vite/esbuild chain.

### `npm run build`

- Passed with Vite 5.4.21.
- 2,637 modules transformed.
- Largest chunks before gzip:
  - `vendor-pdfmake`: 1,010.83 kB
  - `vendor-pdfmake-fonts`: 855.07 kB
  - `vendor-charts`: 398.71 kB
- Build completion: 23.32 seconds.

### `npm run test`

- Passed: 2 test files, 6 tests.
- Coverage consists of one placeholder test and five finance allocation/status tests.
- No API, authentication, CRUD, upload, contact, cookie, route, or browser integration tests exist.

### `npm run lint`

- Failed: **188 errors and 15 warnings**.
- Errors are primarily `@typescript-eslint/no-explicit-any`, plus empty catch blocks in the contact page.
- Warnings include missing hook dependencies and Fast Refresh export structure.
- This is established debt, but the failing release command means the repository does not have a clean static-validation gate.

### `npm audit`

- Failed with 2 findings: 1 moderate and 1 high in `esbuild` through Vite.
- The automatic remediation proposes Vite 8.0.16, a breaking upgrade.
- The advisory primarily concerns development-server exposure and package integrity, not the built production bundle, but developer/CI environments should not expose Vite publicly.

### `npm audit --omit=dev`

- Passed: **0 vulnerabilities**.

### `php -l`

- Passed for all **48 PHP files** under `public_html`.
- PHP emitted one deprecation warning: `verify_turnstile_token()` implicitly marks its by-reference `$details` parameter nullable in `api/contact-request.php`.

### Other validation

- `git diff --check`: passed.
- Upload execution protection exists in `public_html/uploads/.htaccess` through denied executable extensions plus handler/type removal.
- No GitHub Actions workflow exists to repeat build, tests, lint, audit, or PHP validation on push.
- Authenticated browser CRUD/mobile and production deployment checks: **Manual verification required**.

## P0 Blockers

1. **No deployed authenticated end-to-end release proof**
   - Static review cannot prove production PHP version/extensions, MySQL schema parity, foreign keys, sessions, reverse-proxy HTTPS detection, upload permissions, rewrite rules, Turnstile, push behavior, transaction rollback, or actual finance totals.
   - Required gate: execute the checklist below on a staging clone or disposable production fixture and retain results.

2. **Authenticated mutations have no CSRF defense**
   - Admin requests rely on a session cookie with `SameSite=Lax`, `HttpOnly`, and HTTPS-aware `Secure`.
   - POST/PATCH/DELETE APIs do not validate a CSRF token or enforce trusted `Origin`/`Referer`.
   - This is a production blocker for a financial/admin application because successful cross-site mutation cannot be ruled out by application controls.

3. **Production database console is enabled without break-glass controls**
   - `ENABLE_ADMIN_SQL_EDITOR` is true in the current local config.
   - Any administrator session can run unrestricted SELECT/SHOW/DESCRIBE/EXPLAIN, DML, DROP, TRUNCATE, and ALTER statements.
   - SELECT results use `fetchAll()` without a row limit or timeout. SQL text, including possible confidential values, is written to the PHP error log.
   - Required gate: disable in production, or implement separate permission, re-authentication, IP restriction, row/time caps, and durable redacted audit logging.

4. **Deployment state and repository state are not proven equivalent**
   - There is no CI pipeline and no automated deployment verification.
   - Local `main` is ahead of `origin/main`; therefore GitHub `main`, the local audit target, and the deployed site may differ.
   - Required gate: identify the exact deployed commit, build from that commit, validate server configuration/schema, and smoke-test that deployment.

## P1 High Priority Risks

1. **Runtime DDL remains in request paths**
   - Customer, payment-plan, payment, financial-statement, media/settings, and public settings code still uses `SHOW COLUMNS` and/or `ALTER TABLE`.
   - This requires ALTER privileges, can create lock/contention failures, and makes schema state depend on route usage.
   - Move all schema changes into versioned, idempotent deployment migrations.

2. **Deletion/retention policy is unresolved**
   - Customer/project deletion can remove or detach context through cascade/`SET NULL` foreign keys.
   - Personnel/supplier and linked-plan guards are improved, but there is no consistent archive-first policy for accounting history.
   - Define legal/accounting retention, add archive states, and reserve hard deletion for empty/test records.

3. **Duplicate finance source risk**
   - Aggregates combine legacy `ak_payments`/`ak_expenses` with `ak_financial_entries`.
   - Recording the same event in both models can double-count totals.
   - Select one source of truth and migrate/deduplicate before finance reporting is treated as authoritative.

4. **Automated coverage is insufficient for the blast radius**
   - Six tests do not cover PHP allocation parity, authorization, CRUD transactions, uploads, reminders, reports, or deployment contracts.
   - Add API integration tests against a disposable MySQL database and browser smoke tests for critical workflows.

5. **Tracked environment file**
   - `.env` is tracked by Git. This audit did not reproduce or modify its contents.
   - Remove real environment values from history if any were ever committed; retain only a documented example file. Rotate any exposed keys.

6. **Contact form production behavior is unverified**
   - Backend validation, transaction handling, Turnstile verification, notification creation, and non-blocking push are present.
   - Production secret/site-key pairing, allowed hostname, outbound HTTPS, CSP, and successful insertion are **Manual verification required**.

7. **No automated release gate**
   - Build/tests/lint/audit/PHP syntax are not enforced on pushes or pull requests.
   - The current lint failure also prevents adopting a strict green pipeline without a scoped baseline/remediation phase.

## P2 Medium Priority

1. **Unpaginated full-table responses**
   - Customers, projects, payments, expenses, finance summary, reports, media, and related endpoints can return full datasets.
   - Add server-side pagination/filtering and bounded exports before data volume grows.

2. **File lifecycle remains incomplete**
   - The media endpoint can remove project-gallery files and protects known cover/site-setting references.
   - Direct project-image row deletion and project cascade deletion do not consistently delete physical files; abandoned pre-save uploads can remain.
   - Add reference-aware cleanup and a dry-run orphan scanner.

3. **Reminder generation race**
   - Read-before-insert reminder deduplication can race under concurrent requests.
   - Add an appropriate database uniqueness constraint and atomic insert/upsert.

4. **Large admin chunks**
   - PDF and chart chunks are substantial. Route splitting limits initial impact, but first-use performance on mobile/shared hosting should be measured.

5. **Login rate limiting is host-file based**
   - Limits are stored in the system temp directory by email/IP.
   - Behavior depends on shared-host permissions and is not centralized across multiple servers. Add cleanup/observability or database/cache-backed limiting.

6. **Cookie-consent storage can grow without controls**
   - Every preference submission inserts a new row and stores user agent text.
   - Define retention, privacy notice alignment, and rate/abuse controls.

7. **PHP compatibility warning**
   - Update the Turnstile helper signature to explicitly nullable form before moving to a PHP version where the current declaration becomes more disruptive.

8. **Mobile behavior remains inspection-only**
   - Responsive grids and horizontal overflow wrappers exist, but finance tables, charts, dialogs, drag/drop, and dense forms require real device testing.

## P3 Low Priority

1. Resolve the 188 lint errors and 15 warnings incrementally, prioritizing finance/API types, stale hook dependencies, and swallowed contact errors.
2. Upgrade the Vite toolchain in an isolated branch with build/browser regression testing instead of applying `npm audit fix --force` directly.
3. Remove disabled installer/import/admin-creation scripts from the deployed web root after setup, even though their source flags currently deny execution.
4. Add explicit operational documentation for backups, restore drills, log rotation, cron/cleanup tasks, upload quotas, PHP limits, and database maintenance.
5. Add user-facing retry/error states consistently to list/report pages that can currently resemble a legitimate empty state after an API failure.

## Regression Check

### Fixed and still fixed

- Protected admin PHP endpoints call `require_admin()`; current account role and active status are revalidated against MySQL.
- Login regenerates the session ID and has basic failed-attempt limiting.
- Session cookies use `HttpOnly`, `SameSite=Lax`, and HTTPS-aware `Secure`.
- Explicitly linked collections remain allocated to their selected payment plan.
- Only unlinked collections use customer/account-scoped due-date FIFO.
- Resmi/Gayri Resmi isolation remains represented in plans, payments, detail views, reports, dashboard calculations, and tests.
- Manual paid and partial paid amounts participate in effective paid/remaining calculations.
- Payment-plan deletion is blocked while linked collections exist.
- Personnel/supplier deletion checks include plans and financial-ledger references.
- Reminder reads trigger generation and obsolete generated reminders are cleaned up.
- Payment method, transaction reference, card note, cheque maturity/number/bank, and promissory maturity fields exist in schema/API/UI paths.
- Uploads enforce size and detected MIME allowlists; uploaded executable extensions are blocked by `.htaccess`.
- Production npm dependency audit remains clean.
- Setup/import/admin-creation tools are disabled by source constants.

### Fixed but regressed

- No currently verified regression was found in the focused finance allocation tests or static account-isolation paths.
- Historical regression risk remains high: the finance summary previously reintroduced an out-of-scope variable/account classification defect after earlier finance fixes. Integration coverage is still absent.

### Documented but not fixed

- CSRF/origin validation.
- Runtime DDL and versioned migrations.
- SQL editor break-glass hardening.
- Pagination and response limits.
- Customer/project archive and retention policy.
- Complete orphan upload cleanup.
- Legacy finance table versus financial-ledger deduplication.
- Concurrent reminder deduplication.
- Clean lint gate.
- CI/CD validation and deployed commit verification.

### Unclear / needs manual QA

- Production session cookie behavior behind cPanel/proxy/HTTPS.
- Login rate-limit file permissions.
- All authenticated CRUD and rollback behavior.
- Public route rewrites and direct deep links.
- Contact Turnstile/CSP/outbound verification.
- Cookie-consent insertion and privacy-retention behavior.
- Upload folder creation, permissions, downloadability, and execution denial on the actual Apache configuration.
- Finance totals against representative production records.
- Push subscription/test/delivery.
- Mobile layouts and long dialogs/tables.
- cPanel deployment of `dist`, PHP API, `.htaccess`, environment config, and current schema.

## Manual QA Checklist

Perform on a staging clone with disposable records. Record pass/fail, timestamp, browser/device, deployed commit, and screenshots where useful.

### Public visitor

- [ ] Open `/`, `/projelerimiz`, one project detail, all service routes, `/hakkimizda`, `/kentsel-donusum`, `/iletisim`, and legal pages by direct URL and browser refresh.
- [ ] Confirm missing routes show the intended 404 page and do not expose server paths/errors.
- [ ] Confirm published projects appear; unpublished projects and unpublished details are inaccessible.
- [ ] Verify header/footer links, phone, WhatsApp, map, favicon, SEO title/description, and social metadata.

### Admin login/session

- [ ] Verify wrong password, inactive user, non-admin role, five failed attempts, successful login, refresh persistence, logout, and expired/deleted session behavior.
- [ ] Inspect the session cookie for `Secure`, `HttpOnly`, expected path, and `SameSite`.
- [ ] Call protected APIs without a session and with a non-admin session; expect 401/403.
- [ ] Verify SQL editor is unavailable in production.
- [ ] Attempt cross-origin state-changing requests as part of the CSRF release fix.

### Customer CRUD

- [ ] Create, edit, search, open, and delete an empty disposable customer.
- [ ] Link a project, note, plan, collection, document, and ledger entry.
- [ ] Verify deletion is blocked or archived according to the approved retention policy.
- [ ] Verify invalid/missing customer IDs return clear errors without partial writes.

### Project CRUD

- [ ] Create draft, edit, duplicate, reorder, publish/unpublish, and view publicly.
- [ ] Verify slug uniqueness and invalid project handling.
- [ ] Delete only an empty disposable project and verify database/file behavior.

### Payment plan CRUD

- [ ] Create/edit/delete Resmi and Gayri Resmi plans.
- [ ] Test Bekliyor, Ödendi, Kısmi Ödendi, Vadesi Geçti, and İptal transitions in both directions.
- [ ] Verify a plan with linked collection cannot be deleted.
- [ ] Test Nakit/Kart/Çek/Senet fields, including cheque and promissory maturity dates.

### Partial payment

- [ ] Link a partial collection to a later-dated plan and confirm it does not pay an earlier plan.
- [ ] Add an unlinked collection and confirm FIFO applies only inside the same customer/account.
- [ ] Compare paid/remaining/status across customer detail, customer list, dashboard, finance, reports, and notifications.
- [ ] Verify manual paid/partial values do not double-count linked collections.

### Official/unofficial account separation

- [ ] Create matching Resmi and Gayri Resmi plans/payments for one customer.
- [ ] Confirm totals, charts, reports, balances, overdue state, and reminders never cross account tabs.
- [ ] Repeat representative checks for personnel and suppliers.

### Upload/delete media

- [ ] Upload valid JPG/PNG/WEBP/GIF project images and valid JPG/PNG/WEBP/PDF documents.
- [ ] Reject oversize, spoofed MIME, SVG where disallowed, PHP/polyglot, and unsupported extensions.
- [ ] Verify uploaded files cannot execute and directory indexes are denied.
- [ ] Replace/delete gallery, cover, site asset, payment, and expense files; inspect database rows and disk files.
- [ ] Abandon a new-project upload and verify the orphan-cleanup process detects it.

### Contact form

- [ ] Submit valid and invalid forms; test missing/failed/expired Turnstile tokens.
- [ ] Confirm one contact row and one notification are created transactionally.
- [ ] Confirm push failure does not lose the contact request.
- [ ] Verify CSP and Turnstile on desktop/mobile and after cache purge.

### Cookie consent

- [ ] Test accept, reject, and managed preferences.
- [ ] Refresh and confirm UI persistence.
- [ ] Confirm the stored database values match the selected categories and no optional tracking loads before consent.

### Mobile check

- [ ] Test public and authenticated flows at 360 px, 390 px, 768 px, and desktop widths.
- [ ] Check navigation, tables, charts, drag/drop, dialogs, date inputs, file controls, PDF/export actions, and sticky/overflow behavior.
- [ ] Test at least one real iOS Safari and Android Chrome device.

### Deployment/cPanel

- [ ] Record the deployed Git commit and build timestamp.
- [ ] Verify PHP version/extensions: PDO MySQL, fileinfo, cURL or HTTPS streams, OpenSSL, JSON, and mbstring.
- [ ] Verify database backup and restore before migration.
- [ ] Run versioned migrations once; confirm normal API users do not need ALTER privileges.
- [ ] Confirm `config.php`, environment files, SQL/import data, logs, and backups are not publicly downloadable.
- [ ] Confirm setup/import/admin-creation scripts are absent from the deployed web root.
- [ ] Verify rewrite rules, direct SPA routes, API JSON headers, upload `.htaccess`, file ownership, disk quota, PHP upload/body limits, and error display/log settings.

## Recommended Next Phase

Execute a **Production Security and Release Verification Phase**:

1. Add CSRF token issuance/validation or strict same-origin validation to every authenticated mutation, with session regression tests.
2. Disable the SQL editor in production and define a separate break-glass operational procedure.
3. Extract all runtime DDL into versioned deployment migrations; remove ALTER privileges from the normal application user.
4. Establish archive/retention rules and one finance source of truth before changing deletion or deduplication behavior.
5. Add disposable MySQL API integration tests and Playwright/browser smoke tests for auth, CRUD, finance allocation/account isolation, uploads, contact, and cookies.
6. Add CI for build, tests, lint baseline, production audit, and PHP syntax.
7. Deploy a staging build from an exact commit, run the full manual checklist, fix failures, then repeat a short production smoke test after deployment.

Go-live should be reconsidered only after all P0 gates have documented passes.
