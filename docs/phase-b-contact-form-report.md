# Phase B Contact Form Migration Report

Date: 2026-05-30

## Scope

Implemented Phase B for the public contact form and Cloudflare Turnstile verification.

Not touched:

- Admin projects
- Admin settings
- Admin media
- CRM
- Finance
- Reports

## Current Contact Flow

- Public page: `src/pages/site/Contact.tsx`
- API client: `submitContactRequest` in `src/lib/apiClient.ts`
- Endpoint: `POST /api/contact-request.php`
- Target table: `ak_contact_requests`
- Notification table: `ak_notifications`

The React form renders Cloudflare Turnstile using `VITE_TURNSTILE_SITE_KEY`, collects the returned token, and posts it as `turnstileToken` to the PHP API.

## Turnstile Usage

Client-side:

- Environment variable: `VITE_TURNSTILE_SITE_KEY`
- Script loaded by the Contact page:
  - `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&hl=tr`

Server-side:

- Config constant: `TURNSTILE_SECRET_KEY`
- Defined in server-only `public_html/api/config.php`
- Placeholder documented in `public_html/api/config.example.php`
- Verification endpoint:
  - `https://challenges.cloudflare.com/turnstile/v0/siteverify`

## Implemented PHP Endpoint Fixes

Updated `public_html/api/contact-request.php`:

- Validates JSON request bodies and returns a clear JSON error for invalid JSON.
- Validates:
  - `full_name`
  - `phone`
  - optional `email`
  - required `service_type`
  - `message`
  - `turnstileToken`
- Verifies Turnstile server-side before any database insert.
- Fails safely if `TURNSTILE_SECRET_KEY` is missing, empty, or still set to `TURNSTILE_SECRET_KEY_HERE`.
- Returns clear JSON errors through the existing `json_error()` response helper.
- Inserts successful submissions into `ak_contact_requests`.
- Creates a related `ak_notifications` row for the admin panel.

Updated `public_html/api/config.example.php`:

- Documents that `TURNSTILE_SECRET_KEY` is required by `POST /api/contact-request.php`.
- Keeps only a placeholder value; real secrets belong in server-only `config.php`.

## Required Server Configuration

Production must have `public_html/api/config.php` copied from `config.example.php` with real values:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', '...');
define('DB_USER', '...');
define('DB_PASS', '...');
define('TURNSTILE_SECRET_KEY', 'real-cloudflare-turnstile-secret');
```

The Turnstile secret must belong to the same Cloudflare Turnstile site configuration as the frontend `VITE_TURNSTILE_SITE_KEY`.

## Verification

- `npm run build` completed successfully.

## Remaining Notes

- The admin contacts page is still outside Phase B and may still depend on Supabase until its own migration phase.
- PHP CLI was not available locally, so PHP syntax linting could not be run in this environment.
