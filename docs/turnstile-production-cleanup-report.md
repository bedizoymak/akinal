# Turnstile Production Cleanup Report

Date: 2026-06-01

## Result

Turnstile remains enabled for the public contact form. The cleanup removed the production debug object from the browser and made the Apache `.htaccess` CSP the single source of truth by removing the duplicate narrow CSP meta tag from `index.html`.

## Files Changed

- `index.html`
- `src/pages/site/Contact.tsx`
- `docs/turnstile-production-cleanup-report.md`

## Frontend Cleanup

- Removed the production `window.__turnstileDebug` object and all runtime writes to it.
- Removed related debug-only React state that existed only to populate that production object.
- Kept the dev-only `console.debug` inside `import.meta.env.DEV`.
- Kept the Turnstile widget loader, widget render, token handling, and submit gating.

## CSP Cleanup

- Removed the duplicate `<meta http-equiv="Content-Security-Policy">` from `index.html`.
- Kept `public/.htaccess` as the production CSP source of truth.
- The `.htaccess` CSP still allows Cloudflare Turnstile script, frame, and connect sources.

## Backend Verification

- `public_html/api/contact-request.php` still performs server-side Turnstile verification.
- `public_html/api/config.example.php` still contains only the placeholder:
  `TURNSTILE_SECRET_KEY_HERE`
- No real server secret was committed.

## Validation Steps

- Searched for production debug exposure and confirmed `window.__turnstileDebug` is no longer present.
- Confirmed Turnstile runtime references remain in the contact page and PHP endpoint.
- Confirmed `config.example.php` uses a placeholder secret only.
- Ran `npm run build` successfully.

## Known Limitations

- End-to-end Turnstile verification must still be tested on the deployed domain because Cloudflare site keys and domain rules are production-sensitive.

## Final State

Turnstile is kept, production debug exposure is removed, and CSP configuration no longer conflicts between `index.html` and `.htaccess`.
