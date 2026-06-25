# Table 7 Design Review

## 1. Approved decisions summary

- `ak_expense_cards` becomes a minimal reusable project-expense item dictionary containing only `id` and `name`.
- Every expense transaction requires project, item, name snapshot, amount, and date.
- Transactions stay separate but may be edited by overwriting current values.
- Item rename does not alter transaction snapshots.
- Item deletion removes references while snapshots remain.
- Realized profitability uses transactions dated on or before today.
- Planned profitability uses all transactions, including future dates.
- Reporting and profitability are calculated dynamically.
- Employee costs, attachments, approvals, audit history, and persisted aggregates are excluded.

## 2. Critical flaws

1. **Transaction storage is undecided.** The documents require an expense transaction model but do not decide whether it uses `ak_financial_entries`, replaces part of it, or requires another table. Implementation cannot safely begin without this decision.
2. **`ak_payment_plans` compatibility is unresolved.** Existing expense cards can own payment plans, while the approved model defines only dated expense transactions. It is unknown whether expense payment plans remain, are migrated into transactions, or are removed.
3. **Existing `ak_financial_entries` semantics may conflict.** The current runtime treats expense cards as finance counterparties. The new model treats them as expense labels and requires every expense to have a project. Existing entries may be projectless, future/planned, non-expense, or structured with fields outside the approved model.
4. **Deletion destroys stable reporting identity.** Nulling the item reference preserves display text but prevents reliable grouping across spelling-equivalent snapshots and prevents distinguishing different deleted items with the same name.
5. **Migration rules for existing data are absent.** There is no decision for legacy category/status/description values, duplicate names, linked payment plans, projectless entries, or records lacking a valid snapshot.

## 3. Medium risks

- “Immediately recalculates” is misleading under dynamic reporting: no recalculation is persisted; the next query must reflect current data.
- “Immutable accounting event” contradicts overwrite editing and hard deletion.
- Amount validation is unspecified: zero and negative values could corrupt project cost.
- Currency is unspecified. A single amount is not comparable if existing entries can use multiple currencies.
- The meaning of future expenses is unclear: planned commitments and forecast estimates may be mixed with realized accounting events.
- Moving an edited transaction between projects or across today’s date boundary changes two profitability views and requires consistent handling.
- Search normalization is unspecified for Turkish casing, whitespace, punctuation, and duplicate names.
- Removing timestamps eliminates basic operational diagnostics even though transaction history is already intentionally absent.

## 4. Minor risks

- “Dropdown” may not scale if every item is loaded at once; autocomplete should define the primary behavior.
- No name length, blank-name, or case-equivalent duplicate rule is stated.
- The optional summary dimensions are unspecified.
- The timezone governing “today” remains undecided.
- Hard deletion has no recovery path inside the application.

## 5. Contradictions found

- Transactions are called “immutable accounting events” but can be overwritten and deleted.
- Item reference is “required when created,” yet deletion intentionally makes it absent later; the final model must explicitly allow a nullable historical reference.
- The item schema is declared to contain only `id` and `name`, but search quality, duplicate control, and operational traceability may require rules even if no extra columns are added.
- The requirements say expense changes “recalculate” profitability, while also rejecting stored aggregates. The correct behavior is dynamic recomputation on read.
- Historical names are preserved, but historical item identity is intentionally discarded.

## 6. Missing business decisions

1. Must expense transactions remain in `ak_financial_entries`, or may implementation use a dedicated transaction table?
2. What happens to existing expense-linked `ak_payment_plans`: keep, migrate, or remove?
3. How should existing projectless expense records be handled?
4. Are amounts strictly positive, and is `0` rejected?
5. Is Table 7 single-currency? If not, how is currency represented and profitability converted?
6. Are future-dated records firm planned expenses or editable forecasts, and do both use the same transaction type?
7. What timezone defines “today”?
8. Are duplicate item names allowed after Turkish case/whitespace normalization?
9. On transaction edit, may users change the project, item, amount, and date without restriction?
10. When the selected item changes during an edit, must the snapshot change to the newly selected item name?
11. What migration outcome is required for legacy fields and incompatible linked records: preserve elsewhere, discard, or manually clean?

## 7. Recommended corrections

- Resolve the transaction storage and legacy-data migration decisions before producing migrations.
- Define the fate of expense-owned payment plans explicitly.
- Replace “immutable” with “independent transaction record” and replace “recalculate immediately” with “dynamic profitability reflects the change on the next read.”
- Define expense reference as required for active items at create/select time but nullable after item deletion.
- Define amount, currency, duplicate-name, edit, snapshot-refresh, timezone, and future-expense rules.
- Require migration verification that realized and planned project totals match approved legacy treatment before runtime cutover.

## 8. Final verdict

**APPROVE WITH CHANGES**

Owner decisions still required:

1. Transaction storage: existing `ak_financial_entries` or a dedicated table?
2. Existing expense-linked payment plans: keep, migrate, or remove?
3. Existing projectless expenses: assign, discard, or block migration for manual correction?
4. Amount rules: positive-only, and is zero invalid?
5. Currency model: one currency or multiple currencies with a conversion rule?
6. Future records: firm planned expenses, forecasts, or both?
7. Which timezone defines “today”?
8. Are normalized duplicate item names allowed?
9. Which transaction fields may be changed during editing?
10. Does changing the item during editing replace the stored name snapshot?
11. How should incompatible legacy fields and records be treated during migration?
