# Table 7 Audit Starter

## 1. Identified table name

`ak_expense_cards`

This is the next original business table after the six closed reviews. The five employee-support tables added during Phase 6 belong to the completed employee architecture and are not separate entries in the original 21-table review sequence.

## 2. Current CREATE TABLE summary

- `id`: UUID-style `CHAR(36)` primary key
- `name`: required name
- `category`: optional free-text category
- `description`: optional text
- `status`: required, defaults to `Aktif`
- `created_at`, `updated_at`: automatic timestamps
- InnoDB, `utf8mb4_unicode_ci`

No uniqueness constraint exists for names or categories.

## 3. Existing references found

- `public_html/api/admin/expense-cards.php`: authenticated CRUD endpoint; accepts only `Aktif` / `Pasif`; blocks deletion when linked payment plans or financial entries exist.
- `src/pages/admin/AdminExpenseCards.tsx`: admin list, search, status filtering, create/edit/delete, category suggestions, and navigation to a card finance page.
- `src/pages/admin/AdminExpenseCardFinance.tsx` and `financial-statement.php`: card-specific financial statement workflow.
- `ak_payment_plans.expense_card_id`: an expense card can own payment plans.
- `ak_financial_entries.expense_card_id`: financial movements can belong to an expense card; schema FK uses `ON DELETE SET NULL`.
- Dashboard and finance screens use cards for lookups, labels, totals, and reporting.

## 4. Confirmed business purpose

`ak_expense_cards` represents reusable **project expense items**: simple labels/templates such as Demir, Çimento, Boya, Kablo, makine kiralama, nakliye, ruhsat, harç, vergi, elektrik, su, and yakıt.

It is not a supplier, ledger account, or employee-cost table. Employee and personnel costs remain exclusively in the employee architecture.

Every actual expense must belong to a project. An actual cost record holds project, expense item, amount, and date. Users must be able to search existing items, select them through dropdown/autocomplete, or manually create a new reusable item.

## 5. Confirmed target boundaries

- Keep the item schema minimal: `id`, `name`.
- Remove category, description, status, and timestamps from the intended model.
- No project-independent expense entries.
- No invoices, receipts, payment slips, cheque photos, or other attachments.
- Search/autocomplete must support partial matching; for example, `dem` should find `Demir` and `Demir Bağ Teli`.
- Renaming an item must not change the name displayed by historical expenses. Actual expense records therefore require an immutable name snapshot.
- Deleting an item should remove its reference from historical expenses; no archive or deletion protection is wanted.

## 6. Decision risks

- Deletion will prevent historical records from linking back to the reusable item, filtering by its current identity, or following later corrections.
- Historical display remains possible only because each actual expense stores the original item name as a snapshot.
- Item deletion could leave a nullable/orphaned reference depending on the approved implementation design.
- User-defined names can create duplicates and spelling variants unless lightweight duplicate handling is later approved.
- Current runtime behavior treats cards as broader finance counterparties and allows payment plans; this does not match the confirmed narrow purpose.

## 7. Owner questions status

Answered. The detailed decisions and recommendation are recorded in `docs/TABLE_7_OWNER_DECISIONS.md`.
