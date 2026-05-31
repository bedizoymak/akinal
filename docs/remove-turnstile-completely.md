# Bot-Control Removal Report

Date: 2026-05-31

## Result

The former Cloudflare bot-control functionality has been removed from the public contact flow. The contact form now submits directly to the PHP endpoint after normal field validation, and the backend no longer requires or verifies a challenge token.

## Files Changed

- `.env`
- `public/.htaccess`
- `public_html/api/config.example.php`
- `public_html/api/contact-request.php`
- `src/lib/apiTypes.ts`
- `src/pages/site/Contact.tsx`
- `supabase/functions/submit-contact-request/index.ts`
- `docs/current-architecture-audit.md`
- `docs/phase-b-contact-form-report.md`
- `docs/supabase-public-write-and-auth-migration-report.md`
- Removed obsolete reports for the previous challenge widget and CSP fixes.

## Frontend Removals

- Removed contact page challenge site-key reading from `import.meta.env`.
- Removed dynamic script creation and loader logic for the Cloudflare challenge script.
- Removed widget container, loading/error states, token state, and submit-button gating.
- Removed the challenge token from the contact request TypeScript payload.
- Removed the frontend site-key environment variable from `.env`.

## Backend Removals

- Removed the server-side challenge secret placeholder from `public_html/api/config.example.php`.
- Removed token extraction and required-token validation from `public_html/api/contact-request.php`.
- Removed server-side verification helper and outbound provider verification calls.
- Updated the archived Supabase contact function so it no longer references or validates a challenge token.

## CSP Changes

`public/.htaccess` no longer allows the Cloudflare challenge origin in:

- `script-src`
- `frame-src`
- `connect-src`

Google Fonts allowances remain because they are unrelated to bot control and are still required by the site stylesheet.

## Validation Steps

- Searched the repository for the legacy widget name, provider domain, widget class, backend secret constant, and frontend site-key variable.
- Confirmed no matches before creating this report.
- Ran `npm run build`.

## Result

The public contact form works without bot verification and no longer depends on the former Cloudflare challenge widget at runtime.
