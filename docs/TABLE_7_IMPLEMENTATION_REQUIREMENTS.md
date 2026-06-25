# Table 7 Implementation Requirements

## 1. Approved business model

- Expense items are reusable, user-defined labels/templates for project expenses.
- Examples: Demir, Çimento, Boya, Kablo, makine kiralama, nakliye, ruhsat, harç, vergi, elektrik, su, yakıt.
- Employee and personnel costs are excluded.
- Every expense transaction belongs to a project.
- Each transaction remains a separate record and is never merged with another.
- Transactions are editable; edits overwrite current values.
- No approval workflow or edit audit trail.

## 2. Approved data model

Expense item:

- `id`
- `name`

Expense transaction:

- required project reference
- required expense item reference at creation
- required expense item name snapshot
- required single numeric amount
- required date

Do not store category, status, description, net/VAT/total breakdowns, attachments, summaries, or edit revisions.

## 3. Required UI behavior

- Select an existing item through a dropdown.
- Search and autocomplete using partial text; `dem` must find names such as `Demir` and `Demir Bağ Teli`.
- Allow manual creation of a new item.
- Make newly created items available to later searches immediately.
- Allow create, edit, and delete operations for expense transactions.
- Editing overwrites the existing transaction values.
- Show detailed transactions separately, even when item names match.

## 4. Required reporting behavior

- Project screens provide a detailed expense transaction list.
- Project screens may provide an optional dynamically calculated summary.
- Summary values are calculated from current transaction records at query/display time.
- No summary tables, cached aggregates, aggregate persistence, or materialized reporting structures.
- Historical transaction labels display the stored name snapshot.

## 5. Realized profitability rules

- Include only expense transactions whose date is on or before today.
- Create, edit, and delete operations recalculate realized profitability immediately when the affected transaction falls within this date rule.
- Use dynamic calculations only.

## 6. Planned profitability rules

- Include all expense transactions, including future-dated transactions.
- Future expenses affect planned profitability immediately after creation.
- Create, edit, and delete operations recalculate planned profitability immediately.
- Use dynamic calculations only.

## 7. Delete behavior

- Deleting an expense transaction removes it and immediately updates profitability.
- Deleting a reusable expense item removes its reference from historical transactions.
- The transaction’s name snapshot remains available for display.
- Do not block item deletion because of historical use.
- No archival protection is required.

## 8. Rename behavior

- Renaming an expense item changes the reusable name for future selections.
- Existing transactions retain and display the item name captured when they were created.
- Item renames must not update historical name snapshots.

## 9. Explicitly rejected features

- Employee salary, SGK, meal, transportation, daily-worker, or other personnel costs
- Project-independent expense transactions
- Transaction merging
- Approval workflow
- Audit log
- Edit history
- Revision history
- Change tracking
- Categories, descriptions, or status on expense items
- Net amount, VAT, or total amount breakdowns
- Invoice, receipt, payment-slip, cheque-photo, or other document attachments
- Summary tables
- Cached or persisted aggregates
- Materialized reporting structures
- Archival or historical-reference deletion protection

## 10. Final implementation checklist

- [ ] Keep the reusable expense-item concept.
- [ ] Limit expense items to `id` and `name`.
- [ ] Provide partial search, dropdown, autocomplete, and manual creation.
- [ ] Require project, expense item, amount, and date for every transaction.
- [ ] Store the selected item name as a transaction snapshot.
- [ ] Keep transactions separate.
- [ ] Support past, current, and future dates.
- [ ] Support overwrite-style transaction editing without history.
- [ ] Apply create/edit/delete changes to profitability immediately.
- [ ] Calculate realized profitability using dates on or before today.
- [ ] Calculate planned profitability using all dates.
- [ ] Generate detailed and optional summary reporting dynamically.
- [ ] Preserve name snapshots after item rename or deletion.
- [ ] Remove item references from historical transactions when an item is deleted.
- [ ] Exclude rejected features and employee costs.
- [ ] Define and consistently use the timezone governing “today.”
- [ ] Verify all expense creation and update paths enforce project ownership.
- [ ] Verify query performance with appropriate indexes, without aggregate tables.

TABLE 7 READY FOR IMPLEMENTATION
