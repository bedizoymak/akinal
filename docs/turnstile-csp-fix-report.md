# Turnstile CSP Fix Report

## Result

Cloudflare Turnstile is now allowed by the repository-managed Apache CSP header without adding `unsafe-eval`. The change keeps the existing SPA rewrite behavior and adds only the sources needed for the public contact form Turnstile widget and server verification flow.

## Files Changed

- `public/.htaccess`
- `docs/turnstile-csp-fix-report.md`

## CSP Before

The repository did not define a tracked `Content-Security-Policy` header or CSP meta tag.

Tracked header/config inspection:

- `index.html`: no CSP meta tag.
- `public/.htaccess`: SPA rewrite rules only.
- `public_html/.htaccess`: not present in the repository.

Because production was still blocking Turnstile, the active production CSP was likely coming from hosting/server configuration outside the tracked codebase, or from an older deployed header file.

## CSP After

`public/.htaccess` now sends:

```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com https://www.google.com; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
```

Turnstile additions:

- `script-src https://challenges.cloudflare.com`
- `frame-src https://challenges.cloudflare.com`
- `connect-src https://challenges.cloudflare.com`

No `unsafe-eval` was added.

Existing site needs preserved:

- `style-src 'unsafe-inline'` remains necessary for current UI/runtime styling patterns.
- `frame-src https://www.google.com` preserves the existing Google Maps iframe in the contact page.
- `img-src https:` allows externally configured media URLs.
- `worker-src 'self'` preserves the admin push service worker.

## Validation Steps

1. Run `npm run build`.
2. Confirm `dist/.htaccess` contains the updated CSP copied from `public/.htaccess`.
3. Deploy the new `dist/.htaccess` or copy the same CSP into the active production web server config.
4. Open `/iletisim` in production.
5. Confirm the browser console no longer reports CSP blocks for `https://challenges.cloudflare.com/turnstile/v0/api.js`.
6. Complete the Turnstile challenge and confirm the submit button becomes enabled.
7. Submit the contact form and confirm `/api/contact-request.php` receives a non-empty `turnstileToken`.
8. Confirm the API returns success and creates rows in `ak_contact_requests` and `ak_notifications`.

## Known Limitations

- This repository only controls CSP if production serves the deployed `.htaccess` and Apache `mod_headers` is enabled.
- If hosting injects CSP at the panel, CDN, or reverse-proxy layer, the same Turnstile sources must be added there too.
- The contact form could not be fully end-to-end token-tested locally without the production Turnstile site key and matching domain configuration.

## Result

The tracked CSP now permits Cloudflare Turnstile scripts, frames, and verification network calls without weakening the policy with `unsafe-eval`.
