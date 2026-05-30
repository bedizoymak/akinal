# PHP API Foundation Report

## Summary

Phase 2 added a same-domain PHP API foundation under `public_html/api` and three read-only public endpoints backed by the `ak_` MySQL tables. No frontend files, visual design, Supabase package files, or production credentials were changed.

## Files Created

- `public_html/api/config.example.php`
- `public_html/api/db.php`
- `public_html/api/response.php`
- `public_html/api/auth.php`
- `public_html/api/router-notes.md`
- `public_html/api/site-settings.php`
- `public_html/api/projects.php`
- `public_html/api/project-detail.php`
- `docs/supabase-dependency-map.md`
- `docs/php-api-foundation-report.md`

## What Each PHP File Does

`config.example.php`:
Defines placeholder database constants for `localhost`, `akinalin_wp282`, `MYSQL_USERNAME_HERE`, and `MYSQL_PASSWORD_HERE`. Production should copy this to `config.php` on the server only.

`db.php`:
Loads server-only `config.php`, checks `pdo_mysql`, creates a PDO connection with `utf8mb4`, sets `ERRMODE_EXCEPTION`, disables emulated prepares, and returns safe JSON errors without exposing credentials.

`response.php`:
Provides `json_success($data = [], $status = 200)`, `json_error($message, $status = 400, $details = null)`, JSON headers, and a small `require_method()` helper. It does not add wildcard CORS headers because the intended deployment is same-domain.

`auth.php`:
Starts secure PHP sessions and provides `require_admin()`, `current_admin()`, and `is_admin_logged_in()`. Full admin login is intentionally left for the next phase.

`site-settings.php`:
GET-only endpoint that reads the first/current row from `ak_site_settings`.

`projects.php`:
GET-only endpoint that returns published projects from `ak_projects`, sorted by `sort_order ASC, created_at DESC`.

`project-detail.php`:
GET-only endpoint requiring `slug`. It returns one published project plus ordered images from `ak_project_images`, or a 404 JSON response if not found.

## Exact API Endpoints Created

- `GET /api/site-settings.php`
- `GET /api/projects.php`
- `GET /api/project-detail.php?slug=example-project`

## Example JSON Responses

`GET /api/site-settings.php`:

```json
{
  "success": true,
  "data": {
    "settings": {
      "id": "uuid",
      "company_name": "Akinal İnşaat",
      "phone": "+90 000 000 00 00"
    }
  }
}
```

`GET /api/projects.php`:

```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "title": "Project title",
        "slug": "project-slug",
        "short_description": "Summary",
        "project_type": "Konut",
        "project_status": "Devam Ediyor",
        "location": "İstanbul",
        "city": "İstanbul",
        "district": "Fatih",
        "cover_image_url": "/uploads/project.jpg",
        "is_featured": 1,
        "sort_order": 1,
        "created_at": "2026-05-30 12:00:00",
        "updated_at": "2026-05-30 12:00:00"
      }
    ]
  }
}
```

`GET /api/project-detail.php?slug=project-slug`:

```json
{
  "success": true,
  "data": {
    "project": {
      "id": "uuid",
      "title": "Project title",
      "slug": "project-slug",
      "is_published": 1
    },
    "images": [
      {
        "id": "uuid",
        "project_id": "uuid",
        "image_url": "/uploads/project.jpg",
        "sort_order": 0
      }
    ]
  }
}
```

404 example:

```json
{
  "success": false,
  "message": "Project not found."
}
```

## Shared Hosting Deployment

1. Upload the `public_html/api` folder to the hosting account.
2. On the server, copy `public_html/api/config.example.php` to `public_html/api/config.php`.
3. Replace placeholders in the server-only `config.php`.
4. Confirm `config.php` is not committed to Git.
5. Call the public endpoints from the same domain with relative URLs.

## Creating Server-Only config.php

Use `config.example.php` as the template:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'akinalin_wp282');
define('DB_USER', 'MYSQL_USERNAME_HERE');
define('DB_PASS', 'MYSQL_PASSWORD_HERE');
```

Only the server copy should contain real credentials.

## Security Notes

- Do not commit `config.php`.
- Do not commit real credentials.
- Keep API calls same-domain unless a real CORS requirement appears.
- Admin endpoints must call `require_admin()` when implemented.
- Login must use `password_hash()` and `password_verify()`.
- Admin lookup should use `ak_admin_users.email_lower = strtolower(email)` and require `is_active = 1`.
- Public write endpoints must validate input and rate-limit or add bot protection where appropriate.
- Contact requests must verify Turnstile server-side before insert.
- Upload endpoints must validate file type, size, path, and executable restrictions.

## What Was Not Implemented Yet

- No frontend Supabase calls were replaced.
- No Supabase package or integration files were removed.
- No admin login/logout endpoint was implemented.
- No public POST endpoints were implemented.
- No admin CRUD endpoints were implemented.
- No upload/storage replacement was implemented.
- No data migration from Supabase was implemented.
- No production credentials were added.

## Validation

- PHP CLI validation was not run because `php` is not available in this workspace.
- Run `php -l public_html/api/*.php` on a PHP-enabled environment before deployment.
- TypeScript/build validation was not required because no TypeScript files were changed.

## Next Recommended Phase

Phase 3 should implement PHP admin authentication:

- `POST /api/admin/login.php`
- `POST /api/admin/logout.php`
- `GET /api/admin/me.php`
- Session-backed `require_admin()` protection
- Password verification against `ak_admin_users`

After that, migrate the public frontend reads to the new read-only PHP endpoints.
