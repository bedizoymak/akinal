# Full Project Audit Report: akinalinsaat.com

Audit date: 2026-06-03  
Project path: `C:\Users\Bediz\Documents\akinalinsaat.com`

## Executive Summary

The project is a React/Vite public website plus admin panel that has largely migrated runtime data access from Supabase to same-domain PHP/MySQL endpoints under `public_html/api`. The frontend build succeeds, and route coverage is broad for public pages, admin CRM, projects, finance, media, notifications, settings, and reports.

Launch readiness is not blocked by compilation, but it is blocked by operational and security cleanup. The highest risks are production-sensitive PHP files/scripts living in the deploy tree, a local real `public_html/api/config.php`, one-time installer/import/admin-user scripts that must not be web-accessible after setup, an admin SQL editor that can execute database mutations, and remaining Supabase dependencies/artifacts that can confuse deployment ownership.

## Current Project Status

- Frontend: Vite + React + TypeScript + Tailwind + shadcn/Radix UI.
- Routing: React Router SPA with public routes and protected admin routes.
- Backend: Direct PHP endpoints under `/api`, using PDO MySQL and PHP sessions.
- Database direction: MySQL/PHP appears to be the current runtime target.
- Supabase: still present as migrations/manual schema/functions/dependencies, but no active frontend Supabase client usage was found in the audited source.
- Build: `npm run build` completed successfully.
- Git validation: initial plain `git status` is blocked by Git dubious ownership; one-off safe-directory validation works.

## Folder / Module Inventory

- `src/`: React app source.
- `src/pages/site/`: public pages: home, about, services, service detail, projects, project detail, urban transformation, contact, legal pages.
- `src/pages/admin/`: admin dashboard, project/media management, contacts, settings, customers, employees, payment plans, collections, expenses, finance, notifications, reports, SQL editor.
- `src/components/site/`: layout, header, footer, SEO, project card, floating contact, cookie consent, sales chatbot.
- `src/components/admin/`: admin layout/page shell, notifications, push notifications panel, finance statement UI, helper buttons/dialogs.
- `src/components/ui/`: shadcn/Radix UI primitives.
- `src/lib/`: API client/types, project helpers, finance/PDF helpers, Turkish location data.
- `src/hooks/`: auth, site settings, notifications, finance, mobile/toast hooks.
- `public/`: static browser assets: favicon, robots, sitemap, admin push service worker.
- `public_html/`: PHP shared-hosting deployment tree.
- `public_html/api/`: public API endpoints, admin API endpoints, DB config example, session auth, response helpers.
- `public_html/import-data/`: ignored importer input location.
- `supabase/`: old/current migration archive, manual schemas, and edge functions.
- `migration-tools/`: Supabase export to MySQL conversion tooling.
- `scripts/`: local seed/cleanup helpers.
- `dist/`: generated build output.
- `docs/`: prior migration/readiness/admin QA reports plus this audit.

## Frontend Routes / Pages

Public routes:

- `/`
- `/hakkimizda`
- `/hizmetlerimiz`
- `/hizmetlerimiz/:slug`
- `/projelerimiz`
- `/projeler`
- `/projelerimiz/:slug`
- `/kentsel-donusum`
- `/iletisim`
- `/gizlilik-politikasi`
- `/cerez-politikasi`
- `/kullanim-sartlari`
- `*` not found route

Admin routes:

- `/admin/giris`
- `/admin`
- `/admin/projeler`, `/admin/projeler/yeni`, `/admin/projeler/:id`, `/admin/projeler/:id/finans`
- `/admin/musteriler`, `/admin/musteriler/yeni`, `/admin/musteriler/:id`, `/admin/musteriler/:id/duzenle`, `/admin/musteriler/:id/finans`
- `/admin/personeller`, `/admin/personeller/:id/finans`
- `/admin/odeme-planlari`
- `/admin/tahsilatlar`
- `/admin/giderler`
- `/admin/gider-kartlari`, `/admin/gider-kartlari/:id/finans`
- `/admin/finans-dashboard`
- `/admin/medya`
- `/admin/talepler`
- `/admin/bildirimler`
- `/admin/raporlar`
- `/admin/ayarlar`
- `/admin/sql-editor`

