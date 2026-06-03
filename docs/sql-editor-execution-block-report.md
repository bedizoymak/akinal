# Finding

- `/admin/sql-editor` renders, but execution is blocked by the PHP API endpoint before SQL parsing or database execution.
- The blocking message is returned directly by `public_html/api/admin/sql-editor.php`.
- `ENABLE_ADMIN_SQL_EDITOR` is a PHP constant, not a Vite/React environment variable.

# Blocking Condition

- Runtime check: `!defined('ENABLE_ADMIN_SQL_EDITOR') || ENABLE_ADMIN_SQL_EDITOR !== true`
- When that condition is true, the endpoint returns HTTP 403 with `SQL editör üretim ortamında devre dışı.`
- Local `public_html/api/config.php` exists, but the `ENABLE_ADMIN_SQL_EDITOR` constant was not found there.
- The committed example config defines `ENABLE_ADMIN_SQL_EDITOR` as `false`.

# Exact File

- Blocking endpoint: `public_html/api/admin/sql-editor.php`
- Blocking lines: `public_html/api/admin/sql-editor.php:9-10`
- Config loader: `public_html/api/db.php`
- Runtime config file: `public_html/api/config.php`
- Example config file: `public_html/api/config.example.php`

# Recommended Fix

- Minimum change: define `ENABLE_ADMIN_SQL_EDITOR` as `true` in the server-only `public_html/api/config.php`.
- Do not change `config.example.php` unless documenting defaults; it should remain disabled by default.
- Do not change the React page or route.
- Keep access restricted to authenticated admins through the existing frontend admin guard and backend `require_admin()` check.
