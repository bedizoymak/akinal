# Change

- Enabled SQL Editor execution by defining `ENABLE_ADMIN_SQL_EDITOR` as `true` in `public_html/api/config.php`.
- No SQL editor UI changes were made.
- No admin menu entry was added.
- Existing admin session, POST-only, and SQL confirmation protections were left unchanged.
- Note: `public_html/api/config.php` is intentionally ignored by git because it contains server credentials.

# Validation

- `npm run build` passed.
- `git status` checked after the change.

# Risk

- SQL execution is now available to authenticated admins when the backend endpoint is reachable.
- Keep access limited to trusted administrators only.
- Disable the flag again after the temporary admin use window if this access is no longer needed.
