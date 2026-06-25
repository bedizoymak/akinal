# Table 8 Design Review — ak_payment_plans (Customer Collection Ledger)
## Status: APPROVED — Implementation Complete

---

## What this table is

A manual customer collection ledger — the incoming side of each project's finance model. One row = one collection item. Everything manually entered by an admin. No automation, no child records, no generated schedules.

---

## Owner decisions (final)

| Field | Decision |
|---|---|
| Owner scope | Customer only — `customer_id` NOT NULL |
| `project_id` | Required on every row — NOT NULL |
| Date | Single business date (`date`); renamed from `due_date` |
| `amount` | Editable at any time (agreements change) |
| `paid_amount` | Starts at 0; manually edited by admin |
| `type` | Kapora / Taksit / Hakediş / Diğer |
| `currency` | TRY / USD / EUR / XAU_GRAM |
| `payment_method` | Keep: Nakit / Banka Havalesi EFT / Kredi Kartı / Çek / Senet |
| `account_type` | Keep: `resmi` / `gayri_resmi` |
| Status | Always auto-calculated — no admin override |
| `status_overridden` | Not created |
| Delete | Hard delete only |
| FK rules | ON DELETE RESTRICT — consistent with NOT NULL columns |
| Global page | New "Gelenler" page — all collection items across all customers/projects |

---

## Status rules

Status is always auto-calculated on create and edit. No manual override.

| Condition | Status |
|---|---|
| `paid = 0`, `date` in future or today | `Planlanan` |
| `paid = 0`, `date` in past | `Gecikmiş` |
| `0 < paid < amount`, `date` in future or today | `Kısmi Ödendi` |
| `0 < paid < amount`, `date` in past | `Kısmi Ödendi + Gecikmiş` |
| `paid = amount` | `Ödendi` |
| `paid > amount` | `Fazla Ödendi` |

---

## Schema (implemented)

```sql
CREATE TABLE IF NOT EXISTS ak_payment_plans (
  id                       CHAR(36)      NOT NULL PRIMARY KEY,
  customer_id              CHAR(36)      NOT NULL,
  project_id               CHAR(36)      NOT NULL,
  title                    VARCHAR(255)  NOT NULL,
  description              TEXT              NULL,
  type                     VARCHAR(80)   NOT NULL DEFAULT 'Diğer',
  amount                   DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  paid_amount              DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency                 VARCHAR(10)   NOT NULL DEFAULT 'TRY',
  payment_method           VARCHAR(40)   NOT NULL DEFAULT 'Nakit',
  transaction_reference    VARCHAR(120)      NULL,
  card_note                VARCHAR(255)      NULL,
  cheque_maturity_date     DATE              NULL,
  cheque_no                VARCHAR(80)       NULL,
  bank_name                VARCHAR(120)      NULL,
  promissory_maturity_date DATE              NULL,
  account_type             VARCHAR(20)   NOT NULL DEFAULT 'resmi',
  date                     DATE          NOT NULL,
  status                   VARCHAR(50)   NOT NULL DEFAULT 'Planlanan',
  notes                    TEXT              NULL,
  created_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_payment_plans_customer     (customer_id),
  KEY idx_payment_plans_project      (project_id),
  KEY idx_payment_plans_date         (`date`),
  KEY idx_payment_plans_account_type (account_type),
  KEY idx_payment_plans_status       (status),
  CONSTRAINT fk_payment_plans_customer FOREIGN KEY (customer_id) REFERENCES ak_customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payment_plans_project  FOREIGN KEY (project_id)  REFERENCES ak_projects(id)  ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

Columns retained from original schema: `id`, `title`, `description`, `amount`, `paid_amount`, `payment_method`, `transaction_reference`, `card_note`, `cheque_maturity_date`, `cheque_no`, `bank_name`, `promissory_maturity_date`, `account_type`, `status`, `notes`, `created_at`, `updated_at`

Columns added: `type`, `currency`

Column renamed: `due_date` → `date`

Columns removed: `employee_id`, `expense_card_id`, `business_transaction_id`, `counterparty_type`, `counterparty_id`, `direction`, `allocation_scope`, `allocation_note`, `category_code`, `subcategory_code`, `migration_confidence`, `reconciliation_status`, `archived_at`, `archived_by`, `canceled_at`, `canceled_by`, `cancellation_reason`

FK behavior changed: `ON DELETE SET NULL` → `ON DELETE RESTRICT` (required by NOT NULL columns)

---

## Implementation plan

**Schema:** updated `install-schema.php`; `migrate-table8.php` handles existing installs (deletes orphaned rows, enforces NOT NULL, updates FK constraints)

**API:** rewrote `payment-plans.php`; updated `customers.php`, `financial-statement.php`, `dashboard.php`, `reports.php`, `canonical-read-flags.php`, `backend-canonical-read-model.php`, `notifications.php`, `payments.php`

**Frontend:** updated `apiTypes.ts`, `finance.ts`, `apiClient.ts`; updated `AdminCustomerDetail.tsx` and `FinancialStatementPage.tsx` forms; updated `AdminCollections.tsx`; created `AdminPaymentPlans.tsx`; added route and nav entry

**Testing:** PHP lint, TypeScript, Vite build — all pass

---

## Out of scope

Table-merging, table-retiring, and finance architecture redesign decisions are deferred to the global review after all 21 tables have been audited.
