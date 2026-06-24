# Agent Production Capability Regression Test

**Project:** akinalinsaat.com  
**Companion to:** [docs/agent-production-access-handover.md](agent-production-access-handover.md)  
**Purpose:** Every future session must be able to prove that production access still works before issuing any write SQL.

Run this test suite at the start of any maintenance session. All tests are read-only or reversible. Complete them in order — each section gates the next.

---

## 1. Read-Only SQL Tests

These confirm the endpoint is live, the token is valid, and the DB is reachable. No `confirmed: true` required.

### Test 1.1 — Minimal connectivity (`SELECT 1`)

```bash
curl -s -X POST https://akinalinsaat.com/api/admin/agent-sql.php \
  -H "Content-Type: application/json" \
  -H "X-Agent-SQL-Token: <AGENT_SQL_TOKEN>" \
  -d '{"sql": "SELECT 1 AS ping", "confirmed": false}' \
  | python -m json.tool
```

**Expected response:**
```json
{
  "success": true,
  "statement_type": "SELECT",
  "rows": [{"ping": "1"}],
  "row_count": 1
}
```

**Pass condition:** `success === true` and `row_count === 1`.

---

### Test 1.2 — DB table access (`SHOW TABLES`)

```bash
curl -s -X POST https://akinalinsaat.com/api/admin/agent-sql.php \
  -H "Content-Type: application/json" \
  -H "X-Agent-SQL-Token: <AGENT_SQL_TOKEN>" \
  -d '{"sql": "SHOW TABLES", "confirmed": false}' \
  | python -m json.tool
```

**Expected response:** `success === true`, `row_count >= 10` (production has 21 tables).

**Pass condition:** `ak_customers` appears in the rows.

---

### Test 1.3 — Customer table access

```bash
curl -s -X POST https://akinalinsaat.com/api/admin/agent-sql.php \
  -H "Content-Type: application/json" \
  -H "X-Agent-SQL-Token: <AGENT_SQL_TOKEN>" \
  -d '{"sql": "SELECT COUNT(*) AS total FROM ak_customers", "confirmed": false}' \
  | python -m json.tool
```

**Pass condition:** `success === true`, `rows[0].total` is a non-negative integer. Note the value as a baseline — if it changes unexpectedly between sessions, investigate before writing.

---

### Test 1.4 — Projects table access

```bash
curl -s -X POST https://akinalinsaat.com/api/admin/agent-sql.php \
  -H "Content-Type: application/json" \
  -H "X-Agent-SQL-Token: <AGENT_SQL_TOKEN>" \
  -d '{"sql": "SELECT COUNT(*) AS total FROM ak_projects", "confirmed": false}' \
  | python -m json.tool
```

**Pass condition:** `success === true`, `rows[0].total` is a non-negative integer. As of 2026-06-24, production had 3 projects. If this returns 0, stop — something is wrong with DB access or the schema.

---

## 2. FTP Tests

These confirm the deploy path works before you need it for a real deploy. Uses a harmless probe file with no effect on the application.

### Test 2.1 — Upload probe file

Write and run the following Python snippet (adapt path as needed):

```python
import io, os
from ftplib import FTP

ftp = FTP()
ftp.connect("ftp.akinalinsaat.com", 21, timeout=30)
ftp.login("unalc@akinalinsaat.com", os.environ["AKINAL_FTP_PASS"])

content = b"# agent-probe — safe to delete\n"
ftp.storbinary("STOR /public_html/api/admin/agent-probe.txt", io.BytesIO(content))
print("Upload OK")
ftp.quit()
```

**Pass condition:** No exception, prints `Upload OK`.

---

### Test 2.2 — Verify probe file exists via curl

```bash
curl -s -o /dev/null -w "%{http_code}" \
  https://akinalinsaat.com/api/admin/agent-probe.txt
```

**Pass condition:** HTTP 200.

