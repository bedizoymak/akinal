# Turnstile Widget Render Fix Report

## Root Cause

The contact form reserved a `65px` Turnstile container but did not expose any visible state when the Cloudflare script failed to load, when the site key was missing, or when `turnstile.render()` failed to create a widget. In production this made the bot protection area look like an empty placeholder and left the submit button permanently disabled because no token could be produced.

## Files Changed

- `src/pages/site/Contact.tsx`
- `docs/turnstile-widget-render-fix-report.md`

## CSP/Script Changes

No CSP weakening was required and `unsafe-eval` was not added.

The existing tracked CSP in `public/.htaccess` already allows:

- `script-src https://challenges.cloudflare.com`
- `frame-src https://challenges.cloudflare.com`
- `connect-src https://challenges.cloudflare.com`

The contact form still loads Cloudflare from:

```text
https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&hl=tr
```

Script handling changes:

- Adds a stable script id: `cloudflare-turnstile-script`.
- Reuses an existing Turnstile script if present.
- Uses `window.turnstile.ready()` when available.
- Adds script `onerror` handling.
- Adds a 10 second timeout fallback if no widget renders.
- Shows clear user-facing messages for missing config, load failure, and render failure.

## Validation Steps

1. Confirm production build has `VITE_TURNSTILE_SITE_KEY` set to the real Cloudflare Turnstile site key.
2. Run `npm run build`.
3. Open `/iletisim`.
4. Confirm the bot protection area first shows `Güvenlik doğrulaması yükleniyor...`.
5. Confirm the Cloudflare script request appears in the Network tab.
6. Confirm a Turnstile iframe renders inside the bot protection area.
7. Complete the challenge.
8. Confirm the submit button becomes enabled.
9. Submit the form and confirm `/api/contact-request.php` receives a non-empty `turnstileToken`.
10. Confirm the request is saved to `ak_contact_requests`.

## Known Limitations

- A production build without `VITE_TURNSTILE_SITE_KEY` cannot render Turnstile because Vite embeds environment variables at build time.
- Browser privacy extensions, DNS filtering, or CDN/firewall rules can still block `challenges.cloudflare.com`.
- The repository CSP is correct, but hosting-level CSP headers must not override it with stricter values.

## Result

The Turnstile area no longer fails silently. The contact form now loads the Cloudflare script explicitly, renders through the correct container when ready, and displays actionable fallback messages if configuration, loading, or rendering fails.
