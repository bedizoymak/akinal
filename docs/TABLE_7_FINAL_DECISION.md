# Table 7 Final Decision

## Final business purpose

`ak_expense_cards` is the reusable dictionary of project expense item names, such as Demir, Çimento, nakliye, ruhsat, vergi, elektrik, and yakıt.

It does not represent suppliers, general ledger accounts, or employee costs. Employee and personnel costs remain in the employee architecture.

Each actual expense is a separate accounting event. Transactions using the same item must never be merged.

Final owner decision: expense transactions are editable by overwriting their existing values. No audit trail, edit history, revision history, or change tracking is required.

## Required data model

Reusable expense item:

- `id`
- `name`

Actual expense transaction:

- project — required
- expense item reference — required when created
- expense item name snapshot — required for historical display
- amount — required, single numeric value
- date — required

No category, status, description, attachments, net/VAT/total breakdown, summary records, or cached aggregates are required.

Users may create expense items manually and find existing items through dropdown, partial search, and autocomplete. Newly created items become reusable immediately.

## Required reporting behavior

- Project screens show a detailed list of individual expense transactions.
- An optional summary view is calculated dynamically from those transactions.
- Transactions are never merged in the source data.
- No summary table, aggregate persistence, cache, or materialized reporting structure.
- Historical display uses the transaction’s name snapshot, so later item renames do not rewrite history.

## Profitability behavior

- Creating an expense immediately increases project cost.
- Editing an expense immediately recalculates project profitability.
- Deleting an expense immediately recalculates project profitability.
- No approval workflow.
- **Realized profitability:** includes expenses with `date <= today`.
- **Planned profitability:** includes all expenses, including future-dated expenses.
- Future expenses affect planned profitability immediately after creation.

## Deletion behavior

Deleting a reusable expense item removes its reference from historical expense transactions. The historical name snapshot remains for display.

No archival or deletion protection is required.

Consequences:

- Historical transactions can no longer link to or group reliably by the deleted item ID.
- Snapshot text remains, but the reusable item identity is permanently lost.
- Accidental deletion can only be recovered through an external backup/restore process.

## Final KEEP / MODIFY / REMOVE verdict

**MODIFY**

Keep the reusable expense-item concept, but reduce the table to `id` and `name` and align all usage with project expenses. Actual expenses must be separate project-bound transactions with amount, date, item reference, and immutable name snapshot. Reporting and realized/planned profitability must be calculated dynamically.

`KEEP` would preserve fields and finance-counterparty behavior that conflict with the owner decisions. `REMOVE` would eliminate the required reusable item dictionary.

## Remaining implementation risks

- Current runtime treats expense cards as broader finance counterparties and payment-plan owners.
- Existing records must be classified carefully before narrowing the model.
- The exact transaction storage table and compatibility with current financial entries require implementation design.
- Project-required enforcement must cover every expense creation/update path.
- Item deletion and nullable-reference behavior must be consistent across schema and API.
- Name snapshots must be written at transaction creation and not changed by item renames.
- “Today” calculations need a single agreed application/database timezone.
- Editing permanently overwrites prior transaction values. Mistakes or unauthorized changes cannot be reconstructed from application data because the owner explicitly rejected an audit trail.
- Dynamic profitability queries may require appropriate indexes as transaction volume grows, without adding aggregate tables.
