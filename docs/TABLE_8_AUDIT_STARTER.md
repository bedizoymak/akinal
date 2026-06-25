# Table 8/21 Audit Starter — ak_payment_plans

## 1. Identified table name

`ak_payment_plans`

---

## 2. Why this is Table 8/21

Counting business-domain tables in schema install order, excluding:
- Auth/system support tables: `ak_admin_users`, `ak_profiles`, `ak_user_roles`, `ak_site_settings`, `ak_contact_requests`, `ak_cookie_consents`
- Project support: `ak_project_images`, `ak_media_library`
- Phase 6 support tables added during ak_employees implementation: `ak_roles`, `ak_employee_roles`, `ak_employee_cost_periods`, `ak_employee_project_assignments`, `ak_employee_project_allocations`
- Table 7 support table: `ak_project_expense_transactions`

Remaining business tables in schema order after the 7 closed tables:

| Position | Table | Status |
|---|---|---|
| 1/21 | ak_projects | CLOSED |
| 2/21 | ak_customers | CLOSED |
| 3/21 | ak_customer_projects | CLOSED |
| 4/21 | ak_customer_notes | CLOSED |
| 5/21 | ak_documents | CLOSED (deleted) |
| 6/21 | ak_employees | CLOSED |
| 7/21 | ak_expense_cards | CLOSED |
| **8/21** | **ak_payment_plans** | **← THIS TABLE** |
| 9/21 | ak_payments | open |
| 10/21 | ak_expenses | open |
| 11/21 | ak_notifications | open |
| 12/21 | ak_financial_entries | open |
| 13/21 | ak_payment_plan_settlements | open |

(Remaining 8 positions to be identified in later audits.)

---

## 3. Current CREATE TABLE summary

