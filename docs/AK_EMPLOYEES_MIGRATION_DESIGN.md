# ak_employees — Phase 6A Migration Design

**Date:** 2026-06-24  
**Phase:** 6A — Design only. No SQL executed. No runtime code modified.  
**Source of truth:** [docs/AK_EMPLOYEES_AUDIT_REPORT.md](AK_EMPLOYEES_AUDIT_REPORT.md)  
**Status:** Design complete. Ready for SQL migration authoring (Phase 6B).

---

## 1. Executive Summary

The current `ak_employees` table stores employee master data and links into the financial ledger (`ak_financial_entries`, `ak_payment_plans`) as a cash-flow entity. This is correct and must remain.

What does not exist: any schema support for project cost allocation. The business question — *"exactly how much did this project cost us in personnel?"* — cannot be answered today.

This design adds five new tables around `ak_employees` without touching any existing table structure. All existing API endpoints, frontend pages, and financial entries continue to operate unchanged throughout the migration. The new tables are additive.

**Approved new tables:**

| Table | Purpose |
|---|---|
| `ak_roles` | Enumerated role catalog |
| `ak_employee_roles` | Employee ↔ role (many-to-many, historical) |
| `ak_employee_cost_periods` | Historical monthly cost structure per employee |
| `ak_employee_project_assignments` | Formal project membership with dates |
| `ak_employee_project_allocations` | Monthly man-day allocation with cost snapshot |

**Rejected:** `ak_employee_work_logs` (daily attendance — not needed; replaced by monthly allocation model).

**Accounting model:** Snapshot. Past project costs are immutable.

---

## 2. Target Architecture

### Entity map

```
┌─────────────┐
│  ak_roles   │  Enumerated role catalog
│  id         │  (no FK dependencies)
│  name       │
│  normalized │
│  is_active  │
└──────┬──────┘
       │ ON DELETE RESTRICT
       │
┌──────▼──────────────────┐         ┌─────────────────────────────┐
│  ak_employee_roles      │         │  ak_employees               │
│  employee_id  ──────────┼─────────►  id (PK)                   │
│  role_id ───────────────┘         │  full_name                  │
│  assigned_at            │         │  phone                      │
│  ended_at               │         │  role  ◄── DEPRECATED       │
└─────────────────────────┘         │  notes                      │
                                    │  status                     │
                                    └──────┬──────────────────────┘
                                           │
                    ┌──────────────────────┼─────────────────────────────┐
                    │                      │                             │
       ┌────────────▼────────┐  ┌──────────▼───────────┐  ┌────────────▼──────────────┐
       │ ak_employee_cost_   │  │ ak_employee_project_ │  │ ak_employee_project_       │
       │ periods             │  │ assignments          │  │ allocations                │
       │ employee_id (FK)    │  │ employee_id (FK)     │  │ employee_id (FK)           │
       │ effective_from      │  │ project_id (FK)      │  │ project_id (FK)            │
       │ effective_to        │  │ start_date           │  │ allocation_year/month      │
       │ salary              │  │ end_date             │  │ days_worked                │
       │ sgk                 │  │ notes                │  │ working_days_base          │
       │ meal                │  └──────────────────────┘  │ cost_date [SNAPSHOT]       │
       │ transportation      │                             │ salary_snapshot            │
       │ bonus               │   ┌─────────────────────┐  │ sgk_snapshot               │
       │ accommodation       │   │  ak_projects        │  │ meal_snapshot              │
       │ other               │   │  id (PK)            │  │ transportation_snapshot    │
       └─────────────────────┘   │  ...                │  │ bonus_snapshot             │
                                 └─────────────────────┘  │ accommodation_snapshot     │
                                          ▲               │ other_snapshot             │
                                          └───────────────│ monthly_cost_snapshot      │
                                                          │ calculated_cost            │
                                                          └────────────────────────────┘
```

### Principle of separation of concerns

| Concern | Table | Relationship to cash flow |
|---|---|---|
| Who an employee is | `ak_employees` | Master data |
| What roles they hold | `ak_employee_roles` → `ak_roles` | Metadata only |
| What they cost per period | `ak_employee_cost_periods` | Cost structure — not cash movement |
| Which projects they work on | `ak_employee_project_assignments` | Membership record |
| How much each project was charged | `ak_employee_project_allocations` | Cost allocation — immutable snapshots |
| Salary paid, advances, reimbursements | `ak_financial_entries` (existing) | Cash flow — unchanged |

