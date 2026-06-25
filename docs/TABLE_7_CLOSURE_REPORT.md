# Table 7 Closure Report

## 1. Final status

CLOSED — implementation complete, QA verified, all fixes applied, committed and pushed to `main` (commit `63d32b1`).

---

## 2. Implementation completed

All items from the approved design were implemented:

- `ak_expense_cards` narrowed to `id` + `name` (reusable expense item dictionary)
- `ak_project_expense_transactions` created as the separate expense transaction table
- PHP API: expense items (CRUD + partial-search autocomplete) and expense transactions (CRUD + realized/planned profitability)
- Multi-currency support: TRY, USD, EUR, XAU_GRAM
- Exchange-rate snapshot and user-override flag stored per transaction
- Realized profitability: `expense_date <= today` using Europe/Istanbul (UTC+3)
- Planned profitability: all transactions, including future-dated
- Dynamic calculation only — no stored aggregates
- Name snapshot written at transaction creation; not affected by item rename or deletion
- Item deletion nulls `expense_item_id` via FK `ON DELETE SET NULL`; snapshot preserved
- React: item autocomplete with debounced search, inline item creation, per-currency profitability panels, full CRUD
- Route `/admin/projeler/:id/giderler` and "Giderler" button on project list

---

## 3. QA completed

Four issues found and fixed during QA pass:

| # | Severity | Issue | Resolution |
|---|---|---|---|
| 1 | Critical | `fetch_all()` undefined in both new PHP files — fatal runtime error | Added `ec_fetch_all()` / `pet_fetch_all()` local helpers |
| 2 | Spec mismatch | `expense_item_id` nullable in API payload — contradicts "required when created" | Changed to `require_non_empty()` |
| 3 | Inconsistency | Exception message exposed in HTTP 500 responses | Removed `$exception->getMessage()` from catch blocks |
| 4 | Cosmetic | Unused `ISTANBUL_OFFSET` constant | Removed |

Five items were reviewed and confirmed correct (no changes required):

- `original_amount` / `amount_try` columns: not required — owner decision says "single numeric amount" and "do not split"
- Per-currency profitability: correct — no cross-currency conversion algorithm was approved
- XAU_GRAM naming: already consistent across all layers
- Duplicate item names: owner did not specify a policy; allowing duplicates is the simplest correct default
- Profitability calculation method: dynamic per-currency grouping matches approved design

---

## 4. Build / typecheck / PHP lint results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` (Vite) | ✓ built in 8.47s, zero warnings |
| `php -l expense-cards.php` | No syntax errors detected |
| `php -l project-expense-transactions.php` | No syntax errors detected |
| `php -l migrate-table7.php` | No syntax errors detected |

---

## 5. Known limitations accepted

These are consistent with the owner's approved scope and do not block closure:

- **Duplicate item names allowed.** The owner did not specify a uniqueness policy. If uniqueness is later required, add `UNIQUE KEY` on `ak_expense_cards.name` and a pre-insert check.
- **Per-currency profitability only.** No single TRY grand total is produced. Cross-currency conversion requires an approved rate algorithm and is out of scope.
- **Editing a transaction whose item was deleted requires selecting a new item.** The API enforces `expense_item_id` as required; after item deletion via FK `ON DELETE SET NULL`, an edit will reject a null reference and prompt the user to choose a replacement. This is consistent with the owner's accepted deletion risk.
- **Legacy `ak_expense_cards` columns remain on existing installs until `migrate-table7.php` is run.** The API is unaffected because all SELECTs specify `id, name` explicitly. The old columns are ignored at runtime.

---

## 6. Deployment checklist

**New installations**

- [ ] Upload all changed files
- [ ] Set `ENABLE_SETUP_TOOL = true` in `install-schema.php`, run `?confirm=INSTALL_AKINAL_SCHEMA`
- [ ] Confirm `ak_expense_cards` (slim) and `ak_project_expense_transactions` are created
- [ ] Delete `install-schema.php` immediately after successful run

**Existing installations**

- [ ] Upload all changed files
- [ ] Set credentials and `ENABLE_MIGRATION = true` in `migrate-table7.php`
- [ ] Run `migrate-table7.php?confirm=RUN_TABLE7_MIGRATION`
- [ ] Confirm: `ak_project_expense_transactions` created; legacy columns dropped from `ak_expense_cards`; name index added
- [ ] Delete `migrate-table7.php` immediately after successful run

**Timezone note:** "Today" is computed as `DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00'))`. Turkey has been on permanent UTC+3 since September 2016. No server timezone configuration is required.

---

## 7. Files changed summary

| File | Type | Purpose |
|------|------|---------|
| `public_html/install-schema.php` | Modified | Slim `ak_expense_cards`; add `ak_project_expense_transactions` |
| `public_html/migrate-table7.php` | New | One-shot migration for existing installs |
| `public_html/api/admin/expense-cards.php` | Rewritten | Slim CRUD + partial-search autocomplete |
| `public_html/api/admin/project-expense-transactions.php` | New | Full CRUD + profitability queries |
| `src/lib/apiTypes.ts` | Modified | Slim `AdminExpenseCard`; new transaction and profitability types |
| `src/lib/finance.ts` | Modified | `EXPENSE_CURRENCIES` constant (TRY, USD, EUR, XAU_GRAM) |
| `src/lib/apiClient.ts` | Modified | New item and transaction API functions; legacy aliases |
| `src/pages/admin/AdminExpenseCards.tsx` | Rewritten | Name-only item dictionary UI |
| `src/pages/admin/AdminProjectExpenses.tsx` | New | Project expense management page with profitability |
| `src/App.tsx` | Modified | Route `/admin/projeler/:id/giderler` |
| `src/pages/admin/AdminProjects.tsx` | Modified | "Giderler" button per project row |
| `src/components/admin/AdminLayout.tsx` | Modified | Breadcrumb + sidebar label for expense items |
| `docs/TABLE_7_AUDIT_STARTER.md` | New | Audit documentation |
| `docs/TABLE_7_OWNER_DECISIONS.md` | New | Owner decision record |
| `docs/TABLE_7_FINAL_DECISION.md` | New | Final business decision |
| `docs/TABLE_7_IMPLEMENTATION_REQUIREMENTS.md` | New | Implementation requirements |
| `docs/TABLE_7_DESIGN_REVIEW.md` | New | Design review |
| `docs/TABLE_7_FINAL_REVIEW.md` | New | Pre-implementation readiness review |
| `docs/TABLE_7_IMPLEMENTATION_PACKAGE.md` | New | Implementation package |
| `docs/TABLE_7_QA_REPORT.md` | New | QA findings and fixes |
| `docs/TABLE_7_CLOSURE_REPORT.md` | New | This document |

---

## 8. Final verdict

**TABLE 7 CLOSED**