## Admin / CMS Structure

The admin panel is a custom CMS/CRM layer rather than a packaged CMS. It supports:

- Project CRUD and image management.
- Media library upload/delete.
- Contact request review.
- Site settings and public SEO/settings fields.
- Customers, employees, payment plans, payments/collections, expenses, expense cards.
- Finance dashboards, entity financial statements, and PDF/report generation.
- Admin browser push notification subscription/testing.
- Admin SQL editor.

Auth is session-based PHP auth. The frontend checks `/api/admin/me.php` and redirects unauthenticated users to `/admin/giris`.

## Supabase Structure

Supabase remains in:

- `package.json`: `@supabase/ssr`, `@supabase/supabase-js`.
- `supabase/config.toml`: project id and function config.
- `supabase/migrations/`: historical schema/data migrations.
- `supabase/manual/`: manual full schema and seed SQL.
- `supabase/functions/`: old edge functions for contact request and sales chatbot.
- `migration-tools/`: export conversion tooling from Supabase JSON to MySQL.

Current runtime source points mostly to `/api/*.php`; Supabase is now migration/archive/tooling debt unless intentionally kept.

## PHP / public_html Structure

Public endpoints:

- `/api/site-settings.php`
- `/api/projects.php`
- `/api/project-detail.php`
- `/api/contact-request.php`
- `/api/cookie-consent.php`
- `/api/sales-chatbot.php`

Admin endpoints:

- Login/logout/me.
- Projects, images, media upload, site assets.
- Contacts, customers, employees.
- Payment plans, payments, expenses, expense cards.
- Dashboard, finance summary, financial statements, reports.
- Notifications and push subscription/testing/debug.
- SQL editor.
- Demo import runner.

Top-level one-time scripts:

- `install-schema.php`
- `create-admin-user.php`
- `import-projects.php`
- `import-public-launch.php`

These should be removed from production after setup/import work.

## Deployment Structure

- Build output is generated into `dist/`.
- `dist/.htaccess` contains SPA fallback and a CSP allowing self, Cloudflare Turnstile, Google Maps frames, fonts, images, workers, and same-origin connects.
- PHP API lives separately in `public_html/api`.
- The deployment likely requires copying `dist` static files to web root while preserving `/api` PHP files under the same domain.
- Direct PHP files are used instead of a PHP front controller to support shared hosting.

## Environment / Config Risks

Critical:

- `public_html/api/config.php` exists locally. It is ignored by Git, but it is a real config file in the deploy tree and must be protected from accidental disclosure/copying.
- `.env` contains a Turnstile site key. This is a public key, but production key ownership/domain config should still be verified.

High:

- `install-schema.php`, `create-admin-user.php`, importer scripts, and `api/admin/run-demo-import.php` are dangerous if left accessible after launch.
- `public_html/api/config.example.php` includes placeholder production database naming; safe as an example, but it reinforces the need for environment separation.
- Git reports dubious ownership for the repo path when run as the current user. This can break CI/local tooling unless resolved intentionally.

## Build Results

Command:

```bash
npm run build
```

Result:

- Passed.
- Vite transformed 2637 modules and produced `dist/`.
- Warning: Browserslist/caniuse-lite data is 12 months old.
- Warning: several chunks exceed 500 kB after minification.

Largest build outputs observed:

- `pdfmake-*.js`: about 1,011 kB minified.
- `vfs_fonts-*.js`: about 855 kB minified.
- `generateCategoricalChart-*.js`: about 349 kB minified.
- main `index-*.js`: about 343 kB minified.

## Broken Links / Routes

No obvious internal route mismatch was found in the route table and static navigation:

