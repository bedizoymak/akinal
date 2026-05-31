# Phase B Contact Form Migration Report

Date: 2026-05-30

## Scope

Implemented Phase B for the public contact form.

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

The React form posts validated contact fields directly to the PHP API.

## Implemented PHP Endpoint Fixes

Updated `public_html/api/contact-request.php`:

- Validates JSON request bodies and returns a clear JSON error for invalid JSON.
- Validates:
  - `full_name`
  - `phone`
  - optional `email`
  - required `service_type`
  - `message`
- Returns clear JSON errors through the existing `json_error()` response helper.
- Inserts successful submissions into `ak_contact_requests`.
- Creates a related `ak_notifications` row for the admin panel.

Updated `public_html/api/config.example.php`:

- Keeps only placeholder values; real secrets belong in server-only `config.php`.

## Required Server Configuration

Production must have `public_html/api/config.php` copied from `config.example.php` with real values:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', '...');
define('DB_USER', '...');
define('DB_PASS', '...');
```

## Verification

- `npm run build` completed successfully.

## Remaining Notes

- The admin contacts page is still outside Phase B and may still depend on Supabase until its own migration phase.
- PHP CLI was not available locally, so PHP syntax linting could not be run in this environment.
