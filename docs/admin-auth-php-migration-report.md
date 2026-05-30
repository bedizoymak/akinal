# Admin Auth PHP Migration Report

## Files Created

- `public_html/api/admin/login.php`
- `public_html/api/admin/logout.php`
- `public_html/api/admin/me.php`
- `public_html/create-admin-user.php`

## Files Updated

- `public_html/api/auth.php`
- `public_html/api/config.example.php`
- `public_html/api/db.php`
- `src/hooks/useAuth.ts`
- `src/pages/admin/AdminAuth.tsx`
- `src/components/admin/AdminLayout.tsx`
- `src/lib/apiClient.ts`
- `src/lib/apiTypes.ts`

## How Admin Auth Works

Admin login now uses PHP sessions and `ak_admin_users`.

`POST /api/admin/login.php` accepts JSON:

```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

The endpoint normalizes the email, looks up `ak_admin_users.email_lower`, requires `is_active = 1`, verifies the password with `password_verify()`, and stores only safe fields in `$_SESSION['admin']`.

The session cookie is configured as:

- `HttpOnly`
- `SameSite=Lax`
- `Secure` only when HTTPS is detected

`GET /api/admin/me.php` returns the current session admin or `401`.

`POST /api/admin/logout.php` clears and destroys the session.

## First Admin Creation

Upload `public_html/create-admin-user.php` temporarily, then open:

```text
/create-admin-user.php?confirm=CREATE_AKINAL_ADMIN
```

Create the admin account from the form or by POSTing JSON. The script:

- requires a valid email
- requires a password of at least 10 characters
- hashes with `password_hash(..., PASSWORD_DEFAULT)`
- sets `role = admin`
- sets `is_active = 1`
- upserts by `email_lower`

Delete `create-admin-user.php` immediately after the admin account is created.

## Schema Note

The committed MySQL installer currently defines `ak_admin_users` without `full_name`. The PHP code detects whether `full_name` exists and uses it only when available. This keeps compatibility with the current deployed schema.

## Not Implemented Yet

Admin CRUD pages still use Supabase for database and storage operations. This phase only migrates admin login/session behavior.