> Note: If the `api/admin/` directory is protected (e.g. `.htaccess` blocks direct access), you may get 403 even though the upload succeeded. In that case, verify via FTP `NLST` instead:
> ```python
> ftp.cwd("/public_html/api/admin")
> print(ftp.nlst())  # agent-probe.txt should appear
> ```

---

### Test 2.3 — Delete probe file

```python
import os
from ftplib import FTP

ftp = FTP()
ftp.connect("ftp.akinalinsaat.com", 21, timeout=30)
ftp.login("unalc@akinalinsaat.com", os.environ["AKINAL_FTP_PASS"])
ftp.delete("/public_html/api/admin/agent-probe.txt")
print("Delete OK")
ftp.quit()
```

**Pass condition:** No exception, prints `Delete OK`. Probe file is gone from server.

---

## 3. Endpoint Security Tests

Run these to confirm auth is working correctly — not just the happy path.

### Test 3.1 — Valid token (baseline)

Already covered by Test 1.1. Must pass before proceeding to 3.2 and 3.3.

---

### Test 3.2 — Invalid token (must be rejected)

```bash
curl -s -X POST https://akinalinsaat.com/api/admin/agent-sql.php \
  -H "Content-Type: application/json" \
  -H "X-Agent-SQL-Token: invalid-token-value" \
  -d '{"sql": "SELECT 1", "confirmed": false}' \
  | python -m json.tool
```

**Expected response:**
```json
{
  "success": false,
  "error": "Unauthorized."
}
```

**Pass condition:** HTTP 401, `success === false`. If this returns `success: true`, the endpoint auth is broken — **stop immediately and disable the endpoint**.

---

### Test 3.3 — Disabled endpoint check (optional, for after disabling)

After setting `ENABLE_AGENT_SQL_ENDPOINT = false` in production `config.php`, run:

```bash
curl -s -X POST https://akinalinsaat.com/api/admin/agent-sql.php \
  -H "Content-Type: application/json" \
  -H "X-Agent-SQL-Token: <AGENT_SQL_TOKEN>" \
  -d '{"sql": "SELECT 1", "confirmed": false}' \
  | python -m json.tool
```

**Expected response:**
```json
{
  "success": false,
  "error": "Agent SQL endpoint is disabled."
}
```

**Pass condition:** HTTP 403, `success === false`. Confirms the feature flag works.

---

## 4. Recovery Matrix

Use this table when a test fails. Work top to bottom — each row assumes the rows above it passed.

| Failure | Symptoms | Recovery steps |
|---|---|---|
| **`AKINAL_FTP_PASS` not set** | Python FTP script exits immediately: `AKINAL_FTP_PASS env variable is not set.` | Set the env var: PowerShell: `$env:AKINAL_FTP_PASS = "..."` / bash: `export AKINAL_FTP_PASS=...`. Then retry. |
| **FTP connection refused / timeout** | `ftplib.error_perm` or socket timeout | Check hosting status at cPanel. Confirm port 21 is not blocked by a local firewall. Try passive mode: add `ftp.set_pasv(True)` before `connect()`. |
| **FTP login failed** | `ftplib.error_perm: 530 Login incorrect` | Confirm `AKINAL_FTP_PASS` value is correct. Reset via cPanel → FTP Accounts if needed. |
| **Permissions missing in `.claude/settings.json`** | Claude prompts for approval on every `Bash(python ...)` or `Bash(curl ...)` call | Open `.claude/settings.json`, add the four `allow` entries from section 3 of the handover doc. Restart the Claude Code session. |
| **Endpoint missing (404)** | `curl` returns HTML 404 or empty | `agent-sql.php` is not on the server. Upload it via FTP: `ftp.storbinary("STOR /public_html/api/admin/agent-sql.php", open("public_html/api/admin/agent-sql.php","rb"))`. Then check `config.php` constants (next row). |
| **Endpoint disabled (403 + "disabled" error)** | `{"success":false,"error":"Agent SQL endpoint is disabled."}` | FTP-patch `config.php`: change or add `define('ENABLE_AGENT_SQL_ENDPOINT', true);`. See handover doc section 7 step 4 for the full patch script. |
| **Token rejected (401)** | `{"success":false,"error":"Unauthorized."}` even with the correct token string | The token in `config.php` on the server no longer matches what you are sending. Possibilities: config was reset by cPanel restore, or token was rotated by another session. FTP-download `config.php` and inspect the `AGENT_SQL_TOKEN` value, then resend with the correct value. |
| **`AGENT_SQL_TOKEN` not configured (500)** | `{"success":false,"error":"Agent SQL token is not configured on the server."}` | `config.php` exists but the `AGENT_SQL_TOKEN` constant is missing or empty. FTP-patch `config.php` to add `define('AGENT_SQL_TOKEN', '<new-token>');`. |
| **DB connection error** | `{"success":false,"error":"SQL error (HY000 / 2002): ..."}` | MySQL is down or `config.php` DB credentials are wrong. Check cPanel → MySQL Databases. Do not attempt write SQL until connectivity is restored. |
| **`SELECT COUNT(*) FROM ak_projects` returns 0** | `rows[0].total === "0"` | Something is seriously wrong. Do not proceed. Verify the DB name in `config.php` matches `akinalin_wp282`. Run `SHOW TABLES` to confirm tables exist. |

