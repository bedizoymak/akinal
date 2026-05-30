# Admin User Migration Note

Do not copy Supabase Auth passwords into MySQL.

Supabase Auth stores password credentials in its managed auth schema and should not be treated as portable application data. The PHP/MySQL admin system must create fresh local admin accounts in `ak_admin_users`.

## Recommended Admin Creation

Create a new PHP-side admin user with:

- `id`: generated UUID v4.
- `email`: admin email address.
- `email_lower`: `strtolower(email)`.
- `password_hash`: generated with PHP `password_hash($password, PASSWORD_DEFAULT)`.
- `role`: `admin`.
- `is_active`: `1`.

Use `password_verify()` during login.

## Example

```php
$email = 'admin@example.com';
$passwordHash = password_hash('temporary-strong-password', PASSWORD_DEFAULT);

// Insert into ak_admin_users with email_lower = strtolower($email).
```

Replace any temporary password immediately after first login.

## What Not To Do

- Do not export or import `auth.users` password hashes.
- Do not store plaintext passwords.
- Do not commit admin credentials.
- Do not create admin users from browser-side JavaScript.
- Do not rely on old Supabase user sessions after the PHP auth migration.
