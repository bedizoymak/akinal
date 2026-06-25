# Table 7 Final Review

## 1. Remaining blockers

None.

All five critical flaws identified in the Design Review are resolved by closed owner decisions:

| Design Review critical flaw | Resolved by |
|---|---|
| Transaction storage undecided | CLOSED — separate expense transaction table approved |
| `ak_payment_plans` compatibility unresolved | CLOSED — payment plans excluded from new model |
| `ak_financial_entries` semantics conflict | CLOSED — new system starts from scratch |
| Deletion destroys stable reporting identity | ACCEPTED RISK — owner explicitly accepted snapshot-only identity after deletion |
| Migration rules for legacy data absent | CLOSED — new system starts from scratch; no migration is required |

---

## 2. Decisions already resolved

The following questions from Design Review §6 are closed:

| Design Review question | Closed decision |
|---|---|
| Q1: Transaction storage — `ak_financial_entries` or dedicated table? | Separate expense transaction table |
| Q2: Expense-linked payment plans — keep, migrate, or remove? | No payment plans in new model |
| Q3: Existing projectless expenses — assign, discard, or block? | New system starts from scratch |
| Q4: Amount rules — positive-only, zero invalid? | Positive amounts only |
| Q5: Currency model — one or multiple? | Multi-currency: TRY, USD, EUR, XAU_GRAM with exchange-rate snapshot and user override |
| Q6: Future records — firm planned or forecast? | Future-dated expenses allowed; all use the same transaction type |
| Q9: Which transaction fields editable? | Edit allowed; editing overwrites existing values (project, item, amount, date) |
| Q10: Does changing item during edit replace snapshot? | Snapshot display rules closed; snapshot reflects the item selected at the moment the transaction is saved |
| Q11: Legacy field and record treatment? | New system from scratch; no legacy handling required |

---

## 3. Required changes before implementation

Two minor operational details were not explicitly closed. They do not block implementation but must be confirmed during development rather than deferred to a production incident.

**a. Timezone governing "today"**

The implementation checklist requires a single agreed timezone for realized-profitability cutoffs. The decision was not recorded as a closed owner topic. Implementation should default to `Europe/Istanbul` (Turkey standard time) and document that choice. If the owner prefers UTC or server time, confirm before going live.

**b. Duplicate item names policy**

The item model contains only `id` and `name`. No uniqueness constraint or normalization rule was specified. Duplicate names create ambiguity in search results. Implementation should choose one of:

- Allow duplicates (simplest; user responsibility).
- Warn on exact-match duplicate at creation (soft guard, no enforcement).
- Enforce uniqueness on normalized name (prevents accidental duplicates; requires a decision on Turkish case and whitespace normalization).

A working default is to warn on exact duplicate without blocking creation. Confirm with the owner before shipping the creation form.

---

## 4. Final verdict

**READY FOR IMPLEMENTATION WITH MINOR NOTES**

Table 7 is closed. All critical and structural design questions are answered. The two items above (timezone default and duplicate-name policy) are implementation-level choices that a developer can resolve without another owner interview, provided they document the choice and surface it for confirmation before cutover.

Implementation may begin on:

- Simplified `ak_expense_cards` schema: `id`, `name`.
- Dedicated expense transaction table: project reference, item reference (nullable after deletion), name snapshot, amount, currency, exchange-rate snapshot, date.
- CRUD API for expense items and transactions.
- Project-bound enforcement on every expense creation and update path.
- Partial-match search, dropdown/autocomplete, and manual item creation.
- Overwrite-style transaction editing.
- Dynamic realized and planned profitability queries (no stored aggregates).
- Soft delete of item reference with snapshot preservation on item deletion.
