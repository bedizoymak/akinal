# Phase 5C-D2 Diagnostics Deployment Verification

## Scope

- Phase: 5C-D2
- Objective: restore FTP access in the current environment and deploy only the read-only diagnostics files needed for server-side shadow verification.
- Rules followed: no FTP password printed, no `public_html/api/config.php` overwrite, no DB writes, no migrations, no schema changes, no cutover, no settlement activation.

## FTP Credential Restore

`AKINAL_FTP_PASS` was available in the Windows user environment but not in the current process environment. It was loaded silently for the upload operation only. The password was not printed.

## Deployed Files

Uploaded by FTP:

- `public_html/api/admin/canonical-read-diagnostics.php`
- `public_html/api/admin/canonical-read-flags.php`
- `public_html/api/admin/backend-canonical-read-model.php`
- `public_html/api/admin/canonical-finance-service.php`
- `public_html/api/admin/dashboard.php`
- `public_html/api/admin/reports.php`
- `public_html/api/admin/notifications.php`
- `public_html/api/admin/payments.php`
- `public_html/api/admin/payment-plans.php`
- `public_html/api/admin/financial-statement.php`

Explicitly not uploaded:

- `public_html/api/config.php`

## Local Pre-Deploy Validation

PHP lint passed for all deployed PHP files before upload.

## Live Endpoint Verification

| Check | Result |
| --- | --- |
| `GET /api/admin/canonical-read-diagnostics.php` no longer returns SPA HTML | PASS |
| Endpoint returns PHP JSON response | PASS |
| Endpoint is protected by admin authentication | PASS |
| Unauthenticated response | HTTP 401 JSON: `Authentication required.` |

Observed response headers/body confirm:

- HTTP status: `401 Unauthorized`
- Content-Type: `application/json; charset=utf-8`
- Body shape: JSON error response

## Shadow Diagnostics Status

Full diagnostics could not be executed because the endpoint requires an authenticated admin PHP session, and no admin credentials or session cookie were available in this environment.

No temporary access bypass was added. The endpoint remains protected by `require_admin()`.

## Required Authenticated Verification

From an authenticated admin browser/session, open:

```text
https://akinalinsaat.com/api/admin/canonical-read-diagnostics.php
```

Expected safe flags:

- `enabled = false`
- `shadow_compare = true`
- `fail_closed = true`
- `log_mismatches = true`

Expected diagnostics:

- dashboard summary: `PASS`
- dashboard overdue plans: `PASS`
- dashboard upcoming plans: `PASS`
- dashboard monthly financials: `PASS`
- reports aggregates: `PASS`
- mismatch counts: `0`, unless documented

## Cleanup

- Temporary access added: none
- Temporary access removed/disabled: not applicable
- Secrets printed: none
- Production data writes: none
- Migrations/schema changes: none
- Cutover/activation: none

## Final Decision

BLOCKED

Reason: deployment succeeded and the endpoint now returns JSON instead of SPA HTML, but full server-side shadow diagnostics still require an authenticated admin session. No temporary bypass was added, and no admin session was available in this environment.