---

## 5. Pre-Maintenance Checklist

Run before every maintenance session that involves write SQL.

```
[ ] AKINAL_FTP_PASS is set in the current shell
[ ] .claude/settings.json has all four allow entries (section 3 of handover doc)
[ ] Test 1.1 passed — SELECT 1 returns success: true
[ ] Test 1.2 passed — SHOW TABLES lists ak_customers
[ ] Test 1.3 passed — SELECT COUNT(*) FROM ak_customers returns a sane number
[ ] Test 1.4 passed — SELECT COUNT(*) FROM ak_projects returns the expected count
[ ] Test 3.2 passed — invalid token returns 401 (auth is enforced)
[ ] Preview SELECT has been reviewed before any DELETE or UPDATE
[ ] confirmed: true has NOT been sent yet this session
```

Only after all boxes are checked: proceed with write SQL.

---

## 6. Future Architecture Improvements

These are improvements that would eliminate the need for this endpoint entirely, or make it safer. Listed in order of impact vs. effort.

| Improvement | What it solves | Effort |
|---|---|---|
| **SSH access via cPanel Terminal** | Direct MySQL CLI access without a PHP bridge. Eliminates the token-auth surface entirely. | Low — enable in cPanel if hosting plan allows it. |
| **cPanel phpMyAdmin** | Manual SQL execution via browser. No custom code needed. Still requires cPanel login. | None — likely already available. |
| **Per-session token rotation** | Rotate `AGENT_SQL_TOKEN` at the start of every session, disable at the end. Limits the exposure window if the token leaks. | Low — add a `rotate-token.py` script to `scripts/`. |
| **IP allowlist in `.htaccess`** | Restrict `agent-sql.php` to only accept requests from your local IP. Eliminates token brute-force risk. | Low — add `Require ip <your-ip>` in `.htaccess` inside `api/admin/`. Dynamic IPs require updating before each session. |
| **Request rate limiting** | Limit the endpoint to N requests per minute at the server level. Reduces risk of accidental runaway loops. | Medium — requires `mod_ratelimit` or equivalent on the host. |
| **Allowlist of permitted SQL prefixes** | Reject anything that does not begin with SELECT, DELETE, or UPDATE. Prevents DROP / TRUNCATE / ALTER via this channel. | Low — add a check in `agent-sql.php` before the existing statement-type check. |
| **Automated endpoint disable on deploy** | Add a step to `scripts/deploy_ftp.py` that sets `ENABLE_AGENT_SQL_ENDPOINT = false` in `config.php` after every non-maintenance deploy. Prevents accidental re-enable. | Low — extend the deploy script. |
| **CI/CD pipeline** | Replace manual FTP deploy entirely. Enables atomic deploys, rollback, and audit trail. | High — requires GitHub Actions + SSH deploy key or cPanel Git integration. |
