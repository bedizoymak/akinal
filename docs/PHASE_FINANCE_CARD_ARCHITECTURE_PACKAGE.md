# Finance Card Architecture Package

## Overview

This document records the complete implementation of the card-based finance architecture for the Akınal İnşaat admin panel. It replaces the legacy finance system (ak_payments, ak_expenses, ak_financial_entries, ak_payment_plans) with a new 5-card + 4-entry-table model.

**Date:** 2026-06-25  
**Status:** COMPLETE — build passes, 68 tests pass, PHP lint clean

---

## Database Schema (New Tables)

### Card Tables (existing, carry-over)
- `ak_customers` — customer cards
- `ak_employees` — employee cards
- `ak_expense_cards` — masraf kartları (project expense buckets)

### New Card Table
- `ak_suppliers` — tedarikçi/alt yüklenici cards
  - Fields: id, name, supplier_type, contact_person, phone, whatsapp, email, tax_no, address, city, district, notes, is_active, created_at, updated_at

### Financial Entry Tables (all new)

```sql
-- 1. Customer entries (income direction)
ak_customer_financial_entries (
  id, customer_id → ak_customers RESTRICT,
  project_id → ak_projects RESTRICT,
  entry_date, title, notes,
  amount, paid_amount, currency,
  amount_try, paid_amount_try,         -- stored TRY snapshots; remaining_amount_try is computed at read time by fe_enrich()
  exchange_rate_to_try, is_exchange_rate_manual,
  exchange_rate_source, exchange_rate_snapshot_at,
  status, is_overdue,
  account_type, payment_method,
  created_at, updated_at
)

-- 2. Employee entries (expense direction)
ak_employee_financial_entries (same shape, employee_id → ak_employees RESTRICT)

-- 3. Supplier entries (expense direction)
ak_supplier_financial_entries (same shape, supplier_id → ak_suppliers RESTRICT)

-- 4. Expense card entries (expense direction)
ak_expense_card_financial_entries (same shape, expense_card_id → ak_expense_cards RESTRICT)
```

### Key Design Invariants
- Every entry belongs to exactly one project (project_id, NOT NULL, RESTRICT)
- Every entry belongs to exactly one owner card (customer/employee/supplier/expense_card, NOT NULL, RESTRICT)
- Status is server-computed only — never client-set
- FX rates frozen at save time in amount_try / paid_amount_try
- TRY currency always forces rate=1.0, is_manual=0
- is_overdue computed server-side: entry_date < TODAY AND paid_amount < amount

---

## Auto-Computed Status Logic

```
paid <= 0:
  entry_date < today → Gecikmiş
  else               → Planlanan

paid >= amount:
  paid > amount  → Fazla Ödendi
  paid == amount → Gerçekleşti

paid > 0 AND paid < amount:
  → always Kısmi Ödendi (regardless of date)
  → is_overdue = 1 separately when entry_date < today
```

`is_overdue` is orthogonal to `status`. For partial entries it conveys the time dimension without replacing the payment-completeness label. The UI renders both signals simultaneously: the amber "Kısmi Ödendi" badge plus a small red "Gecikmiş" pill.

---

## Profit Formula

```
realized_profit = SUM(customer.paid_amount_try) - SUM(employee + supplier + expense_card paid_amount_try)
planned_profit  = SUM(customer.amount_try) - SUM(employee + supplier + expense_card amount_try)
```

---

## PHP API Files

| File | Method | Purpose |
|------|--------|---------|
| `api/admin/finance-entry-helpers.php` | shared | Status calc, validation, enrichment, helpers |
| `api/admin/suppliers.php` | GET/POST/PATCH/DELETE | Supplier CRUD |
| `api/admin/customer-financial-entries.php` | GET/POST/PATCH/DELETE | Customer entry CRUD |
| `api/admin/employee-financial-entries.php` | GET/POST/PATCH/DELETE | Employee entry CRUD |
| `api/admin/supplier-financial-entries.php` | GET/POST/PATCH/DELETE | Supplier entry CRUD |
| `api/admin/expense-card-financial-entries.php` | GET/POST/PATCH/DELETE | Expense card entry CRUD |
| `api/admin/project-statement.php` | GET | UNION ALL statement for a project |
| `api/admin/gelenler.php` | GET | Global income view (customer entries only) |
| `api/admin/gidenler.php` | GET | Global expense view (employee+supplier+expense_card) |
| `api/admin/dashboard.php` | GET | **Fully rewritten** to use new tables only |