- Header/footer public links map to defined routes.
- Footer service slugs map to service detail entries.
- Legal footer links map to `LegalPage`.
- `/projeler` and `/projelerimiz` both map to the projects list.

Potential issue:

- Public project detail URLs are runtime/data dependent and not in `sitemap.xml`.
- SPA fallback must be installed correctly on production or deep links like `/projelerimiz/:slug` and `/admin/...` will 404 at the server layer.

## Missing Assets

Found static source assets:

- `src/assets/logo.png`
- `src/assets/hero-construction.jpg`
- `src/assets/sample-project-1.jpg`
- `src/assets/sample-project-2.jpg`
- `src/assets/sample-project-3.jpg`
- homepage SVG decorative assets
- `public/favicon.png`

Risks:

- Home page comments identify temporary decorative visuals that should be replaced with real Akinal project imagery before production if authenticity is required.
- Project images are data-driven; missing or invalid DB image URLs can create blank/detail-page image issues.
- Uploaded media paths depend on PHP upload directories being writable and correctly served in production.

## Turkish Content / UI Issues

Positive:

- Main UI language is Turkish.
- Locale-aware project search uses `toLocaleLowerCase("tr-TR")`.
- Turkish route slugs use ASCII-safe forms.

Issues / risks:

- Brand spelling is mixed between `Akinal` and Turkish dotted/dotless expectations. Existing migration history includes a brand typo fix, so brand spelling should be signed off once: legal/company name, SEO title, logo alt text, footer, admin labels, PDFs.
- Some backend errors are English (`Invalid email or password`, `API request failed`) while most UI is Turkish.
- `LegalPage` uses `Akinal İnşaat LTD. ŞTİ.`; verify legal entity punctuation and official trade name.
- Contact form shows technical "Turnstile" wording to users; this may be acceptable but less natural than a Turkish bot-protection phrase.

## SEO State

Positive:

- `index.html` has Turkish lang, title, meta description, OG tags.
- `Seo` component sets title, description, canonical, OG, Twitter, organization, website, navigation, and breadcrumb JSON-LD.
- `robots.txt` allows crawling and points to sitemap.
- Static sitemap includes core public routes.

Gaps:

- Dynamic project detail pages are not included in `sitemap.xml`.
- SPA rendering means crawlers must execute JS for route-level Helmet metadata; server-rendered/static snapshots are not present.
- Twitter card is `summary`, not `summary_large_image`, in route-level SEO.
- OG image is not set in the shared SEO component.
- Canonical origin is derived from `window.location.origin`; staging/local deployments will emit staging/local canonicals.

## Performance Risks

High:

- `pdfmake` and `vfs_fonts` are very large. Even if split, admin report/PDF flows can be heavy.
- Recharts/chart chunks are large.

Medium:

- `useSiteSettings` is called by many components and performs independent fetches per hook instance; this can duplicate `/api/site-settings.php` requests instead of sharing through React Query/context.
- Public project detail fetches both detail and all published projects to calculate previous/next.
- Some large images are JPGs without responsive variants or modern formats.

Low:

- CSS bundle is about 93 kB minified; acceptable but worth monitoring.
- Browserslist data is stale.

## Security Risks

Critical:

- Admin SQL editor can execute non-SELECT SQL after checkbox confirmation, and destructive statements after text confirmation. This is powerful and should be production-gated, role-gated, or removed unless absolutely required.
- One-time scripts in `public_html` can create admins, install schema, and import data. They must not remain web-accessible post-launch.
- `public_html/api/config.php` exists locally; accidental deployment, backup exposure, or web misconfiguration could expose credentials.

High:

- Admin auth has no visible rate limiting or lockout.
- Session auth uses `SameSite=Lax` and secure cookies when HTTPS is detected, but write endpoints do not appear to include CSRF tokens. SameSite helps, but CSRF risk remains for same-site/top-level scenarios.
- File upload endpoints need production validation for MIME sniffing, extension allowlists, path traversal, max size, and execution prevention in upload directories.
- Contact endpoint returns Turnstile verification details to clients; useful for debugging, but should be minimized in production.

