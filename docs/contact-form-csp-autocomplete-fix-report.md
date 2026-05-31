# Contact Form CSP and Autocomplete Fix Report

Date: 2026-05-31

Summary:
- Fixed the contact form CSP meta policy to allow Google Maps iframes alongside Cloudflare Turnstile.
- Added proper `id`, `name`, and `autocomplete` attributes to the contact form fields.
- Kept UI behavior unchanged while improving browser autofill semantics.

Details:
- Updated `index.html` CSP meta tag to include:
  - `script-src 'self' https://challenges.cloudflare.com`
  - `script-src-elem 'self' https://challenges.cloudflare.com`
  - `frame-src 'self' https://challenges.cloudflare.com https://www.google.com`
  - `connect-src 'self' https://challenges.cloudflare.com`
- Confirmed `public/.htaccess` and `dist/.htaccess` already include `https://www.google.com` in `frame-src`.
- Contact form field enhancements in `src/pages/site/Contact.tsx`:
  - `full_name` input now has `name="name"` and `autocomplete="name"`
  - `phone` input now has `name="tel"`, `type="tel"`, and `autocomplete="tel"`
  - `email` input now has `name="email"` and `autocomplete="email"`
  - Service selection now includes a hidden input `name="service"` so the field name is present for browser heuristics
  - `message` textarea now has `name="message"` and `autocomplete="message"`

Ignored warnings:
- Browser extension warnings such as Grammarly or internal Cloudflare script warnings are ignored, as they are not application-level CSP issues.

Validation:
1. The production build includes the updated CSP meta policy.
2. Contact form fields now expose proper form semantics for autocomplete.
3. UI structure and appearance remain unchanged.
