# Table 7 Implementation Package

## Status

COMPLETE — QA pass applied. Build passes, typecheck passes, PHP lint passes, zero errors.

See `docs/TABLE_7_QA_REPORT.md` for the full QA findings and fixes.

---

## Changed files

| File | Change type |
|------|-------------|
| `public_html/install-schema.php` | Modified: narrowed `ak_expense_cards`; added `ak_project_expense_transactions` |
| `public_html/migrate-table7.php` | New: one-shot migration for existing installs |
| `public_html/api/admin/expense-cards.php` | Rewritten: slim CRUD + partial-search endpoint |
| `public_html/api/admin/project-expense-transactions.php` | New: full CRUD + profitability queries |
| `src/lib/apiTypes.ts` | Modified: slimmed `AdminExpenseCard`; added `AkExpenseTransaction`, `AkExpenseProfitability`, `AkExpenseTransactionsResponse`, `AkExpenseItemsResponse` |
| `src/lib/finance.ts` | Modified: added `EXPENSE_CURRENCIES` (TRY, USD, EUR, XAU_GRAM) |
| `src/lib/apiClient.ts` | Modified: replaced old expense-card functions; added expense-transaction functions |
| `src/pages/admin/AdminExpenseCards.tsx` | Rewritten: name-only item dictionary |
| `src/pages/admin/AdminProjectExpenses.tsx` | New: project expense transaction management with profitability |
| `src/App.tsx` | Modified: added route `/admin/projeler/:id/giderler` |
| `src/pages/admin/AdminProjects.tsx` | Modified: added "Giderler" button per project row |
| `src/components/admin/AdminLayout.tsx` | Modified: added breadcrumb for project expenses; updated sidebar label |

---

## Schema changes

### `ak_expense_cards` (MODIFIED)

Old schema had: `id`, `name`, `category`, `description`, `status`, `created_at`, `updated_at`.

New schema (new installs): `id`, `name`, index on `name`.

Existing installs: run `migrate-table7.php` to drop legacy columns.

The existing `ak_financial_entries.expense_card_id` FK is unaffected — that column points at the same table and continues to work as before.

### `ak_project_expense_transactions` (NEW)

```sql
CREATE TABLE ak_project_expense_transactions (
  id                         CHAR(36)      NOT NULL PRIMARY KEY,
  project_id                 CHAR(36)      NOT NULL,        -- FK → ak_projects, ON DELETE RESTRICT
  expense_item_id            CHAR(36)          NULL,        -- FK → ak_expense_cards, ON DELETE SET NULL
  expense_item_name_snapshot VARCHAR(255)  NOT NULL,        -- immutable at creation; preserved after rename/delete
  amount                     DECIMAL(14,4) NOT NULL,        -- positive, validated server-side
  currency                   VARCHAR(10)   NOT NULL DEFAULT 'TRY',  -- TRY | USD | EUR | XAU_GRAM
  exchange_rate_snapshot     DECIMAL(18,8)     NULL,        -- optional; null = no rate recorded
  exchange_rate_overridden   TINYINT(1)    NOT NULL DEFAULT 0,      -- 1 = user manually set rate
  expense_date               DATE          NOT NULL,        -- past, current, or future
  created_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
```

Indexes: `project_id`, `expense_item_id`, `expense_date`, `(project_id, expense_date)`, `currency`.

---

## API changes

### `GET /api/admin/expense-cards.php`

Returns `{ expense_items: [{ id, name }] }`.

Optional `?q=dem` for partial-match autocomplete (LIKE %dem%, up to 50 results).

### `POST /api/admin/expense-cards.php`

Body: `{ name }`. Returns `{ expense_item: { id, name } }`.

### `PATCH /api/admin/expense-cards.php`

Body: `{ id, name }`. Rename only — does not update historical snapshots. Returns `{ expense_item }`.

### `DELETE /api/admin/expense-cards.php?id=`

Deletes item. FK `ON DELETE SET NULL` nulls `expense_item_id` in all transactions; `expense_item_name_snapshot` is preserved. Returns `{ deleted: true }`.

---

### `GET /api/admin/project-expense-transactions.php?project_id=`

Returns:
```json
{
  "transactions": [...],
  "profitability": {
    "realized": { "TRY": "12500.00" },
    "planned":  { "TRY": "18000.00" },
    "today": "2026-06-24"
  },
  "project": { "id": "...", "title": "..." }
}
```

Realized = `SUM(amount)` where `expense_date <= DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00'))`.
Planned = `SUM(amount)` all dates. Both grouped by currency.

`GET ?id=` returns a single transaction.

### `POST /api/admin/project-expense-transactions.php`

Required fields: `project_id`, `expense_item_name_snapshot`, `amount` (>0), `currency`, `expense_date`.

Optional: `expense_item_id` (null allowed), `exchange_rate_snapshot` (null allowed), `exchange_rate_overridden`.

Returns `{ transaction: {...} }` with HTTP 201.

### `PATCH /api/admin/project-expense-transactions.php`

Overwrites all fields. Same required fields as POST plus `id`. Snapshot is replaced with the newly submitted `expense_item_name_snapshot`.

### `DELETE /api/admin/project-expense-transactions.php?id=`

Returns `{ deleted: true }`.

---

## UI changes

