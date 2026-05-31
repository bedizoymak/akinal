# Contact CSP Turnstile Production Fix Report

## Result

The production CSP managed by `public/.htaccess` now allows Google Fonts and Cloudflare Turnstile on the contact page without adding `unsafe-eval`.

## Files Changed

- `public/.htaccess`
- `docs/contact-csp-turnstile-production-fix-report.md`

## Root Cause

The site imports Google Fonts from `src/index.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap');
```

The tracked CSP previously allowed styles and fonts only from `self` and `data:`. That blocked `https://fonts.googleapis.com` and `https://fonts.gstatic.com`, causing stylesheet/font warnings in production. Turnstile was already present in the CSP, but the contact page still depends on the deployed CSP actually allowing Cloudflare script/frame/connect sources.

## CSP Before

```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com https://www.google.com; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
```

## CSP After

```apache
Header always set Content-Security-Policy "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com https://www.google.com; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
```

## Required Sources Added/Verified

- `style-src https://fonts.googleapis.com`
- `style-src-elem https://fonts.googleapis.com`
- `font-src https://fonts.gstatic.com`
- `script-src https://challenges.cloudflare.com`
- `frame-src https://challenges.cloudflare.com`
- `connect-src https://challenges.cloudflare.com`

`unsafe-eval` was not added.

## Validation Steps

1. Confirm `.env` includes `VITE_TURNSTILE_SITE_KEY` before build.
2. Run `npm run build`.
3. Confirm `dist/.htaccess` includes the updated CSP.
4. Deploy the updated `.htaccess`.
5. Open `/iletisim` in production.
6. Confirm DevTools has no CSP block for:
   - `https://fonts.googleapis.com`
   - `https://fonts.gstatic.com`
   - `https://challenges.cloudflare.com/turnstile/v0/api.js`
7. Confirm the Turnstile iframe appears in the bot protection area.
8. Complete Turnstile and confirm the contact form submit button enables.
9. Submit the form and confirm `/api/contact-request.php` receives a non-empty `turnstileToken`.

## Known Limitations

- If the hosting panel, CDN, or reverse proxy sends another CSP header, it can still override or conflict with this `.htaccess` policy.
- Turnstile can still be blocked by browser privacy extensions, DNS filters, or Cloudflare domain restrictions.
- The frontend Turnstile site key is embedded at Vite build time, so production must be rebuilt after `.env` changes.