```sql
CREATE TABLE IF NOT EXISTS ak_payment_plans (
  id                      CHAR(36)       NOT NULL PRIMARY KEY,
  customer_id             CHAR(36)       NULL,
  employee_id             CHAR(36)       NULL,
  expense_card_id         CHAR(36)       NULL,
  project_id              CHAR(36)       NULL,
  business_transaction_id CHAR(36)       NULL,
  counterparty_type       VARCHAR(30)    NULL,
  counterparty_id         CHAR(36)       NULL,
  direction               VARCHAR(20)    NULL,
  currency                VARCHAR(10)    NULL,
  allocation_scope        VARCHAR(30)    NULL,
  allocation_note         TEXT           NULL,
  category_code           VARCHAR(80)    NULL,
  subcategory_code        VARCHAR(80)    NULL,
  migration_confidence    VARCHAR(30)    NULL,
  reconciliation_status   VARCHAR(30)    NULL,
  archived_at             DATETIME       NULL,
  archived_by             CHAR(36)       NULL,
  canceled_at             DATETIME       NULL,
  canceled_by             CHAR(36)       NULL,
  cancellation_reason     TEXT           NULL,
  title                   VARCHAR(255)   NOT NULL,
  description             TEXT           NULL,
  amount                  DECIMAL(14,2)  NOT NULL DEFAULT 0.00,
  paid_amount             DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
  payment_method          VARCHAR(40)    NOT NULL DEFAULT 'Nakit',
  transaction_reference   VARCHAR(120)   NULL,
  card_note               VARCHAR(255)   NULL,
  cheque_maturity_date    DATE           NULL,
  cheque_no               VARCHAR(80)    NULL,
  bank_name               VARCHAR(120)   NULL,
  promissory_maturity_date DATE          NULL,
  account_type            VARCHAR(20)    NOT NULL DEFAULT 'resmi',
  due_date                DATE           NOT NULL,
  status                  VARCHAR(50)    NOT NULL DEFAULT 'Bekliyor',
  notes                   TEXT           NULL,
  created_at              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_payment_plans_customer (customer_id),
  KEY idx_payment_plans_employee_id (employee_id),
  KEY idx_payment_plans_expense_card_id (expense_card_id),
  KEY idx_payment_plans_account_type (account_type),
  KEY idx_payment_plans_project (project_id),
  KEY idx_payment_plans_due_date (due_date),
  KEY idx_payment_plans_counterparty (counterparty_type, counterparty_id),
  KEY idx_payment_plans_business_transaction (business_transaction_id),
  KEY idx_payment_plans_reconciliation (reconciliation_status),

  CONSTRAINT fk_payment_plans_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_plans_project  FOREIGN KEY (project_id)  REFERENCES ak_projects(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

**Notable gaps in FK constraints:**
- `employee_id`: indexed but **no FK constraint** to `ak_employees`
- `expense_card_id`: indexed but **no FK constraint** to `ak_expense_cards`
- `archived_by`, `canceled_by`: no FK constraints to `ak_admin_users`
- `business_transaction_id`, `counterparty_id`: no FK constraints (likely polymorphic or future-use)

**Column count:** 35 columns. Largest and most complex table in the schema.

---

## 4. Existing references found

**Tables that reference `ak_payment_plans.id`:**

| Table | Column | FK constraint |
|---|---|---|
| `ak_payments` | `payment_plan_id` | FK with `ON DELETE SET NULL` |
| `ak_notifications` | `related_payment_plan_id` | FK with `ON DELETE SET NULL` |
| `ak_financial_entries` | `payment_plan_id` | Index only, no FK declared |
| `ak_payment_plan_settlements` | `payment_plan_id` | FK with `ON DELETE RESTRICT` |

**`ak_payment_plans` referencing other tables:**

| Column | References |
|---|---|
| `customer_id` | `ak_customers.id` (FK, ON DELETE SET NULL) |
| `project_id` | `ak_projects.id` (FK, ON DELETE SET NULL) |
| `employee_id` | `ak_employees.id` (index, no FK) |
| `expense_card_id` | `ak_expense_cards.id` (index, no FK) |

---

## 5. Current likely business purpose

A **payment schedule entry** representing a single expected payment — either incoming (from a customer or counterparty) or outgoing (to an employee, supplier, or expense account). Each plan has:

- A due date and expected amount
- A running `paid_amount` (presumably updated as actual payments are linked or settled)
- A `status` (e.g., `Bekliyor` = Waiting, and presumably `Ödendi` = Paid, `İptal` = Cancelled)
- Payment method details (cash, cheque, promissory note, bank transfer, credit card)
- Counterparty: customer, employee, or polymorphic via `counterparty_type` / `counterparty_id`
- `account_type`: `resmi` (official) vs presumably `gayri resmi` (off-books)
- Lifecycle fields: `archived_at`, `canceled_at`, `cancellation_reason`
- Migration/reconciliation metadata columns (`migration_confidence`, `reconciliation_status`, `category_code`, `subcategory_code`, `allocation_scope`, `allocation_note`, `business_transaction_id`) — suggest this table was created to receive migrated data from a previous system

The table sits between scheduling (`due_date`, `status`) and settlement (`ak_payment_plan_settlements` which links it to `ak_financial_entries`).

---

## 6. Risks / unknowns

1. **`paid_amount` maintenance:** This column exists as a running total, but it is unclear whether it is maintained by triggers, by the API on every payment/settlement event, or manually. If it drifts from actual linked payments, reconciliation will fail silently.

2. **Missing FK constraints:** `employee_id` and `expense_card_id` have no FK constraints. If an employee or expense card is deleted, orphaned references remain. Historically this may have been intentional (soft references), but it creates data integrity risk after Phase 6 and Table 7 implementations have matured.

3. **`counterparty_type` / `counterparty_id` polymorphic pattern:** These fields imply a polymorphic association (e.g., customer, employee, vendor), but there is no enforcement. The set of valid `counterparty_type` values and which table each maps to is undocumented.

4. **`direction` column:** `VARCHAR(20) NULL` with no FK or CHECK constraint. Valid values unknown — presumably `gelir`/`gider` or `in`/`out` or Turkish equivalents.

5. **`account_type` values:** Default is `'resmi'`. Permitted values unknown. The column is used in `ak_payments` and `ak_financial_entries` with the same pattern. Audit should confirm allowed value set.

6. **`status` lifecycle:** Valid statuses and transitions are not enforced at the DB level. The application must manage the lifecycle. The allowed values and transition rules are unknown.

7. **Migration columns:** `migration_confidence`, `reconciliation_status`, `business_transaction_id`, `category_code`, `subcategory_code`, `allocation_scope`, `allocation_note` look like they were added to support data migration from a prior system. It is unclear whether these are still actively used, read-only relics, or intended for ongoing use.

8. **Relationship to `ak_payments` and `ak_financial_entries`:** Two separate tables can reference a payment plan — `ak_payments` (simpler, older) and `ak_financial_entries` (more complex, newer, with settlements). Whether both are in active use simultaneously or whether `ak_payments` is being deprecated in favor of `ak_financial_entries` is unknown.

9. **`cheque_maturity_date`, `cheque_no`, `bank_name`, `promissory_maturity_date`:** Payment-method-specific fields stored flat. Business rules for which fields are required per `payment_method` are unenforced.

---

## 7. Owner questions

**Q1 — `paid_amount` maintenance**
How is `paid_amount` updated? Is it calculated on every payment/settlement event by the API, or is it a manually entered field? Is it currently accurate in production, or is it expected to be recalculated?

**Q2 — `direction` values**
What are the valid values for `direction`? Examples: `Gelir` / `Gider`, `in` / `out`, `alacak` / `borç`? Is direction always set, or can it be null?

**Q3 — `account_type` values**
What are all the permitted values for `account_type`? Is it a two-value field (`resmi` / `gayri resmi`) or are there more? Does the UI expose this distinction to the user?

**Q4 — `status` lifecycle**
What are the valid statuses and their transitions? For example: `Bekliyor → Ödendi`, `Bekliyor → İptal`. Who can cancel a plan? Is a canceled plan ever reopened?

**Q5 — `counterparty_type` values**
What are the valid values for `counterparty_type`, and which table does each one map to? Is this field actively used in the UI, or is it a migration artifact?

**Q6 — `ak_payments` vs `ak_financial_entries`**
Are both `ak_payments` and `ak_financial_entries` currently active, or is `ak_payments` being replaced/deprecated? When a payment plan is paid, which table records the payment?

**Q7 — Missing FK constraints (employee_id, expense_card_id)**
Should `employee_id` and `expense_card_id` have FK constraints enforced (`ON DELETE SET NULL`, same as customer_id and project_id)? Or are these intentionally soft references?

**Q8 — Migration columns**
Are `migration_confidence`, `reconciliation_status`, `business_transaction_id`, `category_code`, `subcategory_code`, `allocation_scope`, and `allocation_note` actively used in the current system? Or are they historical artifacts from data migration that can be ignored (or removed)?

**Q9 — Cheque / promissory note fields**
When `payment_method` is cheque or promissory note, are `cheque_maturity_date`, `cheque_no`, `bank_name`, `promissory_maturity_date` required by the application? Is there a risk of these being left blank for those payment methods?

**Q10 — Archive vs cancel**
What is the difference between archiving (`archived_at`) and canceling (`canceled_at`) a payment plan? Can a plan be both archived and canceled? Can an archived plan be unarchived?