---

## project-statement.php — UNION ALL Shape

```sql
SELECT ... 'income' as direction FROM ak_customer_financial_entries WHERE project_id=:pid
UNION ALL
SELECT ... 'expense' as direction FROM ak_employee_financial_entries WHERE project_id=:pid2
UNION ALL
SELECT ... 'expense' as direction FROM ak_supplier_financial_entries WHERE project_id=:pid3
UNION ALL
SELECT ... 'expense' as direction FROM ak_expense_card_financial_entries WHERE project_id=:pid4
ORDER BY entry_date DESC
```

Normalized row includes: `remaining_amount`, `remaining_amount_try`, `signed_amount_try`, `signed_paid_amount_try`.

---

## Frontend Files Created/Modified

### New TypeScript Types (`src/lib/apiTypes.ts`)
- `SupplierType` union
- `AdminSupplier` interface
- `CardEntryStatus`, `CardEntryCurrency`, `CardEntryAccountType`, `CardEntryPaymentMethod`, `CardEntryRateSource`
- `CardFinancialEntry` base interface (all shared fields)
- `CustomerFinancialEntry`, `EmployeeFinancialEntry`, `SupplierFinancialEntry`, `ExpenseCardFinancialEntry`
- `ProjectStatementRow`, `ProjectStatementSummary`, `ProjectStatementResponse`
- `GelenlerSummary`, `GelenlerResponse`
- `GidenlerSummary`, `GidenlerEntry`, `GidenlerResponse`
- `CardFinancialEntryPayload`
- Response wrapper types for all entry endpoints

### New API Client Functions (`src/lib/apiClient.ts`)
- Supplier CRUD: `getAdminSuppliers`, `getAdminSupplier`, `createAdminSupplier`, `updateAdminSupplier`, `deleteAdminSupplier`
- Customer entries CRUD: `getCustomerFinancialEntries`, `createCustomerFinancialEntry`, `updateCustomerFinancialEntry`, `deleteCustomerFinancialEntry`
- Employee entries CRUD: same pattern
- Supplier entries CRUD: same pattern
- Expense card entries CRUD: same pattern
- `getProjectStatement(projectId)`
- `getGelenler(params)`
- `getGidenler(params)`

### New Reusable Finance Components

| Component | Path | Purpose |
|-----------|------|---------|
| `EntryStatusBadge` | `src/components/admin/finance/EntryStatusBadge.tsx` | Colored badge for CardEntryStatus values |
| `CurrencyAmount` | `src/components/admin/finance/CurrencyAmount.tsx` | Format amounts with currency symbol + optional TRY equivalent |
| `CardEntryForm` | `src/components/admin/finance/CardEntryForm.tsx` | Dialog form for create/edit financial entries |
| `CardStatementTable` | `src/components/admin/finance/CardStatementTable.tsx` | Table with add/edit/delete for any card type |

### New Admin Pages

| Page | Route | Purpose |
|------|-------|---------|
| `AdminSuppliers` | `/admin/tedarikciler` | Supplier list with search |
| `AdminSupplierEdit` | `/admin/tedarikciler/yeni`, `/:id/duzenle` | Create/edit supplier card |
| `AdminSupplierDetail` | `/admin/tedarikciler/:id` | Supplier detail + expense entries |
| `AdminGelenler` | `/admin/gelenler` | Income view (customer entries), replaces AdminPaymentPlans |
| `AdminGidenler` | `/admin/gidenler` | Expense view (all 3 expense types) |

### Modified Admin Pages
- `AdminCustomerDetail` — added "Mali Hareketler (Yeni)" section with CardStatementTable for customer entries
- `AdminEmployeeDetail` — added "Mali Hareketler" section with CardStatementTable for employee entries
- `AdminExpenseCardFinance` — **replaced** legacy FinancialStatementPage with new expense card entries CRUD
- `App.tsx` — added all new routes
- `AdminLayout.tsx` — added Tedarikçiler + Gidenler nav items, reorganized Finance section

