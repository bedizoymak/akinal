# Table 7 QA Report

## Issues found

### Issue 1 — CRITICAL: `fetch_all()` called but not defined in new PHP files

**Files:** `expense-cards.php`, `project-expense-transactions.php`

`fetch_all()` is not a global helper in this codebase. Each file that needs it defines its own local version (e.g., `fetch_all_expenses()` in expenses.php, `fetch_all()` locally in customers.php). Both new files called `fetch_all()` without defining it, which would cause a fatal PHP runtime error on every request.

### Issue 2 — SPEC MISMATCH: `expense_item_id` nullable in API payload

**File:** `project-expense-transactions.php` → `pet_payload()`

Owner decision: "required expense item reference at creation."
Final decision: "expense item reference — required when created."

The original `pet_payload()` used `nullable_string($input, 'expense_item_id')`, allowing a transaction to be created or edited via API without an item reference. This contradicts the spec. The column is nullable at the DB level only because FK `ON DELETE SET NULL` needs to clear it when an item is deleted — not because the application should allow creating null-reference transactions.

### Issue 3 — INCONSISTENCY: Exception message leaked in HTTP response

**Files:** `expense-cards.php`, `project-expense-transactions.php`

Catch blocks used `json_error('... : ' . $exception->getMessage(), 500)`, exposing internal error details. All other endpoints in this codebase suppress the message. No spec deviation — just inconsistency with existing error-handling pattern.

### Issue 4 — COSMETIC: Unused constant `ISTANBUL_OFFSET`

**File:** `project-expense-transactions.php`

`ISTANBUL_OFFSET = '+03:00'` was defined but never referenced. Removed.

---

## Issues NOT fixed (correct per owner decisions)

### QA Check 2: `original_amount` / `amount_try` columns

Owner decisions say: "required single numeric amount" and "Do not split amount into net, VAT, or total components."

The approved design uses a single `amount` column in the original currency, grouped by currency in profitability queries. Adding `original_amount` + `amount_try` would be splitting — explicitly rejected. No fix applied.

### QA Check 3: Profitability uses `amount_try`

Profitability is returned as `{ realized: { TRY: ..., USD: ..., EUR: ..., XAU_GRAM: ... }, planned: {...} }` — per-currency totals, no cross-currency conversion. This is correct: the owner approved multi-currency but did not approve a single TRY-denominated total or a conversion algorithm.

### QA Check 4: XAU_GRAM naming

Already consistent across all layers: PHP constant `EXPENSE_CURRENCIES`, TypeScript `EXPENSE_CURRENCIES`, DB column values, UI labels. No fix needed.

### QA Check 5: Duplicate item names

Owner decisions do not specify a duplicate-name policy. The Final Review identified this as an implementation-level detail. Current behavior (allow duplicates, no warning) is the simplest correct approach. No owner decision was violated.

---

## Fixes applied

| # | File | Fix |
|---|------|-----|
| 1a | `expense-cards.php` | Added `ec_fetch_all()` and `ec_fetch_one()` local helpers; replaced all `fetch_all()` calls |
| 1b | `project-expense-transactions.php` | Added `pet_fetch_all()` local helper; replaced all `fetch_all()` calls |
| 2 | `project-expense-transactions.php` `pet_payload()` | Changed `expense_item_id` from `nullable_string()` to `require_non_empty()` — enforces spec requirement |
| 3a | `expense-cards.php` | Removed `$exception->getMessage()` from catch block |
| 3b | `project-expense-transactions.php` | Removed `$exception->getMessage()` from catch block |
| 4 | `project-expense-transactions.php` | Removed unused `ISTANBUL_OFFSET` constant |

---

## Remaining risks

- **Duplicate item names:** Allowed. If the owner later requires uniqueness, add `UNIQUE KEY` on `ak_expense_cards.name` and a pre-insert check.
- **Cross-currency profitability total:** Profitability is shown per currency with no single TRY grand total. If the owner later needs a single TRY total, exchange rates and a conversion algorithm must be specified.
- **Existing installs with old `ak_expense_cards` columns:** The migration (`migrate-table7.php`) drops legacy columns. Until it is run, the PHP API continues to function correctly (SELECT only requests `id` and `name`). The old columns are ignored.
- **`expense_item_id` null in existing transactions (post item deletion):** Any transaction whose item was deleted has `expense_item_id = NULL`. If such a transaction is later edited via the API, the edit will fail validation (`expense_item_id` is now required). The user must select a new item. This is acceptable per the spec: the owner accepted that deletion permanently removes the relational link.

---

## Build result

```
Vite build: ✓ built in 8.47s
Zero warnings, zero errors.
```

## PHP lint result

```
expense-cards.php:              No syntax errors detected
project-expense-transactions.php: No syntax errors detected
migrate-table7.php:             No syntax errors detected
```

## TypeScript result

```
npx tsc --noEmit: 0 errors (no output)
```

---

## Final verdict

**TABLE 7 VERIFIED WITH KNOWN LIMITATIONS**

All spec requirements from `TABLE_7_OWNER_DECISIONS.md`, `TABLE_7_FINAL_DECISION.md`, and `TABLE_7_IMPLEMENTATION_REQUIREMENTS.md` are met. One critical runtime bug (missing `fetch_all()` local definition) and one spec mismatch (`expense_item_id` nullable at API level) have been corrected. The two known limitations (duplicate names, per-currency profitability without TRY conversion) are acknowledged and consistent with the owner's approved scope — neither was specified in the owner decisions.
