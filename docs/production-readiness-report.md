# Production Readiness Report

Date: 2026-05-30

## Executive Summary

The live React/PHP/MySQL application is production-close. Runtime `src/` code no longer imports or calls Supabase, all frontend-referenced PHP endpoints exist, and admin routes now use PHP API methods instead of the removed Supabase client.

Migration completion estimate:

- Live runtime migration away from Supabase: 100%
- Overall cleanup/readiness: 95%
- Remaining 5%: archive/remove Supabase-era tooling, remove unused Supabase package dependencies when tooling is retired, create/verify production upload folders, and manually smoke-test on the target server.

## Admin Route Readiness

All admin routes declared in `src/App.tsx` resolve to React pages/components that now use PHP API methods.

| Route | Page | Supabase Runtime Status |
| --- | --- | --- |
| `/admin` | `AdminDashboard` | Migrated to `/api/admin/dashboard.php` |
| `/admin/projeler` | `AdminProjects` | Migrated to `/api/admin/projects.php` |
| `/admin/projeler/yeni` | `AdminProjectEdit` | Migrated to PHP project/image endpoints |
| `/admin/projeler/:id` | `AdminProjectEdit` | Migrated to PHP project/image endpoints |
| `/admin/projeler/:id/finans` | `AdminProjectFinance` | Migrated to `/api/admin/financial-statement.php` |
| `/admin/musteriler` | `AdminCustomers` | Migrated to `/api/admin/customers.php` |
| `/admin/musteriler/yeni` | `AdminCustomerEdit` | Migrated to `/api/admin/customers.php` |
| `/admin/musteriler/:id` | `AdminCustomerDetail` | Migrated to `/api/admin/customers.php` |
| `/admin/musteriler/:id/duzenle` | `AdminCustomerEdit` | Migrated to `/api/admin/customers.php` |
| `/admin/musteriler/:id/finans` | `AdminCustomerFinance` | Migrated to `/api/admin/financial-statement.php` |
| `/admin/personeller` | `AdminEmployees` | Migrated to `/api/admin/employees.php` |
| `/admin/personeller/:id/finans` | `AdminEmployeeFinance` | Migrated to `/api/admin/financial-statement.php` |
| `/admin/odeme-planlari` | `AdminPaymentPlans` | Migrated to `/api/admin/payment-plans.php` |
| `/admin/tahsilatlar` | `AdminCollections` | Migrated to `/api/admin/payments.php` |
| `/admin/giderler` | `AdminExpenses` | Migrated to `/api/admin/expenses.php` |
| `/admin/gider-kartlari` | `AdminExpenseCards` | Migrated to `/api/admin/expense-cards.php` |
| `/admin/gider-kartlari/:id/finans` | `AdminExpenseCardFinance` | Migrated to `/api/admin/financial-statement.php` |
| `/admin/finans-dashboard` | `AdminFinance` | Migrated to `/api/admin/finance-summary.php` |
| `/admin/medya` | `AdminMedia` | Migrated to `/api/admin/media.php` |
| `/admin/talepler` | `AdminContacts` | Migrated to `/api/admin/contact-requests.php` |
| `/admin/bildirimler` | `AdminNotifications` | Migrated to `/api/admin/notifications.php` |
| `/admin/raporlar` | `AdminReports` | Migrated to `/api/admin/reports.php` |
| `/admin/ayarlar` | `AdminSettings` | Migrated to `/api/admin/site-settings.php` |

Runtime scan:

```bash
rg -n "supabase|createClient|supabase\.auth|supabase\.storage|supabase\.functions|financeSupabase|@supabase" src
```

Result: no matches.

## API Endpoint Inventory

All frontend-referenced `/api/...` paths exist in `public_html/api`.

Public endpoints:

- `/api/site-settings.php`
- `/api/projects.php`
- `/api/project-detail.php`
- `/api/contact-request.php`
- `/api/cookie-consent.php`
- `/api/sales-chatbot.php`

Admin/auth endpoints:

- `/api/admin/login.php`
- `/api/admin/logout.php`
- `/api/admin/me.php`
- `/api/admin/dashboard.php`
- `/api/admin/site-settings.php`
- `/api/admin/projects.php`
- `/api/admin/project-images.php`
- `/api/admin/media.php`
- `/api/admin/upload-project-image.php`
- `/api/admin/contact-requests.php`
- `/api/admin/customers.php`
- `/api/admin/payment-plans.php`
- `/api/admin/payments.php`
- `/api/admin/upload-payment-document.php`
- `/api/admin/finance-summary.php`
- `/api/admin/financial-statement.php`
- `/api/admin/expenses.php`
- `/api/admin/upload-expense-document.php`
- `/api/admin/expense-cards.php`
- `/api/admin/notifications.php`
- `/api/admin/employees.php`
- `/api/admin/reports.php`

