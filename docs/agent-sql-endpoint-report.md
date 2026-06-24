# Agent SQL Endpoint — Implementation Report

## Purpose

This endpoint exists solely to allow a local agent (Claude/Codex) to execute
reviewed SQL against the production MySQL database during a maintenance window.

`DB_HOST=localhost` is not externally reachable from outside the server, and
cPanel/SSH access is not available. This PHP endpoint runs on the server where
MySQL is accessible as `localhost`, bridging that gap securely.

**This is a temporary file. Remove or disable it when maintenance is complete.**

---

## File Location

```
public_html/api/admin/agent-sql.php
```

---

## Config Changes Required Before Use

Add both constants to `public_html/api/config.php` on the production server:

```php
define('ENABLE_AGENT_SQL_ENDPOINT', true);
define('AGENT_SQL_TOKEN', 'replace-with-a-long-random-secret');
```

Generate a strong token (example — generate your own):
```bash
openssl rand -hex 32
```

Do **not** commit real token values to the repository.

---

## Authentication

- No browser PHP session required.
- Token is sent as HTTP header: `X-Agent-SQL-Token: <token>`
- Verified server-side with `hash_equals()` (timing-safe comparison).
- If `AGENT_SQL_TOKEN` is not defined or empty, the endpoint refuses all requests.

---

## Safety Rules

| Rule | Detail |
|------|--------|
| Feature flag | Requires `ENABLE_AGENT_SQL_ENDPOINT === true` in `config.php` |
| Token auth | `X-Agent-SQL-Token` header must match `AGENT_SQL_TOKEN` |
| POST only | Any other HTTP method returns 405 |
| Single statement | Semicolon-separated multi-statement input is rejected |
| Empty SQL | Rejected |
| Comments-only SQL | Rejected |
| Non-SELECT | Requires `confirmed: true` in request body |
| Audit log | Every execution is logged via `error_log()` with timestamp, type, and SQL snippet |
| Error sanitization | DB credentials are redacted from any PDO error messages returned to caller |

---

## Request Format

```
POST /api/admin/agent-sql.php
Content-Type: application/json
X-Agent-SQL-Token: <token>

{
  "sql": "SELECT ...",
  "confirmed": false
}
```

`confirmed: true` is required for any non-SELECT statement (INSERT, UPDATE, DELETE, CREATE, DROP, TRUNCATE, ALTER).

---

## Response Format

```json
{
  "success": true,
  "statement_type": "SELECT",
  "destructive": false,
  "columns": ["id", "email"],
  "rows": [{ "id": "...", "email": "..." }],
  "row_count": 1,
  "affected_rows": null,
  "executed_at": "2026-06-24T17:00:00+00:00"
}
```

For write statements, `columns` and `rows` are empty arrays, and `affected_rows` contains the row count.

---

## curl Examples

### SELECT — preview customers (safe, no confirmation needed)

```bash
curl -s -X POST https://akinalinsaat.com/api/admin/agent-sql.php \
  -H "Content-Type: application/json" \
  -H "X-Agent-SQL-Token: YOUR_TOKEN_HERE" \
  -d '{
    "sql": "SELECT id, customer_type, full_name, company_name, email FROM ak_customers WHERE email IN (\"test.bireysel@example.com\", \"test.kurumsal@example.com\")",
    "confirmed": false
  }' | python -m json.tool
```

### DELETE — requires confirmed: true

```bash
curl -s -X POST https://akinalinsaat.com/api/admin/agent-sql.php \
  -H "Content-Type: application/json" \
  -H "X-Agent-SQL-Token: YOUR_TOKEN_HERE" \
  -d '{
    "sql": "DELETE FROM ak_customers WHERE email IN (\"test.bireysel@example.com\", \"test.kurumsal@example.com\")",
    "confirmed": true
  }' | python -m json.tool
```

---

## Disable / Remove Checklist

After maintenance is complete, do **one** of the following:

**Option A — Delete the file (recommended):**
```
Delete public_html/api/admin/agent-sql.php from the server via FTP/file manager.
```

**Option B — Disable via config (if you want to keep the file for future use):**
```php
define('ENABLE_AGENT_SQL_ENDPOINT', false);
```

In either case, also remove `AGENT_SQL_TOKEN` from `config.php` so no valid token exists even if the file is accidentally restored.

---

## Server-Side Log Format

Every execution produces an `error_log()` entry in the server PHP error log:

```
[agent-sql] executed at 2026-06-24T17:00:00+00:00 | type=DELETE | destructive=no | sql=DELETE FROM ak_customers WHERE ...
```

---

## What This Endpoint Does NOT Do

- Does not use or check `ak_admin_users` / PHP session authentication.
- Does not touch `ENABLE_ADMIN_SQL_EDITOR` — the two endpoints are independent.
- Does not expose DB credentials or internal server paths in responses.
- Does not allow multiple statements in a single request.
