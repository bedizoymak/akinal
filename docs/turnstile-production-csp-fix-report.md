# Turnstile Production CSP Fix Report

Date: 2026-05-31

Issue:
- Live site blocked Turnstile because the active CSP did not allow `https://challenges.cloudflare.com` for script/frame/connect sources.

What I searched for:
- `.htaccess` files under `public/` and `dist/` (found active CSP header declarations).
- `index.html` meta tag already included Turnstile hosts, but server `.htaccess` headers override the meta tag in many hosting setups.
- PHP header() calls and other server-side CSP setters — none found in repo.

Files changed:
- `public/.htaccess`: updated `Content-Security-Policy` header to allow Turnstile hosts and added `script-src-elem`.
- `dist/.htaccess`: mirrored the same updated CSP for built deploy artifacts.

Exact changes:
- `script-src`: added `https://challenges.cloudflare.com`
- `script-src-elem`: added `https://challenges.cloudflare.com`
- `frame-src`: added `https://challenges.cloudflare.com`
- `connect-src`: added `https://challenges.cloudflare.com`
- Kept existing directives (fonts, Google frames) and did not add `unsafe-eval`.

Why both files:
- `public/.htaccess` is used during local/dev static serving and some hosting panels.
- `dist/.htaccess` is the artifact folder likely uploaded to the production server; keeping them in sync avoids mismatches.

Validation steps for you (post-deploy):
1. Deploy updated `dist/` contents to your hosting provider.
2. In browser DevTools on the Contact page, confirm Network shows `https://challenges.cloudflare.com/turnstile/v0/api.js` loaded with 200 status.
3. Confirm no CSP violations in Console (search for "Refused to load" messages mentioning challenges.cloudflare.com).
4. In Console, inspect `window.__turnstileDebug` to confirm `scriptLoaded`, `turnstileAvailable`, and `renderSucceeded` flags as appropriate.

If CSP is still blocking after this change:
- Check hosting control panel for server-level CSP or security rules that override `.htaccess` (some CDNs or hosts set CSP via server headers).
- If server-level header exists, update it to match the policy above or add a dedicated exception for Turnstile.

Notes on safety:
- No secrets were added.
- Only allowed `https://challenges.cloudflare.com` for the same directives Turnstile requires.

Commit: "Fix production CSP for Turnstile"