---

## 3. Table Specifications

### 3.1 `ak_roles`

```sql
CREATE TABLE IF NOT EXISTS ak_roles (
  id              CHAR(36)     NOT NULL,
  name            VARCHAR(100) NOT NULL,
  normalized_name VARCHAR(100) NOT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_normalized (normalized_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column notes:**

| Column | Note |
|---|---|
| `id` | UUID (CHAR 36). Application-generated. |
| `name` | Display name exactly as entered: `Formen`, `Makine Operatörü`, `Mühendis`. |
| `normalized_name` | Lowercase, diacritics removed, trimmed. Used for deduplication. Application computes before INSERT. |
| `is_active` | Soft-delete flag. Inactive roles remain in history; cannot be assigned to new employees. |

**Seed data (minimum viable set):**

| name | normalized_name |
|---|---|
| Formen | formen |
| Ustabaşı | ustabasi |
| Makine Operatörü | makine operatoru |
| Mühendis | muhendis |
| Şef Mühendis | sef muhendis |
| Şantiye Şefi | santiye sefi |
| İşçi | isci |
| Serbest Çalışan | serbest calisan |

---

### 3.2 `ak_employee_roles`

```sql
CREATE TABLE IF NOT EXISTS ak_employee_roles (
  employee_id CHAR(36) NOT NULL,
  role_id     CHAR(36) NOT NULL,
  assigned_at DATE     NOT NULL,
  ended_at    DATE         NULL,

  PRIMARY KEY (employee_id, role_id, assigned_at),
  KEY idx_employee_roles_employee (employee_id),
  KEY idx_employee_roles_role     (role_id),

  CONSTRAINT fk_employee_roles_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_employee_roles_role
    FOREIGN KEY (role_id) REFERENCES ak_roles(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column notes:**

| Column | Note |
|---|---|
| `employee_id` | Part of composite PK. |
| `role_id` | Part of composite PK. |
| `assigned_at` | Part of composite PK — allows the same employee to hold the same role in two separate periods (e.g. Formen 2024, not Formen 2025, Formen again 2026). |
| `ended_at` | NULL = role currently active. DATE = role ended on that day. |

**Business logic:**
- An employee can hold multiple active roles simultaneously (no constraint prevents this).
- Active roles: `WHERE ended_at IS NULL`.
- Role at a point in time: `WHERE assigned_at <= :date AND (ended_at IS NULL OR ended_at >= :date)`.

---

### 3.3 `ak_employee_cost_periods`

```sql
CREATE TABLE IF NOT EXISTS ak_employee_cost_periods (
  id             CHAR(36)      NOT NULL,
  employee_id    CHAR(36)      NOT NULL,
  effective_from DATE          NOT NULL,
  effective_to   DATE              NULL,
  salary         DECIMAL(14,2) NOT NULL DEFAULT 0,
  sgk            DECIMAL(14,2) NOT NULL DEFAULT 0,
  meal           DECIMAL(14,2) NOT NULL DEFAULT 0,
  transportation DECIMAL(14,2) NOT NULL DEFAULT 0,
  bonus          DECIMAL(14,2) NOT NULL DEFAULT 0,
  accommodation  DECIMAL(14,2) NOT NULL DEFAULT 0,
  other          DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes          TEXT              NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_cost_period_employee_from (employee_id, effective_from),
  KEY idx_cost_periods_employee           (employee_id),

  CONSTRAINT fk_cost_periods_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column notes:**

| Column | Note |
|---|---|
| `effective_from` | First day this cost structure applies. Part of UNIQUE constraint with `employee_id`. |
| `effective_to` | Last day inclusive. NULL = still active (open-ended). Application must close the prior period's `effective_to` when a new period is created. |
| `salary` through `other` | Seven cost components in TRY. All default to 0 so partial cost entries are valid (e.g. an employee who gets no meal allowance). |

**Invariant (enforced in application, not schema):**  
For any employee, no two cost periods may overlap. When a new period is created for `effective_from = X`, the prior open period's `effective_to` must be set to `X - 1 day`.

**Query: cost structure active on a given date:**

```sql
SELECT *
FROM ak_employee_cost_periods
WHERE employee_id = :employee_id
  AND effective_from <= :date
  AND (effective_to IS NULL OR effective_to >= :date)
LIMIT 1;
```

---

### 3.4 `ak_employee_project_assignments`

```sql
CREATE TABLE IF NOT EXISTS ak_employee_project_assignments (
  id          CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  project_id  CHAR(36) NOT NULL,
  start_date  DATE     NOT NULL,
  end_date    DATE         NULL,
  notes       TEXT         NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_epa_employee   (employee_id),
  KEY idx_epa_project    (project_id),
  KEY idx_epa_emp_proj   (employee_id, project_id),

  CONSTRAINT fk_epa_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_epa_project
    FOREIGN KEY (project_id) REFERENCES ak_projects(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column notes:**

| Column | Note |
|---|---|
| `end_date` | NULL = currently assigned. An employee can have multiple non-overlapping assignment periods to the same project. No schema-level overlap prevention — enforced in application. |

**This table does not carry role.** Role is tracked separately in `ak_employee_roles`. The assignment says "was on this project from/to". Role says "held this title during period X".

---

### 3.5 `ak_employee_project_allocations`

```sql
CREATE TABLE IF NOT EXISTS ak_employee_project_allocations (
  id                      CHAR(36)      NOT NULL,
  employee_id             CHAR(36)      NOT NULL,
  project_id              CHAR(36)      NOT NULL,
  allocation_year         SMALLINT      NOT NULL,
  allocation_month        TINYINT       NOT NULL,
  days_worked             DECIMAL(5,2)  NOT NULL,
  working_days_base       TINYINT       NOT NULL,
  -- Snapshot columns — written once at creation, never updated
  cost_date               DATE          NOT NULL,
  salary_snapshot         DECIMAL(14,2) NOT NULL DEFAULT 0,
  sgk_snapshot            DECIMAL(14,2) NOT NULL DEFAULT 0,
  meal_snapshot           DECIMAL(14,2) NOT NULL DEFAULT 0,
  transportation_snapshot DECIMAL(14,2) NOT NULL DEFAULT 0,
  bonus_snapshot          DECIMAL(14,2) NOT NULL DEFAULT 0,
  accommodation_snapshot  DECIMAL(14,2) NOT NULL DEFAULT 0,
  other_snapshot          DECIMAL(14,2) NOT NULL DEFAULT 0,
  monthly_cost_snapshot   DECIMAL(14,2) NOT NULL,
  calculated_cost         DECIMAL(14,2) NOT NULL,
  -- -------------------------------------------------------
  notes                   TEXT              NULL,
  created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_allocation (employee_id, project_id, allocation_year, allocation_month),
  KEY idx_alloc_project_period (project_id, allocation_year, allocation_month),
  KEY idx_alloc_employee_period (employee_id, allocation_year, allocation_month),

  CONSTRAINT fk_alloc_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_alloc_project
    FOREIGN KEY (project_id) REFERENCES ak_projects(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Column notes:**

| Column | Note |
|---|---|
| `allocation_year` | 4-digit year: 2026 |
| `allocation_month` | 1–12. Application validates range. |
| `days_worked` | Decimal: 6.5, 10.0, 22.0. Must not cause the sum of `days_worked` for this employee × month across all projects to exceed `working_days_base`. See validation rule below. |
| `working_days_base` | Working days in that month (typically 20–23). Set by operator at allocation time. |
| `cost_date` | The date from which the cost period was read. Audit trail: shows exactly which cost snapshot was in effect. |
| `salary_snapshot` … `other_snapshot` | The 7 cost components copied verbatim from `ak_employee_cost_periods` at creation time. Never updated. |
| `monthly_cost_snapshot` | Pre-computed sum: salary + sgk + meal + transportation + bonus + accommodation + other. Stored for reporting convenience. |
| `calculated_cost` | `(days_worked / working_days_base) × monthly_cost_snapshot`. Stored at creation. Never recalculated. |
| `updated_at` | Remains for audit trail — records if operator corrects `notes`, `days_worked`, or `working_days_base`. If any allocation input changes, `calculated_cost` must also be recomputed and stored again. This is the only mutation permitted post-creation. |

**`days_worked` validation rule (owner decision 2026-06-24):**  
`days_worked` may not cause total allocation to exceed 100% of the employee's monthly cost. The application must enforce:

```
SUM(days_worked) across all allocation rows
WHERE employee_id = :employee_id
  AND allocation_year = :year
  AND allocation_month = :month
```

must be `<= working_days_base` after the INSERT or UPDATE. This check spans all projects — an employee working 12 days on Project A and 11 days on Project B in a 22-day month is valid (23 total > 22, blocked). If overtime occurs, it must be reflected by increasing the employee's cost period values (`bonus`, `other`, or a new cost period with adjusted salary) — not by allocating more than 100% of the monthly cost.

**Snapshot rule (immutable after creation):**  
The snapshot columns (`cost_date`, `*_snapshot`, `monthly_cost_snapshot`) must never be updated after the row is created, even if the operator corrects `days_worked`. If `days_worked` or `working_days_base` changes, only `calculated_cost` is recomputed — from the stored snapshot values, not from the live cost period.

---

## 4. Foreign Keys

Complete FK inventory across all five new tables.

| Table | Column | References | On Delete | On Update |
|---|---|---|---|---|
| `ak_employee_roles` | `employee_id` | `ak_employees(id)` | CASCADE | CASCADE |
| `ak_employee_roles` | `role_id` | `ak_roles(id)` | RESTRICT | CASCADE |
| `ak_employee_cost_periods` | `employee_id` | `ak_employees(id)` | CASCADE | CASCADE |
| `ak_employee_project_assignments` | `employee_id` | `ak_employees(id)` | CASCADE | CASCADE |
| `ak_employee_project_assignments` | `project_id` | `ak_projects(id)` | RESTRICT | CASCADE |
| `ak_employee_project_allocations` | `employee_id` | `ak_employees(id)` | CASCADE | CASCADE |
| `ak_employee_project_allocations` | `project_id` | `ak_projects(id)` | RESTRICT | CASCADE |

---

## 5. Delete Behaviors

### 5.1 Employee deleted → CASCADE to all child tables

Applies to: `ak_employee_roles`, `ak_employee_cost_periods`, `ak_employee_project_assignments`, `ak_employee_project_allocations`.

**Justification:** An employee's role history, cost periods, project assignments, and allocations exist only in relation to that employee. They have no independent business meaning once the employee is gone. The existing application already blocks employee deletion if `ak_financial_entries` or `ak_payment_plans` reference that employee — those pre-delete checks provide the primary safety gate. The new child tables are cascaded because they are structurally owned by the employee record.

**Note on `ak_employee_project_allocations`:** Cascading deletion of an employee removes their allocation rows, which affects historical project cost totals. This is acceptable because: (a) the application pre-delete check should also verify no allocations exist before allowing deletion, (b) a departed employee whose allocations must be preserved should be set to `status = 'Pasif'` rather than deleted.

**Recommendation:** Extend the existing pre-delete check in `employees.php` to also block deletion if `ak_employee_project_allocations.employee_id` rows exist.

### 5.2 Role deleted → RESTRICT

Applies to: `ak_employee_roles.role_id → ak_roles(id)`.

**Justification:** A role that has been assigned to any employee at any point in time is part of the historical record. Deleting a role that has active or historical assignments would corrupt the role history. RESTRICT forces the operator to end-date all employee role assignments (`ended_at`) before the role can be deleted. In practice, roles should be deactivated (`is_active = 0`) rather than deleted.

### 5.3 Project deleted → RESTRICT

Applies to: `ak_employee_project_assignments.project_id` and `ak_employee_project_allocations.project_id`.

**Justification:** Project deletion with linked employee assignments or allocations would silently destroy project membership history and project cost data. RESTRICT is mandatory here. A project with employee records must be archived at the application layer, not deleted. The existing system already has `ak_projects` referenced by `ak_financial_entries` and `ak_payment_plans` — those FKs use SET NULL. For the employee tables, RESTRICT is correct because the allocation's meaning (cost charged to project X) does not survive the project's deletion.

**Contrast with existing tables:** `ak_financial_entries.project_id` uses SET NULL (a financial entry can be "orphaned" from a project and still represent a cash event). An allocation row without a project is meaningless — it must be blocked.

### 5.4 `ak_financial_entries.employee_id` — existing, unchanged

SET NULL behavior remains. A financial entry records that cash moved for an employee. The entry retains meaning even if the employee record is deleted (the money was spent). This behavior is not changed by this migration.

---

## 6. Index Strategy

### `ak_roles`

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `PRIMARY KEY` | `id` | PK | UUID lookup |
| `uq_roles_normalized` | `normalized_name` | UNIQUE | Deduplication on INSERT; case/diacritic-insensitive search |

### `ak_employee_roles`

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `PRIMARY KEY` | `(employee_id, role_id, assigned_at)` | Composite PK | Prevents duplicate assignments; natural clustering |
| `idx_employee_roles_employee` | `employee_id` | Covering | "What roles does this employee hold?" — most common query |
| `idx_employee_roles_role` | `role_id` | Covering | "How many employees hold this role?" — reporting; FK support for RESTRICT |

### `ak_employee_cost_periods`

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `PRIMARY KEY` | `id` | PK | UUID lookup |
| `uq_cost_period_employee_from` | `(employee_id, effective_from)` | UNIQUE | Prevents two periods starting on the same date for one employee; enforces period uniqueness |
| `idx_cost_periods_employee` | `employee_id` | Covering | "All cost periods for employee X" — CRUD and allocation lookup |

The allocation workflow queries: `WHERE employee_id = ? AND effective_from <= :date AND (effective_to IS NULL OR effective_to >= :date)`. The `idx_cost_periods_employee` index serves this query; MySQL narrows by `employee_id` then scans a small number of rows per employee.

### `ak_employee_project_assignments`

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `PRIMARY KEY` | `id` | PK | UUID lookup |
| `idx_epa_employee` | `employee_id` | Covering | "All projects this employee has been assigned to" |
| `idx_epa_project` | `project_id` | Covering | "All employees assigned to this project" |
| `idx_epa_emp_proj` | `(employee_id, project_id)` | Composite | "Has this employee ever been on this project?" — allocation pre-check |

### `ak_employee_project_allocations`

| Index | Columns | Type | Purpose |
|---|---|---|---|
| `PRIMARY KEY` | `id` | PK | UUID lookup |
| `uq_allocation` | `(employee_id, project_id, allocation_year, allocation_month)` | UNIQUE | One allocation per employee per project per month — prevents double entry |
| `idx_alloc_project_period` | `(project_id, allocation_year, allocation_month)` | Composite | **Critical for project profitability queries**: `WHERE project_id = ? GROUP BY year, month` — the main reporting path |
| `idx_alloc_employee_period` | `(employee_id, allocation_year, allocation_month)` | Composite | "What did employee X cost us across all projects in month Y?" — per-employee reporting |

The project profitability query (`SUM(calculated_cost) WHERE project_id = X`) hits `idx_alloc_project_period` and is a covering scan — MySQL reads only index pages for the aggregation.

---

## 7. Snapshot Accounting Model

### Decision (owner, 2026-06-24)

Past project profitability figures must never change when employee cost periods are edited. Each allocation row permanently records the cost structure that was in effect when the allocation was created.

### Write path (allocation creation)

```
1. Operator inputs: employee_id, project_id, year, month, days_worked, working_days_base

1a. Application validates days_worked ceiling:
    SELECT COALESCE(SUM(days_worked), 0)
    FROM ak_employee_project_allocations
    WHERE employee_id = :employee_id
      AND allocation_year = :year
      AND allocation_month = :month
      AND id != :current_id  -- exclude row being edited, if this is an update

    existing_days + days_worked must be <= working_days_base.
    If exceeded → block with error:
    "Toplam tahsis bu ay için çalışma günü tabanını aşıyor."
    (Total allocation exceeds working_days_base for this month.)

2. Application looks up active cost period:
   SELECT * FROM ak_employee_cost_periods
   WHERE employee_id = :employee_id
     AND effective_from <= LAST_DAY(CONCAT(:year, '-', :month, '-01'))
     AND (effective_to IS NULL
          OR effective_to >= DATE(CONCAT(:year, '-', :month, '-01')))
   ORDER BY effective_from DESC
   LIMIT 1;

3. If no cost period found → block creation with error:
   "No active cost period for this employee in this month. Create a cost period first."

4. Application computes:
   monthly_cost_snapshot = salary + sgk + meal + transportation
                         + bonus + accommodation + other
   calculated_cost = (days_worked / working_days_base) * monthly_cost_snapshot

5. Application inserts allocation with all snapshot columns from step 2.

6. No further writes to snapshot columns ever occur.
```

### Correction path (days_worked or working_days_base changed by operator)

```
Operator updates days_worked or working_days_base on an existing allocation.

Application recomputes:
  calculated_cost = (new_days_worked / new_working_days_base) * monthly_cost_snapshot

monthly_cost_snapshot and all *_snapshot columns remain unchanged.
cost_date remains unchanged.

Only calculated_cost, days_worked, working_days_base, notes, updated_at may change.
```

### What must never happen

- Updating `salary_snapshot` or any `*_snapshot` column after the row is created.
- Recalculating old allocations when a cost period is edited.
- Any background job, trigger, or service that mutates `calculated_cost` based on current cost period values.

### Audit trail

`cost_date` tells a future reader: "this allocation used the cost period that was active on this date." If there is ever a question about why an allocation shows a particular cost, the operator can look up `ak_employee_cost_periods WHERE employee_id = X AND effective_from <= cost_date AND (effective_to IS NULL OR effective_to >= cost_date)` to see exactly what the cost structure was.

---

## 8. Reporting Query Strategy

### 8.1 Project total employee cost (the primary goal)

```sql
SELECT
    SUM(a.calculated_cost) AS total_employee_cost
FROM ak_employee_project_allocations a
WHERE a.project_id = :project_id;
```

Uses: `idx_alloc_project_period`. Fast at any scale.

### 8.2 Project employee cost — breakdown by employee and month

```sql
SELECT
    e.full_name,
    a.allocation_year,
    a.allocation_month,
    a.days_worked,
    a.working_days_base,
    a.monthly_cost_snapshot,
    a.calculated_cost
FROM ak_employee_project_allocations a
JOIN ak_employees e ON e.id = a.employee_id
WHERE a.project_id = :project_id
ORDER BY a.allocation_year, a.allocation_month, e.full_name;
```

### 8.3 Employee cost — all projects in a period

```sql
SELECT
    p.title           AS project_name,
    a.allocation_year,
    a.allocation_month,
    a.days_worked,
    a.calculated_cost
FROM ak_employee_project_allocations a
JOIN ak_projects p ON p.id = a.project_id
WHERE a.employee_id = :employee_id
  AND (a.allocation_year > :from_year
       OR (a.allocation_year = :from_year AND a.allocation_month >= :from_month))
  AND (a.allocation_year < :to_year
       OR (a.allocation_year = :to_year AND a.allocation_month <= :to_month))
ORDER BY a.allocation_year, a.allocation_month;
```

### 8.4 Company-wide personnel cost by month

```sql
SELECT
    a.allocation_year,
    a.allocation_month,
    SUM(a.calculated_cost) AS total_allocated,
    COUNT(DISTINCT a.employee_id) AS employee_count
FROM ak_employee_project_allocations a
GROUP BY a.allocation_year, a.allocation_month
ORDER BY a.allocation_year, a.allocation_month;
```

### 8.5 Employee's current roles

```sql
SELECT r.name
FROM ak_employee_roles er
JOIN ak_roles r ON r.id = er.role_id
WHERE er.employee_id = :employee_id
  AND er.ended_at IS NULL;
```

### 8.6 Active cost period for an employee (used by allocation creation)

`ORDER BY effective_from DESC LIMIT 1` is mandatory on all cost period lookups. Without it the result is non-deterministic if two periods overlap due to a data entry error.

```sql
SELECT *
FROM ak_employee_cost_periods
WHERE employee_id = :employee_id
  AND effective_from <= :reference_date
  AND (effective_to IS NULL OR effective_to >= :reference_date)
ORDER BY effective_from DESC
LIMIT 1;
```

### 8.7 Idle cost (informational only — not allocated to projects)

```sql
SELECT
    e.full_name,
    cp.effective_from,
    cp.effective_to,
    (cp.salary + cp.sgk + cp.meal + cp.transportation
     + cp.bonus + cp.accommodation + cp.other) AS total_monthly_cost,
    COALESCE(
        (SELECT SUM(a.calculated_cost)
         FROM ak_employee_project_allocations a
         WHERE a.employee_id = e.id
           AND a.allocation_year = YEAR(:month_date)
           AND a.allocation_month = MONTH(:month_date)),
    0) AS allocated_cost
FROM ak_employees e
JOIN ak_employee_cost_periods cp
    ON cp.employee_id = e.id
    AND cp.effective_from <= :month_date
    AND (cp.effective_to IS NULL OR cp.effective_to >= :month_date)
-- Idle cost = total_monthly_cost - allocated_cost
-- Not stored. Computed at query time for informational display only.
```

---

## 9. Backward Compatibility Plan

The migration is fully additive. No existing table is altered. No existing API changes in Phase 1. The three phases represent operational readiness levels.

### Phase 1 — Schema Only (tables created, no application code yet)

**Deploy:** SQL migrations for all 5 new tables.  
**Result:** Tables exist in production. No data. No API. No UI.  
**Current system:** 100% unaffected. All existing endpoints and pages operate normally.  
**`ak_employees.role`:** Still the only role field in use. Fully functional.

This phase can be deployed to production immediately after SQL review and approval. Zero risk.

### Phase 2 — Cost Periods + Roles (data entry unlocked)

**Deploy:**
- `ak_roles` seeded with standard roles.
- New API endpoints: roles CRUD, cost periods CRUD, employee roles CRUD.
- New UI: employee roles management, cost period management.

**Result:** Operators can enter employee cost structures and assign roles. No allocation yet.  
**Current system:** Existing employee list, financial statement, dashboard — unchanged.  
**`ak_employees.role`:** Still functional. Operators can use both the old field and the new role system in parallel. No forced migration.

### Phase 3 — Allocations + Project Assignments (profitability unlocked)

**Hard prerequisite before this phase goes live:**  
The pre-delete check in `employees.php` must be extended to block employee deletion when `ak_employee_project_allocations.employee_id` rows exist. Without this guard, an operator can delete an employee and silently cascade-destroy historical project cost data. This check must ship in the same deploy as allocation CRUD — not as a follow-up.

**Deploy:**
- Extended pre-delete check in `employees.php` (mandatory — see above).
- New API endpoints: project assignment CRUD, allocation CRUD.
- New UI: monthly allocation entry screen, project employee cost view.
- Dashboard: add allocated cost per project alongside existing entry-based totals.

**Result:** Full project profitability from personnel is computable.  
**`ak_employees.role`:** Now deprecated. UI presents the new multi-role system as primary. The `role` text field is moved to an "advanced / legacy" section in the employee form. A future phase can remove it once all data is migrated.  
**When to remove `role` column:** Only after: (a) all employees have roles in `ak_employee_roles`, (b) no API consumer reads `employees.role` for display, (c) a migration plan exists for the `AdminEmployee.role` TypeScript field.

---

## 10. Rollback Strategy

### Phase 1 rollback (schema only)

All five tables are new. Rollback is:

```sql
DROP TABLE IF EXISTS ak_employee_project_allocations;
DROP TABLE IF EXISTS ak_employee_project_assignments;
DROP TABLE IF EXISTS ak_employee_cost_periods;
DROP TABLE IF EXISTS ak_employee_roles;
DROP TABLE IF EXISTS ak_roles;
```

Order is mandatory — reverse of creation order to respect FK dependencies.

**Data loss:** None — no existing table is modified. Existing data in `ak_employees`, `ak_financial_entries`, `ak_payment_plans` is untouched.

### Phase 2 rollback

If API or UI for cost periods/roles must be rolled back:

1. Revert the PHP and React deploy (restore previous build via FTP).
2. The tables remain in place with whatever data was entered.
3. Optionally clear seed data from `ak_roles` and `ak_employee_roles` if needed.
4. No structural rollback required — tables can remain empty.

**Data loss from table drops:** Any cost periods or role assignments entered by operators are lost. This is acceptable if Phase 2 is rolled back before go-live; not acceptable after operators have been using the system.

### Phase 3 rollback

1. Revert to Phase 2 deploy (FTP restore).
2. Allocation and assignment tables retain their data.
3. Dashboard reverts to entry-based personnel totals only.

**No allocation data is lost** unless the tables are explicitly dropped. Allocations already entered remain and will be available when Phase 3 is redeployed.

### General rollback rule

> Do not drop any table that contains operator-entered data without explicit owner approval and a data export.

Before any DROP in Phase 2 or 3, run:
```sql
SELECT COUNT(*) FROM ak_employee_cost_periods;
SELECT COUNT(*) FROM ak_employee_roles;
SELECT COUNT(*) FROM ak_employee_project_assignments;
SELECT COUNT(*) FROM ak_employee_project_allocations;
```

If counts > 0, export the data first.

---

## 11. Migration Ordering

FK dependencies determine the only valid creation order. A table cannot be created before the tables it references.

```
Step 1:  ak_roles
         (no FK dependencies)

Step 2:  ak_employee_roles
         (depends on: ak_employees ✓ exists, ak_roles ✓ just created)

Step 3:  ak_employee_cost_periods
         (depends on: ak_employees ✓ exists)

Step 4:  ak_employee_project_assignments
         (depends on: ak_employees ✓ exists, ak_projects ✓ exists)

Step 5:  ak_employee_project_allocations
         (depends on: ak_employees ✓ exists, ak_projects ✓ exists)
         Note: does not FK to ak_employee_cost_periods — snapshot values
         are copied in, not referenced. This is by design.
```

**DROP order (rollback):**
```
Step 5 → Step 4 → Step 3 → Step 2 → Step 1
```

### Why `ak_employee_project_allocations` does not FK to `ak_employee_cost_periods`

The snapshot model requires that allocation rows survive even if a cost period is later deleted (e.g., if a data correction is needed). A FK to `ak_employee_cost_periods` with RESTRICT would block the cost period deletion. With RESTRICT the allocation is protected; with CASCADE the snapshot is destroyed — neither is acceptable. The correct design is: copy the values at creation time and store no reference. The `cost_date` column provides the audit trail without a live FK.

---

## 12. Final Recommendation

### APPROVED TABLES

| Table | Action | FK dependencies | Notes |
|---|---|---|---|
| `ak_employees` | KEEP — no changes | — | `role` column deprecated-in-place; do not alter now |
| `ak_roles` | CREATE | None | Seed with standard role catalog on first deploy |
| `ak_employee_roles` | CREATE | `ak_employees`, `ak_roles` | Multi-role, historical |
| `ak_employee_cost_periods` | CREATE | `ak_employees` | Historical cost structure; open-ended periods use NULL `effective_to` |
| `ak_employee_project_assignments` | CREATE | `ak_employees`, `ak_projects` | Formal membership with date range |
| `ak_employee_project_allocations` | CREATE | `ak_employees`, `ak_projects` | Snapshot accounting; never recalculated from live cost periods |

**Rejected (not created):** `ak_employee_work_logs`

---

### APPROVED RELATIONSHIPS

| Relationship | Type | Delete behavior |
|---|---|---|
| `ak_employee_roles.employee_id → ak_employees.id` | Many-to-one | CASCADE |
| `ak_employee_roles.role_id → ak_roles.id` | Many-to-one | RESTRICT |
| `ak_employee_cost_periods.employee_id → ak_employees.id` | Many-to-one | CASCADE |
| `ak_employee_project_assignments.employee_id → ak_employees.id` | Many-to-one | CASCADE |
| `ak_employee_project_assignments.project_id → ak_projects.id` | Many-to-one | RESTRICT |
| `ak_employee_project_allocations.employee_id → ak_employees.id` | Many-to-one | CASCADE |
| `ak_employee_project_allocations.project_id → ak_projects.id` | Many-to-one | RESTRICT |
| `ak_employee_project_allocations` → `ak_employee_cost_periods` | None (snapshot) | No FK — values copied at creation |

---

### IMPLEMENTATION READINESS

| Item | Status |
|---|---|
| Business rules confirmed by owner | ✓ |
| Daily work-log model rejected | ✓ |
| Snapshot accounting model confirmed | ✓ |
| Table specifications complete | ✓ |
| FK and delete behavior justified | ✓ |
| Index strategy defined | ✓ |
| Reporting queries designed | ✓ |
| Backward compatibility plan (3 phases) | ✓ |
| Rollback strategy defined | ✓ |
| Migration order defined | ✓ |
| SQL migration scripts | **Pending — Phase 6B** |
| API design (cost periods, allocations, roles) | **Pending** |
| UI design (allocation entry screen) | **Pending** |
| `ak_roles` seed data list | **Pending owner review** |
| Pre-delete check extension in `employees.php` | **Required — hard prerequisite before Phase 3 go-live** |
| `ak_payment_plans.employee_id` FK addition | **Pending (independent, low risk)** |

**Next step:** Author the Phase 6B SQL migration scripts for all five tables in the order defined in section 11. Do not modify runtime code until Phase 2 deploy planning is complete.
