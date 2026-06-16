# Phase 5C-G Canonical Metadata Comparator Fix

## Scope

- Target: shadow comparator mismatch scoring for canonical-only metadata fields.
- Fields excluded from mismatch scoring:
  - `canonical_is_overdue`
  - `canonical_status`
- Diagnostics output fields removed: no
- Production DB writes: none
- Migrations: none
- Schema changes: none
- Read cutover: none
- Production data changed: no

## Fix

Updated `public_html/api/admin/canonical-read-flags.php` so `canonical_read_compare()` ignores exactly these canonical-only metadata keys while scoring legacy/canonical mismatches:

- `canonical_is_overdue`
- `canonical_status`

The fields remain present in canonical diagnostics output. They are only excluded from mismatch scoring because legacy rows do not carry those canonical metadata fields.

## Related Comparator State

The Phase 5C-F comparator fixes remain in place:

- row lists with `id` compare by stable `id` instead of numeric array index
- overdue definition uses `remaining_amount > 0` and `due_date < today`
- plan lists sort deterministically by due date, customer, account type, and id

## Deployment

Uploaded only:

- `public_html/api/admin/canonical-read-flags.php`

Explicitly not touched:

- `public_html/api/config.php`
- database data
- schema
- migrations
- cutover flags

## Validation

Local validation:

| Check | Result |
| --- | --- |
| `php -l public_html/api/admin/canonical-read-flags.php` | PASS |
| `php -l public_html/api/admin/canonical-read-diagnostics.php` | PASS |
| `php tools/canonical-read-flags-test.php` | PASS |
| `php tools/backend-canonical-read-model-parity-test.php` | PASS |

Regression coverage added:

| Test | Result |
| --- | --- |
| Canonical-only metadata fields do not count as mismatches | PASS |
| ID-keyed list comparison ignores array order | PASS |
| Partially paid overdue plans remain overdue by remaining balance | PASS |

Hosting endpoint protection check:

| Check | Result |
| --- | --- |
| Unauthenticated `/api/admin/canonical-read-diagnostics.php` returns JSON | PASS |
| Endpoint remains admin-auth protected | PASS |

## Authenticated Diagnostics

The required authenticated diagnostics rerun could not be completed from this environment because no real admin session or credential variables are available.

| Source | Result |
| --- | --- |
| `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD` | Not present |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Not present |
| `AKINAL_ADMIN_EMAIL` / `AKINAL_ADMIN_PASSWORD` | Not present |
| Existing authenticated session cookie | Not available |

No credentials or cookies were printed. No auth bypass was added.

## Expected Result After Authenticated Rerun

Expected diagnostics after logging in with a real admin session:

| Surface | Expected |
| --- | --- |
| `dashboard.summary` | PASS |
| `dashboard.overdue_plans` | PASS |
| `dashboard.upcoming_plans` | PASS |
| Total `mismatch_count` | `0` |

## Final Decision

BLOCKED

Reason: the comparator fix is implemented, tested, and deployed, but `READY_FOR_PHASE_5D` requires an authenticated diagnostics rerun that cannot be performed without a real admin session.