### `/admin/gider-kartlari` — Gider Kalemleri (formerly Gider Kartları)

- Sidebar label updated to "Gider Kalemleri".
- Shows a flat list of item names with inline create/rename/delete.
- No status, category, description, or finance link.
- Search by name (client-side filter).
- Form is a single `name` field.
- Delete confirmation warns that historical snapshots are preserved but the relational link is removed.

### `/admin/projeler/:id/giderler` — Proje Giderleri (NEW)

- Accessible from the project list row ("Giderler" button) and from within the page itself (link back to Finans).
- **Profitability panel** (top): two cards — "Gerçekleşen Gider" (realized, date ≤ today Istanbul) and "Planlanan Gider" (all dates). Both display per-currency totals.
- **Summary by currency**: total amount and transaction count per currency.
- **Transaction list**: date, item name snapshot, amount, currency, exchange rate (with asterisk if overridden).
- **Create/Edit dialog**:
  - Item autocomplete with debounced search (250 ms), partial match via API.
  - Inline "create new item" option when no exact match exists.
  - Amount (positive decimal), currency (TRY/USD/EUR/XAU_GRAM), optional exchange rate, date.
  - Exchange rate auto-flagged as overridden when manually entered.
- Edit overwrites all fields; new snapshot is taken from the item selected at save time.
- Delete with confirmation; profitability updates on next load.

---

## Validation rules

| Rule | Enforcement |
|------|-------------|
| `project_id` required | PHP: `require_non_empty` |
| `expense_item_name_snapshot` required | PHP: `require_non_empty` |
| `amount > 0` | PHP: `require_positive_amount` |
| `currency` in (TRY, USD, EUR, XAU_GRAM) | PHP: `require_allowed_value` |
| `expense_date` valid ISO date | PHP: `require_iso_date` |
| `exchange_rate_snapshot > 0` when provided | PHP: explicit check |
| Item name non-empty on create/rename | PHP: `require_non_empty` |
| Client amount > 0 | React: `parseFloat > 0` check before submit |
| Client item name non-empty | React: checked before submit |

---

## Profitability behaviour

- **Realized profitability**: `expense_date <= DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00'))` (Europe/Istanbul, UTC+3 permanent).
- **Planned profitability**: all transactions regardless of date.
- Both are computed dynamically at query time — no stored aggregates.
- Create / edit / delete changes are reflected on the next page load (no cache invalidation needed).
- Multi-currency: profitability is returned as `Record<currency, total>`. The UI displays each currency separately; no cross-currency conversion is performed.

---

## Build results

```
TypeScript: 0 errors
Vite build: ✓ built in 15.90s
AdminProjectExpenses chunk: 12.24 kB (gzip: 4.05 kB)
```

---

## Deployment notes

### New installations

1. Upload all changed files.
2. Run `install-schema.php?confirm=INSTALL_AKINAL_SCHEMA` (after enabling `ENABLE_SETUP_TOOL = true`).
3. Both `ak_expense_cards` (slim) and `ak_project_expense_transactions` are created.
4. Delete `install-schema.php`.

### Existing installations

1. Upload all changed files.
2. Enable `ENABLE_MIGRATION = true` in `migrate-table7.php`, set credentials.
3. Run `migrate-table7.php?confirm=RUN_TABLE7_MIGRATION`.
   - Creates `ak_project_expense_transactions`.
   - Drops legacy columns from `ak_expense_cards` (`category`, `description`, `status`, `created_at`, `updated_at`).
   - Adds name index.
4. Disable and delete `migrate-table7.php`.

### Timezone note

"Today" for realized profitability is always computed as `DATE(CONVERT_TZ(NOW(), '+00:00', '+03:00'))`. Turkey has been on UTC+3 (no DST) since September 2016. If the server's MySQL timezone is already set to Europe/Istanbul, this formula is redundant but harmless.

### Duplicate item names

The current implementation allows duplicate names (simplest approach). The UI shows all matches in autocomplete. If the owner later decides to enforce uniqueness, add `UNIQUE KEY uq_expense_cards_name (name)` and a duplicate-check in the API.

---

## Table 7 checklist verification

- [x] Expense items limited to `id` and `name`
- [x] Partial search, dropdown, autocomplete, and manual creation
- [x] Project, expense item, amount, and date required for every transaction
- [x] Item name snapshot stored at creation
- [x] Transactions kept separate (no merging)
- [x] Past, current, and future dates supported
- [x] Overwrite-style editing without history
- [x] Create/edit/delete changes reflected immediately on next load
- [x] Realized profitability: date ≤ today (Istanbul)
- [x] Planned profitability: all dates
- [x] Dynamic reporting (no aggregate tables)
- [x] Name snapshots preserved after item rename or deletion
- [x] Item reference nulled in transactions on item deletion
- [x] Employee costs, attachments, approvals, audit trail excluded
- [x] Timezone: Europe/Istanbul documented and applied
- [x] Project ownership enforced on all create/update paths
- [x] Indexes on `project_id`, `expense_date`, `(project_id, expense_date)`, `currency`
- [x] Multi-currency: TRY, USD, EUR, XAU_GRAM
- [x] Exchange-rate snapshot and override flag stored
- [x] Build: zero errors
- [x] Typecheck: zero errors
