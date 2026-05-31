# Supabase Public Write and Auth Migration Report

## Files Changed

- `public_html/api/config.example.php`
- `public_html/api/db.php`
- `public_html/api/auth.php`
- `public_html/api/admin/login.php`
- `public_html/api/admin/logout.php`
- `public_html/api/admin/me.php`
- `public_html/api/contact-request.php`
- `public_html/api/cookie-consent.php`
- `public_html/create-admin-user.php`
- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`
- `src/hooks/useAuth.ts`
- `src/pages/admin/AdminAuth.tsx`
- `src/components/admin/AdminLayout.tsx`
- `src/pages/site/Contact.tsx`
- `src/components/site/CookieConsent.tsx`

## Endpoints Created

- `POST /api/admin/login.php`
- `POST /api/admin/logout.php`
- `GET /api/admin/me.php`
- `POST /api/contact-request.php`
- `POST /api/cookie-consent.php`

Temporary utility:

- `/create-admin-user.php?confirm=CREATE_AKINAL_ADMIN`

## Frontend Files Migrated

- `src/hooks/useAuth.ts` now uses PHP session endpoints instead of Supabase Auth.
- `src/pages/admin/AdminAuth.tsx` now logs in through `/api/admin/login.php`.
- `src/components/admin/AdminLayout.tsx` now logs out through `/api/admin/logout.php`.
- `src/pages/site/Contact.tsx` now posts to `/api/contact-request.php`.
- `src/components/site/CookieConsent.tsx` now posts to `/api/cookie-consent.php`.

The visual design and routes were not changed.

## Admin Auth

Admin sessions are server-side PHP sessions. Passwords are verified against `ak_admin_users.password_hash`. The frontend sends requests with `credentials: "include"` for session endpoints.

The session admin object contains only:

- `id`
- `email`
- `full_name`, if the database column exists
- `role`

Password hashes are never returned.

## Contact Request Flow

The contact form posts JSON to `/api/contact-request.php`. PHP validates required fields, inserts into `ak_contact_requests`, and creates a `Yeni İletişim Talebi` row in `ak_notifications`.

## Cookie Consent Flow

Cookie choices post JSON to `/api/cookie-consent.php`. PHP stores:

- `consent_status`
- `necessary`
- `analytics`
- `marketing`
- server-side `HTTP_USER_AGENT`

If the request fails, the cookie banner still closes locally and the site does not crash.

## Required Server Config Addition

Do not commit `config.php` or real secrets.

`config.example.php` is now guarded against direct access. `db.php` defines `AK_API_INTERNAL` before requiring the production config.

## Manual Deployment Steps

1. Upload the changed PHP API files.
2. Upload `public_html/create-admin-user.php`.
3. Open `/create-admin-user.php?confirm=CREATE_AKINAL_ADMIN`.
4. Create the first admin account.
5. Delete `public_html/create-admin-user.php`.
6. Deploy the frontend build.

## Manual Test Checklist

1. Upload PHP API files.
2. Upload `create-admin-user.php`.
3. Open `/create-admin-user.php?confirm=CREATE_AKINAL_ADMIN`.
4. Create admin account.
5. Delete `create-admin-user.php`.
6. Test admin login.
7. Test `/api/admin/me.php`.
8. Test admin logout.
9. Test contact form.
10. Test cookie consent.
11. Open browser Network tab and confirm public pages no longer call Supabase for site settings, projects, contact form, or cookie consent.
12. Document remaining Supabase calls, especially admin CRUD.

## Remaining Supabase Dependencies

Supabase is still used by admin CRUD pages, finance hooks/components, media uploads, project import/export tooling, scripts, and the sales chatbot Edge Function.

Supabase cannot be physically deleted yet.

## Validation

- `npm run build` passed.
- `npm run lint` was run and failed on pre-existing admin `any` typing issues and Fast Refresh warnings outside the files migrated in this phase.
- PHP syntax checks could not be run locally because PHP CLI is not installed in this shell.

## Next Recommended Phase

Migrate admin CRUD endpoints area by area, starting with settings/projects/media because those overlap with already-live public data.
