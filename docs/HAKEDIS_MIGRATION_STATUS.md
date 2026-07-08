# Hakediş (Government Progress Payments) — Migration Status

## Current State (as of 2026-06-30)

### What has been deployed to production

All changes below are live after the last `deploy-akinal.bat` run (Errors = 0).

---

### Architecture

Hakediş payments are tracked in a **separate table** `ak_government_progress_payments`, completely independent of `ak_customer_financial_entries`. There is no boolean flag, no runtime schema mutation, no ALTER TABLE in any normal API endpoint.

---

### Files Changed / Created

| File | Change |
|------|--------|
| `public_html/install-schema.php` | Added `ak_government_progress_payments` table definition |
| `public_html/api/admin/government-progress-payments.php` | Removed `gpp_ensure_table()` (CREATE TABLE); fixed stages (`Belirtilmemiş`), added `cancelled` status |
| `public_html/api/admin/customers.php` | Removed `ensure_government_payment_column()` (ALTER TABLE); replaced `is_government_payment = 0` with `title NOT LIKE '%Hakediş%'`; `fetch_government_progress_payments()` guarded with `table_exists()` |
| `public_html/api/admin/customer-financial-entries.php` | Removed `cfe_ensure_govt_column()` (ALTER TABLE); replaced `is_government_payment = 0` with `title NOT LIKE '%Hakediş%'` |
| `public_html/api/admin/migrate-government-payments.php` | **Replaced with disabled stub** — returns HTTP 410, no DB access, directs to new migration endpoints |
| `public_html/api/admin/migrations/government-progress-payments-preview.php` | **NEW** — GET, shows candidates from CFE with Hakediş in title, no writes |
| `public_html/api/admin/migrations/government-progress-payments-apply.php` | **NEW** — POST, creates table if not exists + copies rows idempotently (by `source_customer_financial_entry_id`), never touches source rows |
| `public_html/api/admin/migrations/government-progress-payments-verify.php` | **NEW** — GET, compares source vs. destination counts and finds missing IDs |
| `public_html/api/admin/migrations/government-progress-payments-cleanup.php` | **NEW** — POST, runs internal verify first → refuses if any missing → deletes source Hakediş rows |
| `src/lib/apiTypes.ts` | `GovernmentPaymentStage` uses `"Belirtilmemiş"` (not `""`); added `"cancelled"` to status; renamed `source_entry_id` → `source_customer_financial_entry_id` |
| `src/pages/admin/AdminCustomerDetail.tsx` | Fixed GPP_STAGES, status badge for `cancelled`, removed `__other_val` hack, form default stage `Belirtilmemiş` |

---

### Safety Audit Results (all passing)

| Pattern | Result |
|---------|--------|
| `is_government_payment` in API files | ✅ 0 matches |
| `gpp_ensure_table` | ✅ 0 matches |
| `cfe_ensure_govt_column` | ✅ 0 matches |
| `ensure_government_payment_column` | ✅ 0 matches |
| `ALTER TABLE ak_customer_financial_entries` in API | ✅ 0 matches |
| `CREATE TABLE IF NOT EXISTS ak_government_progress_payments` | ✅ Only in `install-schema.php` + `migrations/apply.php` |

---

### What the temporary title filter does

Both `customers.php` and `customer-financial-entries.php` currently filter:
```sql
AND title NOT LIKE '%Hakediş%'
```
This prevents Hakediş rows from appearing in the customer financial ledger until the cleanup migration permanently removes them from `ak_customer_financial_entries`. After cleanup, this filter becomes a no-op (safe to remove later).

---

### Production DB State

`ak_government_progress_payments` table **does NOT yet exist in production** — it will be created when `government-progress-payments-apply.php` is POSTed. Until then, `fetch_government_progress_payments()` returns `[]` (guarded by `table_exists()`).

---

### Next Steps — Run in Order

1. **Preview** — verify which rows will migrate:
   ```
   GET /api/admin/migrations/government-progress-payments-preview.php
   ```
   Review `candidates` list. Check `already_migrated` and `detected_stage` for each row.

2. **Apply** — copy rows to new table (idempotent, safe to repeat):
   ```
   POST /api/admin/migrations/government-progress-payments-apply.php
   ```
   Check `inserted` + `errors` in response.

3. **Verify** — confirm all rows made it across:
   ```
   GET /api/admin/migrations/government-progress-payments-verify.php
   ```
   `verified: true` required before proceeding.

4. **Cleanup** — delete Hakediş rows from `ak_customer_financial_entries`:
   ```
   POST /api/admin/migrations/government-progress-payments-cleanup.php
   ```
   **IRREVERSIBLE.** Only run when `verify` returns `verified: true`.
   After cleanup, the `title NOT LIKE '%Hakediş%'` filters in `customers.php` and `customer-financial-entries.php` become no-ops.

---

### Protected rules (do not violate)

- Never touch `ak_profiles`, `ak_user_roles`, `ak_admin_users`
- Do not disable `foreign_key_checks`
- Do not use TRUNCATE
- Do not modify customer/supplier/project/employee delete logic
- Do not drop `is_government_payment` column blindly — if it exists in production (added by old deploy), leave it; it is ignored by all current API queries