Medium:

- CSP allows `img-src https:` broadly and `style-src 'unsafe-inline'`.
- Push debug/error files are written under system temp; ensure no sensitive payloads are exposed or retained unexpectedly.
- No visible HTTP security headers beyond `X-Content-Type-Options` in API and CSP in `dist/.htaccess`.

## Technical Debt

- Supabase dependencies and artifacts remain after PHP/MySQL migration.
- Many admin pages duplicate CRUD patterns and form behavior.
- API client is a single large module.
- Documentation is extensive but fragmented across many phase reports.
- README is minimal.
- Build output and public_html deployment requirements are not captured in one authoritative runbook.
- Runtime settings are fetched ad hoc rather than centrally cached.
- Admin SQL editor and migration scripts blur development/operations boundaries.

## Critical Issues

1. Remove or protect all one-time setup/import/admin-creation scripts before launch.
2. Decide whether the admin SQL editor is allowed in production; default recommendation is to remove or hard-disable it.
3. Verify `public_html/api/config.php` never enters Git or public static deployment and is protected by server configuration.
4. Confirm production `.htaccess` SPA fallback is deployed with PHP API routes preserved.
5. Complete a production smoke test against the real MySQL/PHP environment.

## High Risks

- No admin login rate limiting.
- No explicit CSRF token strategy for admin mutating endpoints.
- Large PDF/font/chart bundles.
- Supabase artifacts/dependencies can cause confusion about source of truth.
- Project sitemap excludes dynamic detail URLs.

## Medium Risks

- Repeated settings fetches.
- Mixed English/Turkish error text.
- Temporary/sample imagery still used.
- CSP is serviceable but broad for images/styles.
- Git dubious ownership blocks default Git commands.

## Low Risks

- Stale Browserslist data.
- Sparse README.
- Route indentation/style issue in `App.tsx` readability only.
- Some debug logs remain in frontend error paths.

## Launch Readiness Score

Score: 68 / 100

The project compiles and has a functional architecture, but it is not launch-clean until production-only scripts, SQL editor exposure, config handling, auth hardening, and deployment smoke testing are addressed.

## Recommended Phase 1 Scope

1. Production hardening:
   - Remove or block `install-schema.php`, `create-admin-user.php`, `import-projects.php`, `import-public-launch.php`, and `api/admin/run-demo-import.php` after setup.
   - Disable or heavily gate `/admin/sql-editor`.
   - Add admin login rate limiting and CSRF protection for mutating admin endpoints.

2. Deployment readiness:
   - Create a single deployment runbook for `dist` + `public_html/api`.
   - Verify `.htaccess` fallback and CSP on the real host.
   - Confirm upload directories are non-executable and writable only where needed.

3. SEO/content launch pass:
   - Generate dynamic project sitemap entries from MySQL data.
   - Add OG image support.
   - Replace temporary/sample project imagery with real approved visuals.
   - Finalize brand/legal spelling and Turkish copy consistency.

4. Performance pass:
   - Lazy-load PDF generation/font bundles only inside report/PDF actions.
   - Review chart bundle splitting.
   - Cache site settings centrally.

5. Migration cleanup:
   - Decide whether Supabase files remain as archive docs or are moved out of runtime repo.
   - Remove unused Supabase packages if no runtime code needs them.

## Validation

Build:

- `npm run build`: passed on 2026-06-03.
- Warnings: stale Browserslist data and chunks over 500 kB.

Git status:

- Plain `git status` initially failed because Git detected dubious ownership for `C:/Users/Bediz/Documents/akinalinsaat.com`.
- Validation used a one-off safe-directory flag instead of changing global Git config.
- Before creating this report, `git -c safe.directory=C:/Users/Bediz/Documents/akinalinsaat.com status --short` returned no changed files.
