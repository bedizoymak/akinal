# Turnstile load debug report

Date: 2026-05-31

Issue:
- Contact form showed: "Turnstile yüklenemedi. Lütfen sayfayı yenileyin."

What I changed to debug and mitigate:
- Added dev-only debug flags and console output:
  - `siteKeyPresent` — whether `VITE_TURNSTILE_SITE_KEY` is set at runtime.
  - `scriptLoaded` — whether the Turnstile script's `onload` fired.
  - `turnstileAvailable` — whether `window.turnstile` is present.
  - `turnstileReady` — whether the widget has been rendered successfully.
- Made script loading more robust:
  - If script element already exists, handle loaded state and attach listeners.
  - Set `data-loaded` attribute on the script when loaded to avoid race conditions.
  - Add a short fallback timeout to retry rendering if `window.turnstile` is not immediately available after script load.
  - Add `crossorigin="anonymous"` on the injected script tag.
- Kept site key usage via `import.meta.env.VITE_TURNSTILE_SITE_KEY` (no hardcoding of keys).
- Ensured widget render is attempted only when `siteKey` is present and `window.turnstile` is available.
- Added CSP entries in `index.html` (script-src/frame-src/connect-src) for `https://challenges.cloudflare.com`.

How to reproduce debug info locally (development):
- Open browser devtools console on the Contact page and inspect the `__turnstileDebug` object:

  window.__turnstileDebug

- Flags explanation:
  - `siteKeyPresent` should be `true` in production builds when `VITE_TURNSTILE_SITE_KEY` is provided at build time.
  - `scriptLoaded` should become `true` when the Cloudflare script loads.
  - `turnstileAvailable` should become `true` when `window.turnstile` is present.
  - `turnstileReady` should become `true` after the widget renders.

Network checks:
- Confirm the script URL is reachable in Network tab: `https://challenges.cloudflare.com/turnstile/v0/api.js`.
- Confirm no CSP or mixed-content errors block the script.

Next steps if issue persists:
- Verify `VITE_TURNSTILE_SITE_KEY` is provided at build time (set env var and rebuild).
- Verify the server serves `index.html` without additional CSP headers that override the inline policy.
- Manually open the `dist` JS bundle and search for the inlined site key to confirm it was embedded.
- If CSP is enforced via server headers, update server `Content-Security-Policy` to include the Turnstile hosts.

Files changed:
- `src/pages/site/Contact.tsx`
- `index.html` (CSP)
- `docs/turnstile-load-debug-report.md`