---

## Navigation Changes

**Removed from nav:**
- "Tahsilatlar" (legacy collections, route preserved but de-listed)
- Old "Giderler" group heading

**Added to nav:**
- "Tedarikçiler" (under "Tedarik ve Giderler")
- "Masraf Kartları" (renamed)
- "Gidenler" (new global expense view)
- "Gelenler" now routes to new AdminGelenler (income view)

---

## Legacy System Status

The following tables/pages are **inactive and not part of any new calculations**:
- `ak_payment_plans` — orphaned, read-only access preserved
- `ak_payments` — orphaned, read-only access preserved
- `ak_expenses` — orphaned, read-only access preserved
- `ak_financial_entries` — orphaned, legacy page preserved

No legacy data was migrated or deleted. The new architecture starts clean.

---

## Deployment Checklist

Before testing any new finance pages on a fresh database:

1. **Run the schema installer** — navigate to `/install-schema.php?confirm=yes` (gated by `ENABLE_SETUP_TOOL = true` in config). This creates all tables idempotently using `CREATE TABLE IF NOT EXISTS`. Tables created:
   - `ak_suppliers`
   - `ak_customer_financial_entries`
   - `ak_employee_financial_entries`
   - `ak_supplier_financial_entries`
   - `ak_expense_card_financial_entries`

2. **Set `ENABLE_SETUP_TOOL = false`** again after running.

3. **Legacy tables are left untouched** — `ak_payments`, `ak_expenses`, `ak_financial_entries`, `ak_payment_plans` may still exist and are not read by any new code.

---

## Test Coverage

**New test file:** `src/test/card-finance-architecture.test.ts` — 22 tests covering:
- Status derivation (6 cases: Planlanan, Gecikmiş, Gerçekleşti, Fazla Ödendi, Kısmi Ödendi × 2)
- is_overdue flag (5 cases: unpaid+past, partial+past, fully paid+past, unpaid+future, partial+future)
- TRY conversion (3 cases: TRY, USD, XAU_GRAM)
- Profit calculation (3 cases: planned, realized, negative)
- UNION ALL row shape (3 cases: income sign, expense sign, remaining amounts)
- GidenlerEntry shape (1 case)
- SupplierFinancialEntry type (1 case)

**Total test suite:** 64 tests, all passing (2 added in final polish pass).

---

## Build Verification

```
npm run build  → ✓ built in 10.86s (0 errors)
npm run test   → 64 passed (0 failures)
php -l *.php   → No syntax errors detected (5 files re-linted)
```

---

## Final Polish Pass

### What Was Checked

1. **Partial overdue status behavior** — Verified `fe_auto_status()` always returns `Kısmi Ödendi` for `0 < paid < amount` regardless of date. `fe_is_overdue()` separately returns 1 when past-due and underpaid. Checked that the frontend badge component (`EntryStatusBadge`) does not replace `Kısmi Ödendi` with `Gecikmiş` for partial entries.

2. **FX snapshot field names** — Verified all 5 layers (DB schema, PHP helpers, TypeScript types, API client, frontend form) use the canonical names: `exchange_rate_to_try`, `exchange_rate_source`, `exchange_rate_snapshot_at`, `is_exchange_rate_manual`, `amount_try`, `paid_amount_try`. Confirmed no live rate refresh occurs when editing existing entries — the saved snapshot is loaded from DB and displayed as-is.

3. **Legacy route safety** — Verified `dashboard.php`, `project-statement.php`, `gelenler.php`, `gidenler.php`, and all 4 card entry endpoints contain zero reads from `ak_payments`, `ak_expenses`, `ak_financial_entries`, or `ak_payment_plans`. Checked sidebar navigation contains no legacy links (Tahsilatlar, Giderler removed). Verified `/admin/tahsilatlar` and `/admin/giderler` routes still existed as reachable URLs.

4. **Seed script correctness** — Audited all 4 INSERT statements in `seed-demo-card-finance.mjs`.

### What Was Fixed

