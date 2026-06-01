# Full Project Audit Report: akinalinsaat.com (Verified)

**Notice:** This audit is limited to `index.html` and `package-lock.json`. Backend logic files (PHP) and React source components were not available for inspection.

## 1. Critical Issues

### [C-01] Supabase Connection Blocked by CSP
**File Path:** `c:\Users\Ebru\Documents\akinalinsaat.com\index.html`
**Line Number:** 7
**Issue:** The `Content-Security-Policy` defines `connect-src 'self' https://challenges.cloudflare.com;`. The project dependencies (`package-lock.json`) confirm the use of `@supabase/supabase-js`. Since the Supabase migration is "mostly completed," the frontend must connect to a Supabase API URL (e.g., `https://[id].supabase.co`). The current policy will block all database and auth requests to Supabase in production.
**Recommended Fix:** Update the `connect-src` directive to include your Supabase project URL:
`connect-src 'self' https://challenges.cloudflare.com https://*.supabase.co;`

---

## 2. Medium Issues

### [M-01] Incomplete Content Security Policy (Missing Directives)
**File Path:** `c:\Users\Ebru\Documents\akinalinsaat.com\index.html`
**Line Number:** 7
**Issue:** The CSP lacks `default-src`, `img-src`, and `style-src` directives. While this might not "break" the site immediately depending on browser defaults, it fails to protect against unauthorized image loading or style injection, which is a security risk for a production site handling user data/admin flows.
**Recommended Fix:** Add a `default-src 'self'` and specific source directives for images and styles.

### [M-02] Google Maps Integration Inconsistency
**File Path:** `c:\Users\Ebru\Documents\akinalinsaat.com\index.html`
**Line Number:** 7
**Issue:** The `frame-src` allows `https://www.google.com`, but if the application uses Google Maps embeds (requested search term: `google.com/maps`), these often resolve to `https://www.google.com/maps` or `https://maps.google.com`. Subdomain mismatches or missing path specificities can lead to CSP violations.
**Recommended Fix:** Explicitly allow the maps subdomain: `frame-src 'self' https://challenges.cloudflare.com https://www.google.com https://maps.google.com;`

---

## 3. Low Priority Cleanup

### [L-01] Dependency Version Irregularity
**File Path:** `c:\Users\Ebru\Documents\akinalinsaat.com\package-lock.json`
**Line Number:** 1146 (and others)
**Issue:** Packages like `@supabase/supabase-js` are listed at version `2.106.2` and `typescript` at `5.8.3`. These version strings are significantly ahead of the current stable public releases (as of early 2025). 
**Recommended Fix:** Verify if these are custom internal builds or if the `package-lock.json` was generated with a registry containing non-standard version tags. Ensure `npm install` behaves predictably across deployment environments.

---

## 4. Search Results (Proven)

- **Content-Security-Policy:** Identified and audited in `index.html:7`.
- **google.com/maps:** Not found as a string, but the domain `google.com` is present in `index.html:7`.
- **supabase:** Proven usage via `@supabase/supabase-js` in `package-lock.json`.
- **Others:** No matches for `move_uploaded_file`, `$_FILES`, `require_admin`, `session_start`, `/dir/`, `destination=`, `TURNSTILE_SECRET_KEY`, or `create-admin-user.php` in the provided context.

---
## 5. What NOT to Change
1. **Do not modify the `package-lock.json` manually**; use npm commands to resolve any version discrepancies to maintain integrity.
2. **Do not remove `https://challenges.cloudflare.com` from CSP**, as it is required for the Turnstile integration used in the contact form.