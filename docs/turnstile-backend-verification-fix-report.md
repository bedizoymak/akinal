# Turnstile Backend Verification Fix Report

Date: 2026-05-31

Issue:
- The public contact form frontend loaded Turnstile successfully, but `api/contact-request.php` returned a 400/401 failure during server-side verification.

Findings:
- Frontend sends `turnstile_token` in JSON payload via `submitContactRequest()`.
- Backend reads the same field name in `public_html/api/contact-request.php`.
- `public_html/api/config.php` already defines `TURNSTILE_SECRET_KEY`.
- The verification function previously sent `remoteip` to Cloudflare, which can fail if the server is behind a proxy or load balancer.

Fixes applied:
- `public_html/api/contact-request.php` now returns safe error codes in response `details`:
  - `missing_token` if the frontend does not send a token.
  - `missing_secret` if the server secret is not configured or is still the placeholder.
  - `cloudflare_verify_failed` if Cloudflare rejects the token.
- Removed `remoteip` from the Cloudflare `siteverify` request to avoid false negatives caused by incorrect server IP forwarding.
- Added safe verification details only when available:
  - `error_type`
  - `error_codes` from Cloudflare when present
- No secret or token values are logged or returned.

Validation steps:
1. Submit the contact form on `/iletisim`.
2. If the request fails, inspect the API response body from `/api/contact-request.php`.
3. Confirm the JSON includes `details.reason` with one of:
   - `missing_token`
   - `missing_secret`
   - `cloudflare_verify_failed`
4. Confirm contact notifications still arrive when the request succeeds.

Notes:
- `public_html/api/config.php` contains `TURNSTILE_SECRET_KEY`; if production still fails, verify the live server is using the same config and that the secret is valid for the deployed site key.
- The backend update keeps the existing contact notification flow intact.