| # | File | Fix |
|---|------|-----|
| 1 | `src/test/card-finance-architecture.test.ts` | `deriveStatus()` helper incorrectly returned `"Gecikmiş"` for partial+past; fixed to return `"Kısmi Ödendi"`. Test description updated to explain the is_overdue separation. |
| 2 | `src/test/card-finance-architecture.test.ts` | Added 2 new `is_overdue` test cases: partial+past=true, partial+future=false. |
| 3 | `src/components/admin/finance/EntryStatusBadge.tsx` | Updated to render BOTH `Kısmi Ödendi` badge AND a second small `Gecikmiş` pill when `isOverdue && status === "Kısmi Ödendi"`. Previously only `Planlanan` triggered the overdue override; partial overdue state was invisible in UI. |
| 4 | `public_html/api/admin/finance-entry-helpers.php` | Added rule: if `is_exchange_rate_manual = 1` and `exchange_rate_source` was not explicitly set by client, override to `'manual'`. Keeps the two flags consistent. |
| 5 | `scripts/seed-demo-card-finance.mjs` | Fixed `rate_source` column name → `exchange_rate_source` in all 4 INSERT statements (would have caused MySQL "unknown column" error on run). |
| 6 | `scripts/seed-demo-card-finance.mjs` | Removed `remaining_amount_try` from all 4 INSERT column lists — this column does not exist in the DB schema (it is computed at read time by `fe_enrich()`). Removed the now-unused `remaining()` helper function. |
| 7 | `src/App.tsx` | Redirected `/admin/tahsilatlar` → `/admin/gelenler` and `/admin/giderler` → `/admin/gidenler` so old bookmarks or direct URL access lands on the new pages rather than legacy components. |

### Validation Result (Final Polish Pass)

```
php -l (5 files)  → No syntax errors detected
npm run test      → 64 passed, 0 failed (10 test files)
npm run build     → ✓ built in 10.86s, 0 TypeScript errors
```

---

## Pre-Deploy Verification Pass (2026-06-26)

### What Was Checked

1. **FX snapshot preservation on PATCH** — confirmed all 4 PATCH handlers called `fe_payload()` without providing the existing snapshot, causing `exchange_rate_snapshot_at` to be silently refreshed on every edit even when currency/rate were unchanged.

2. **Dashboard outstanding fields** — `outstanding_receivables` and `outstanding_payables` were hardcoded to `0.0` in `build_project_cards()` while the UI displayed them in project finance cards. `current_cash_position` and `negative_cashflow` were already computed correctly from new tables.

3. **Schema readiness** — confirmed all 5 new tables (`ak_suppliers`, `ak_customer_financial_entries`, `ak_employee_financial_entries`, `ak_supplier_financial_entries`, `ak_expense_card_financial_entries`) are present in `install-schema.php`. Added deployment checklist section above.

### What Was Fixed

| # | File | Fix |
|---|------|-----|
| 1 | `public_html/api/admin/finance-entry-helpers.php` | Added `fe_should_preserve_snapshot()` helper that returns the existing snapshot string when currency and rate are unchanged, null otherwise. |
| 2 | `public_html/api/admin/finance-entry-helpers.php` | `fe_payload()` gains `?string $preserveSnapshotAt = null` parameter; non-TRY branch uses `$preserveSnapshotAt ?? gmdate(...)`. |
| 3 | `public_html/api/admin/customer-financial-entries.php` | PATCH handler stores existing row, calls `fe_should_preserve_snapshot()`, passes result to `fe_payload()`. |
| 4 | `public_html/api/admin/employee-financial-entries.php` | Same as above. |
| 5 | `public_html/api/admin/supplier-financial-entries.php` | Same as above. |
| 6 | `public_html/api/admin/expense-card-financial-entries.php` | Same as above. |
| 7 | `public_html/api/admin/dashboard.php` | `build_project_cards()` SQL extended with two CASE SUM expressions for `outstanding_receivables` and `outstanding_payables`; PHP map updated to emit real values instead of `0.0`. |
| 8 | `src/test/card-finance-architecture.test.ts` | Added 4 new tests for `shouldPreserveSnapshot()` logic: preserve when unchanged, refresh on currency change, refresh on rate change, null passthrough for TRY entries. |

### Validation Result (Pre-Deploy Pass)

```
php -l (6 files)  → No syntax errors detected
npm run test      → 68 passed, 0 failed (10 test files)
npm run build     → ✓ 0 TypeScript errors
```
