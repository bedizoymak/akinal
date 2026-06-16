# Config Restore Report

## Scope

- Target file: `public_html/api/config.php`
- Objective: verify hosting config safety after accidental overwrite and restore only `config.php` from a known-good backup if needed.
- Secrets printed: none
- Database writes: none
- Migrations: none
- Schema changes: none

## Live Config Verification

The live hosting file was downloaded over FTP to a temporary local path and inspected without printing credential values.

| Check | Result |
| --- | --- |
| Remote `public_html/api/config.php` exists | PASS |
| Remote file equals local `public_html/api/config.php` | YES |
| Remote file equals `config.example.php` | NO |
| Remote file contains example/local-marker text | YES |
| `DB_NAME` matches expected `akinalin_wp282` | YES |
| `CANONICAL_READ_MODEL_ENABLED` explicitly enabled | NO |
| `CANONICAL_SETTLEMENT_ENABLED` explicitly enabled | NO |

Interpretation:

The file is present and appears to contain the expected production database name with canonical read/settlement disabled, but it is byte-identical to the local `public_html/api/config.php` and contains an example-config header/local-marker text. Because the previous deploy overwrote `config.php`, this cannot be accepted as a trusted production baseline without a known-good backup or hosting control-panel confirmation.

## Known-Good Backup Search

FTP directory inspection found only:

- `public_html/api/config.php`
- `public_html/api/config.example.php`

No adjacent known-good backup file such as `config.php.bak`, `config.php.old`, `config.local.php`, or another baseline was available via FTP.

## Restore Action

No restore was performed.

Reason:

There is no known-good backup/baseline available in the workspace or adjacent hosting FTP directory. Restoring by inventing or reconstructing a production config would risk replacing one uncertain state with another. The safe next action is to restore/confirm `public_html/api/config.php` from the hosting provider backup, file manager history, cPanel backup, or another trusted operator-held baseline.

## Read-Only Live Health Checks

Existing read-only endpoints were checked after the config verification:

| Endpoint | Result |
| --- | --- |
| `/api/projects.php` | HTTP `200`, JSON |
| `/api/site-settings.php` | HTTP `200`, JSON |
| `/api/admin/canonical-read-diagnostics.php` unauthenticated | HTTP `401`, JSON |

These checks show the current config can serve read-only public APIs and the diagnostics endpoint remains auth-protected, but they do not prove the config file is the intended trusted production baseline.

## Deploy Script Hardening

Patched `scripts/deploy_ftp.py` to permanently skip protected config/env files:

- `public_html/api/config.php`
- `public_html/api/config.local.php`
- `.env`
- `.env.local`

Additional hardening:

- Replaced the stale hard-coded local root path with a repo-relative root:
  - `ROOT = Path(__file__).resolve().parents[1]`
- Protected files print `SKIP protected` during deployment.

Validation note:

Python is not installed in this Windows environment, so the script could not be executed for syntax validation here. The patch was inspected textually.

## Safety Confirmation

- No secrets were printed.
- No database writes were performed.
- No migrations were executed.
- No schema changes were made.
- No canonical read cutover was enabled.
- No canonical settlement activation was enabled.
- No auth bypass was added.

## Required Next Step

Restore or confirm `public_html/api/config.php` from a trusted hosting-side source:

- hosting provider backup,
- cPanel/file-manager history,
- operator-held known-good baseline,
- or another trusted production backup.

After that, re-run a read-only config verification and full authenticated diagnostics verification.

## Final Decision

STILL_BLOCKED

