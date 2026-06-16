# Phase 5C-R Server-Side Canonical Read Shadow Verification

## Scope

- Phase: 5C-R
- Objective: run true hosting-side canonical read diagnostics while canonical reads remain disabled.
- Required endpoint: `GET /api/admin/canonical-read-diagnostics.php`
- Required flags:
  - `CANONICAL_READ_MODEL_ENABLED=false`
  - `CANONICAL_READ_MODEL_SHADOW_COMPARE=true`
  - `CANONICAL_READ_MODEL_FAIL_CLOSED=true`
  - `CANONICAL_READ_MODEL_LOG_MISMATCHES=true`
- Rules followed: no writes, no migrations, no schema changes, no cutover, no settlement activation, no secrets printed.

## Attempted Server-Side Verification

The production API host was probed over HTTPS.

| URL | Result | Interpretation |
| --- | --- | --- |
| `https://akinalinsaat.com/api/projects.php` | HTTP 200, `application/json` | Production PHP API is reachable |
| `https://akinalinsaat.com/api/admin/login.php` | HTTP 405 for GET | Admin PHP endpoint is reachable and method-gated |
| `https://akinalinsaat.com/api/admin/canonical-read-diagnostics.php` | HTTP 200, `text/html` SPA shell | Diagnostics endpoint is not deployed or is being caught by the SPA fallback |

## Verification Result By Surface

Because the diagnostics endpoint did not execute on hosting, no production-equivalent mismatch statistics were available.

| Surface | Verification Status | Notes |
| --- | --- | --- |
| Dashboard | BLOCKED | Diagnostics endpoint unavailable on hosting |
| Reports | BLOCKED | Diagnostics endpoint unavailable on hosting |
| Notifications | BLOCKED | Diagnostics endpoint unavailable on hosting |
| Payments | BLOCKED | Diagnostics endpoint unavailable on hosting |
| Payment plans | BLOCKED | Diagnostics endpoint unavailable on hosting |
| Financial statement | BLOCKED | Diagnostics endpoint unavailable on hosting |

## Mismatch Statistics

No hosting-side diagnostic payload was returned.

| Class | Count | Status |
| --- | ---: | --- |
| Rounding | Not available | BLOCKED |
| Allocation | Not available | BLOCKED |
| Status | Not available | BLOCKED |
| Overdue | Not available | BLOCKED |
| Duplicate counting | Not available | BLOCKED |
| Legacy data quality | Not available | BLOCKED |

## Access And Deployment Findings

- Local files exist:
  - `public_html/api/admin/canonical-read-diagnostics.php`
  - `public_html/api/admin/canonical-read-flags.php`
- Both files are currently untracked locally, which indicates they may not have been deployed.
- The FTP deploy script requires `AKINAL_FTP_PASS`.
- `AKINAL_FTP_PASS` was not available in the current environment.
- No temporary public access endpoint was added.
- No temporary access required cleanup.

## Required Next Action

Deploy the Phase 5B backend files to hosting without changing production data:

- `public_html/api/admin/canonical-read-diagnostics.php`
- `public_html/api/admin/canonical-read-flags.php`
- touched read endpoints from Phase 5B if not already deployed
- `public_html/api/config.example.php` is documentation only; do not overwrite server `config.php`

Then confirm server-only `public_html/api/config.php` defines or otherwise inherits:

```php
define('CANONICAL_READ_MODEL_ENABLED', false);
define('CANONICAL_READ_MODEL_SHADOW_COMPARE', true);
define('CANONICAL_READ_MODEL_FAIL_CLOSED', true);
define('CANONICAL_READ_MODEL_LOG_MISMATCHES', true);
define('CANONICAL_SETTLEMENT_ENABLED', false);
```

Finally, run:

```text
GET https://akinalinsaat.com/api/admin/canonical-read-diagnostics.php
```

from an authenticated admin session and capture only the sanitized diagnostic result.

## GO Criteria

Phase 5D may proceed only when:

1. Diagnostics endpoint returns JSON, not SPA HTML.
2. The response confirms `CANONICAL_READ_MODEL_ENABLED=false`.
3. The response confirms shadow comparison is enabled.
4. Every diagnostics report returns `PASS`.
5. Every mismatch count is `0`, or each mismatch is documented and explicitly accepted.
6. No writes, migrations, schema changes, settlement activation, or cutover occur.

## Final Decision

BLOCKED

Reason: the live diagnostics endpoint did not execute on hosting. It returned the SPA shell instead of JSON, so true server-side shadow verification has not yet been completed.