No missing PHP endpoints were found from the frontend API client scan.

## Upload Directory Status

Upload endpoints create folders automatically if PHP has permission, but the folders are not currently present in the repository.

Required production paths:

- `public_html/uploads/project-images`
- `public_html/uploads/payment-documents`
- `public_html/uploads/expense-documents`

Endpoint mapping:

- `upload-project-image.php` writes to `/uploads/project-images`
- `upload-payment-document.php` writes to `/uploads/payment-documents`
- `upload-expense-document.php` writes to `/uploads/expense-documents`

Production requirement:

- Ensure `public_html/uploads` exists or PHP can create it.
- Ensure the web server user can write to all three upload folders.
- Ensure uploaded files are publicly readable where URLs are returned.
- Include these folders in file backups.

## TODO/FIXME/HACK Scan

Scan command:

```bash
rg -n "TODO|FIXME|HACK" . -g "!*node_modules*" -g "!*dist*" -g "!*vendor*"
```

Result:

- `public/sitemap.xml`: TODO notes that dynamic project detail URLs are not generated at build time.

No code-level `FIXME` or `HACK` comments were found.

## Supabase Archive Candidates

No live runtime `src/` Supabase files remain. The following Supabase-related files are now archive candidates, not runtime dependencies:

- `supabase/`
  - Supabase migrations, manual SQL, Edge Functions, and config.
- `scripts/seed-smoke-test.mjs`
- `scripts/cleanup-smoke-test.mjs`
- `scripts/seed-demo-bulk.mjs`
- `scripts/cleanup-demo-bulk.mjs`
- `migration-tools/`
  - Still useful if final data conversion/replay is needed.
- `package.json` dependencies:
  - `@supabase/supabase-js`
  - `@supabase/ssr`
- Historical docs that describe earlier Supabase state.

Recommendation: archive these only after production MySQL backup, media backup, and final manual sign-off. Do not remove migration tooling until the team confirms no rollback/export comparison is needed.

## Remaining Known Issues

- `sales-chatbot.php` currently returns `reply: null` and the frontend uses deterministic local fallback replies. This is production-safe but not a real AI backend.
- Upload directories are documented and auto-created by endpoints, but they should be explicitly created and permission-checked during deployment.
- `public/sitemap.xml` does not include dynamic project detail URLs.
- PHP lint was not available in the local shell during the previous phase because `php` was not installed locally.
- Supabase packages remain in package metadata for old scripts/tooling even though live runtime code no longer imports them.
- Historical audit docs may describe pre-migration Supabase usage and should not be treated as current-state docs.

## Recommended Backups

Before deployment:

- Full MySQL dump of all `ak_*` tables.
- Full copy of `public_html/uploads`.
- Copy of production `public_html/api/config.php`.
- Current deployed `public_html` package or hosting snapshot.
- Latest Git commit hash deployed to production.

After deployment:

- Repeat MySQL dump after first successful admin smoke test.
- Back up newly created upload directories.
- Store a copy of any imported SQL used for the final cutover.

## Deployment Checklist

1. Build frontend with `npm run build`.
2. Upload built frontend assets to the production web root according to the hosting layout.
3. Upload `public_html/api`.
4. Confirm production `public_html/api/config.php` contains correct MySQL credentials.
5. Create or permission-check:
   - `public_html/uploads/project-images`
   - `public_html/uploads/payment-documents`
   - `public_html/uploads/expense-documents`
6. Verify PHP has PDO MySQL enabled.
7. Verify PHP sessions work for admin auth.
8. Verify HTTPS is enabled.
9. Verify `/api/site-settings.php` returns JSON.
10. Verify `/api/admin/login.php` accepts a valid admin login.
11. Smoke-test each admin section:
    - Dashboard
    - Projects
    - Project edit and image upload
    - Media
    - Contact requests
    - Customers
    - Payments
    - Payment plans
    - Finance summary
    - Expenses
    - Expense cards
    - Financial statement pages
    - Notifications
    - Employees
    - Reports
    - Settings
12. Submit public contact form and verify rows in `ak_contact_requests` and `ak_notifications`.
13. Upload one project image, one payment document, and one expense document.
14. Confirm public pages render project and site setting data from MySQL.
15. Keep `supabase/` and migration scripts archived until production has been stable long enough for rollback risk to be low.
