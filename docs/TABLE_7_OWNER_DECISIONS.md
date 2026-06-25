# Table 7 Owner Decisions

## Table

`ak_expense_cards`

## Confirmed decisions

- Represents reusable **project expense item labels/templates**.
- Examples include materials, contracted work, rentals, transport, permits, fees, taxes, utilities, and fuel.
- Employee and personnel costs are excluded and remain in the employee architecture.
- Every actual expense must belong to a project.
- An actual expense records: project, expense item, amount, and date.
- Items are user-defined and reusable.
- UI requires dropdown selection, partial search, autocomplete, and manual creation. New items become available in future searches.
- Keep the item model minimal: `id`, `name` only.
- No status, category, description, or attachments.
- Renaming an item affects future use only. Historical expenses preserve the original name through a snapshot stored on the actual expense record.
- Deleting an item removes its reference from historical expenses. No archive or deletion protection is required.
- Simplicity and future adaptability take priority over speculative features.
- Expense transactions are immutable accounting events and always remain separate records, even when they use the same item.
- Do not merge or consolidate individual transactions.
- Required transaction fields are project, expense item, single numeric amount, and mandatory date.
- Do not split amount into net, VAT, or total components.
- Dates may be past, current, or future.
- Project screens require a detailed transaction list and an optional dynamically calculated summary.
- No summary tables, cached aggregates, aggregate persistence, or materialized reporting structures.
- Expense changes affect project profitability immediately; no approval workflow applies.
- Realized profitability includes expenses dated on or before today.
- Planned profitability includes all expenses, including future-dated expenses.
- Future expenses affect planned profitability immediately after creation.
- Expense transactions are editable. An edit overwrites the existing values and immediately recalculates profitability.
- Only current transaction state matters. No audit log, edit history, revision history, or change tracking is required.

## Transaction and reporting behavior

- Each create operation produces one independent accounting event.
- Editing overwrites the existing transaction; editing or deleting immediately changes dynamically calculated project profitability.
- Summary views group or total underlying transactions only at query/display time.
- The detailed transaction list remains the accounting source of truth.
- No historical visibility of transaction edits is retained.

## Deletion decision risks

- Historical expenses lose the relational link to the deleted reusable item.
- Deleted-item history cannot reliably be grouped or filtered by the former item ID.
- The name snapshot preserves display text, but not the deleted item’s identity or later corrections.
- Reports must treat the snapshot as authoritative whenever the item reference is absent.
- Accidental deletion has permanent historical consequences unless a separate backup/restore process is used.

## Recommendation: MODIFY

Keep the table’s core concept but narrow and simplify it.

Rationale:

- **KEEP is insufficient:** the current table contains category, description, status, and timestamps and is used as a broader finance counterparty/payment-plan card. That conflicts with the confirmed purpose.
- **REMOVE is inappropriate:** the business needs a reusable, searchable source of project expense item names.
- **MODIFY fits:** retain a reusable item table with only `id` and `name`; align runtime semantics with project expense items; require projects on actual expenses; preserve the selected name in each expense record through a snapshot; and calculate realized/planned profitability dynamically from separate transactions.

This is a business recommendation only. No schema, migration, or runtime implementation is included.
