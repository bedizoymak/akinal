# Contact form Turnstile restore report

Date: 2026-05-31

Summary:
- Restored Cloudflare Turnstile bot protection on the public contact form.
- Frontend now uses `VITE_TURNSTILE_SITE_KEY` and does not hardcode the key.
- Backend server verifies the token with `TURNSTILE_SECRET_KEY` before accepting the request.
- Existing contact notification and admin push notification logic remains unchanged.
- Added CSP metadata for Turnstile hosts.

Changes made:
- `src/pages/site/Contact.tsx`
  - Added dynamic Turnstile widget loading via the official Cloudflare script.
  - Added widget callbacks for success, error, and expiration.
  - Prevented contact form submission unless a valid Turnstile token is present.
  - Included the token in the payload as `turnstile_token`.
- `src/lib/apiTypes.ts`
  - Added `turnstile_token` to `ContactRequestPayload`.
- `public_html/api/contact-request.php`
  - Added `verify_turnstile_token()` to validate the token server-side.
  - Rejects the request if Turnstile verification fails or the token is missing.
- `public_html/api/config.example.php`
  - Added `TURNSTILE_SECRET_KEY` placeholder.
- `index.html`
  - Added CSP metadata for Cloudflare Turnstile domains.

Deployment notes:
- Set `VITE_TURNSTILE_SITE_KEY` in the frontend environment.
- Set `TURNSTILE_SECRET_KEY` in `public_html/api/config.php` on the production server.
- Do not commit the real secret key.
