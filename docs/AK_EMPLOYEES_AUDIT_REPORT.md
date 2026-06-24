# ak_employees — Phase 6/21 Audit Report

**Date:** 2026-06-24  
**Revised:** 2026-06-24 — Owner architecture revision applied (see sections 8 and 9)  
**Scope:** Read-only. No schema changes. No migrations generated.  
**Status:** Final approved direction confirmed. Ready for migration design.

---

## 1. Current Schema

**Source:** `public_html/install-schema.php`

```sql
CREATE TABLE IF NOT EXISTS ak_employees (
  id           CHAR(36)     NOT NULL PRIMARY KEY,
  full_name    VARCHAR(255) NOT NULL,
  phone        VARCHAR(100) NULL,
  role         VARCHAR(100) NULL,
  notes        TEXT         NULL,
  status       VARCHAR(50)  NOT NULL DEFAULT 'Aktif',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
```

**8 columns. No indexes. No foreign keys.**

### Tables that reference ak_employees

| Table | Column | Index | FK Constraint |
|---|---|---|---|
| `ak_financial_entries` | `employee_id CHAR(36) NULL` | `idx_financial_entries_employee_id` | `ON DELETE SET NULL` ✓ |
| `ak_payment_plans` | `employee_id CHAR(36) NULL` | `idx_payment_plans_employee_id` | None — soft reference only |

### Current `ak_employees` TypeScript type

```typescript
export interface AdminEmployee {
  id: string;
  full_name: string;
  phone: string | null;
  role: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
```

---

## 2. Runtime Dependency Map

### PHP API layer

| File | Methods | ak_employees usage |
|---|---|---|
| `employees.php` | GET, POST, PATCH, DELETE | Full CRUD. Pre-delete check: blocks if `ak_payment_plans.employee_id` or `ak_financial_entries.employee_id` references exist. |
| `financial-statement.php` | GET, POST, PATCH, DELETE | GET: SELECT all employees for dropdown. POST/PATCH: validates owner (`employee_id`) when `card_type = 'employee'`. |
| `payment-plans.php` | GET, POST, PATCH, DELETE | `employee_id` is one of three mutually exclusive owner fields (customer / employee / expense_card). Exactly one required. |
| `dashboard.php` | GET | Multiple JOIN queries and aggregations: personnel cost total, personnel financial cards, upcoming personnel payments, drilldown rows by salary/advance/reimbursement kind. |
| `canonical-transaction-service.php` | (service) | Passes `employee_id` through in allowed INSERT column list for `ak_financial_entries`. |

### TypeScript API client

| Function | Purpose |
|---|---|
| `getAdminEmployees()` | Fetches all employees as dropdown / list data |
| `createAdminEmployee(payload)` | POST to create |
| `updateAdminEmployee(payload)` | PATCH to update |
| `deleteAdminEmployee(id)` | DELETE (server enforces pre-checks) |
| `getAdminFinancialStatement("employee", id)` | Full financial statement for one employee |

### React pages

| Route | Component | Purpose |
|---|---|---|
| `/admin/personeller` | `AdminEmployees.tsx` | List view, CRUD, status filter, navigation to finance statement |
| `/admin/personeller/:id/finans` | `AdminEmployeeFinance.tsx` → `FinancialStatementPage` | Full ledger for one employee: entries, payment plans, payments |

### Financial type system

- `CardType = "customer" | "employee" | "expense"` — employee is a first-class financial entity.
- `AdminFinancialStatementKind = "project" | "customer" | "employee" | "expense"`
- `AdminPersonnelFinancialCard` type carries: `salary_paid`, `advances_paid`, `expense_reimbursements`, `total_personnel_cost`, `remaining_payable`, `overdue_payable`, official vs. unofficial variants.
- `FinanceLookups.employees: Map<string, AdminEmployee>` — employees loaded into every financial view as a lookup map.

### Dashboard integration

The dashboard aggregates employee costs from `ak_financial_entries WHERE employee_id IS NOT NULL`:
- Total personnel cost sum
- Per-employee financial cards (salary / advances / reimbursements)
- Upcoming payment plan obligations
- Drilldown rows by entry type

---

## 3. Business Rule Compliance

| # | Business Rule | Current Status | Gap |
|---|---|---|---|
| 1 | ak_employees represents real people we directly pay. Subcontractor companies and their personnel are excluded. | Enforced at data-entry convention only — schema has no constraint. | **LOW** — document-level rule; acceptable until a `type` discriminator is needed. |
| 2 | Multi-role support | `role VARCHAR(100)` — single free-text field, one value per employee | **GAP** — no enumerated roles, no multi-role support, no role history |
| 3 | Multi-project support | No formal project membership table | **GAP** — project link is only inferred from `ak_financial_entries.project_id WHERE employee_id IS NOT NULL` |
| 4 | Project membership must be historical (start_date, end_date) | No such table or columns | **GAP** — entirely missing |
| 5 | Employee costs must be historical (salary, sgk, meal, transportation, bonus, accommodation, other) | `ak_financial_entries` carries costs as ad-hoc ledger entries with no structured cost-component breakdown per period | **PARTIAL** — costs exist as general entries, not as period-structured components |
| 6 | Cost allocation model: monthly man-day based (not daily attendance) | No allocation concept exists anywhere | **GAP** — entirely missing |
| 7 | Only project-related employee cost enters project profitability | No allocation mechanism; project_id on financial entries is optional and manually set | **GAP** — uncontrolled |
| 8 | Employee idle time is NOT allocated to projects | Unallocated time has no representation | **GAP** — no mechanism to distinguish idle vs. allocated |
| 9 | Goal: exact project employee cost | Cannot be computed — no monthly cost record, no allocation table | **GAP** — unachievable without new tables |

**Summary:** Master data and financial entry linkage work correctly. All project cost allocation requirements are unmet.

---

## 4. Gap Analysis

### 4.1 Missing tables

| Missing Table | Purpose | Priority |
|---|---|---|
| `ak_employee_cost_periods` | Historical cost breakdown per employee per period: salary, SGK, meal, transportation, bonus, accommodation, other | **HIGH** |
| `ak_employee_project_assignments` | Formal project membership with start/end dates | **HIGH** |
| `ak_employee_project_allocations` | Monthly man-day allocation: employee × project × month → allocated cost | **HIGH** |
| `ak_roles` | Enumerated role catalog (Formen, Makine Operatörü, Mühendis, etc.) | **MEDIUM** |
| `ak_employee_roles` | Junction table: employee ↔ role with assignment and end dates | **MEDIUM** |

### 4.2 Wrong or missing columns on `ak_employees`

| Column | Issue | Decision |
|---|---|---|
| `role VARCHAR(100)` | Free text, single value. Target model uses `ak_roles` + `ak_employee_roles`. | Keep temporarily for backward compatibility. Do not rename to `job_title` as the final solution — structured role tables are the target. |
| `notes TEXT` | Generic memo field, no defined semantics | Keep as-is |
| `phone VARCHAR(100)` | Single phone field | No gap |
| `status VARCHAR(50)` | Values 'Aktif' / 'Pasif' validated in PHP only, not enforced in schema | Add CHECK constraint in future migration |

### 4.3 Unused columns

None — all current columns appear in API responses and UI.

### 4.4 Required tables — detailed specifications

#### `ak_employee_cost_periods`

```
id               CHAR(36) PK
employee_id      CHAR(36) FK → ak_employees(id) ON DELETE CASCADE
effective_from   DATE NOT NULL
effective_to     DATE NULL            -- NULL = active period (open-ended)
salary           DECIMAL(14,2) NOT NULL DEFAULT 0
sgk              DECIMAL(14,2) NOT NULL DEFAULT 0
meal             DECIMAL(14,2) NOT NULL DEFAULT 0
transportation   DECIMAL(14,2) NOT NULL DEFAULT 0
bonus            DECIMAL(14,2) NOT NULL DEFAULT 0
accommodation    DECIMAL(14,2) NOT NULL DEFAULT 0
other            DECIMAL(14,2) NOT NULL DEFAULT 0
notes            TEXT NULL
created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
UNIQUE KEY uq_employee_period (employee_id, effective_from)
```

Purpose: Historical monthly cost structure. Enables total employee cost for any period without parsing free-text financial entries.

#### `ak_employee_project_assignments`

```
id           CHAR(36) PK
employee_id  CHAR(36) FK → ak_employees(id) ON DELETE CASCADE
project_id   CHAR(36) FK → ak_projects(id) ON DELETE CASCADE
start_date   DATE NOT NULL
end_date     DATE NULL      -- NULL = currently assigned
notes        TEXT NULL
created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
KEY idx_epa_employee (employee_id)
KEY idx_epa_project (project_id)
```

Purpose: Formal, time-bounded project membership. Makes "which employees worked on project X and when" a schema-level query. Does not carry role — role is tracked separately via `ak_employee_roles`.

#### `ak_employee_project_allocations`

**Accounting model: snapshot.** When an allocation is created, the cost values from `ak_employee_cost_periods` valid at that moment are copied into the allocation row and frozen. Editing a cost period later does NOT recalculate past allocations. Historical project costs are immutable once recorded.

```
id                        CHAR(36) PK
employee_id               CHAR(36) FK → ak_employees(id) ON DELETE CASCADE
project_id                CHAR(36) FK → ak_projects(id) ON DELETE CASCADE
allocation_year           SMALLINT NOT NULL       -- e.g. 2026
allocation_month          TINYINT NOT NULL        -- 1–12
days_worked               DECIMAL(5,2) NOT NULL   -- e.g. 6.5
working_days_base         TINYINT NOT NULL        -- e.g. 22 (working days in that month)
-- ── Snapshot columns — copied from ak_employee_cost_periods at creation time ──
cost_date                 DATE NOT NULL           -- the date the cost period was read
salary_snapshot           DECIMAL(14,2) NOT NULL DEFAULT 0
sgk_snapshot              DECIMAL(14,2) NOT NULL DEFAULT 0
meal_snapshot             DECIMAL(14,2) NOT NULL DEFAULT 0
transportation_snapshot   DECIMAL(14,2) NOT NULL DEFAULT 0
bonus_snapshot            DECIMAL(14,2) NOT NULL DEFAULT 0
accommodation_snapshot    DECIMAL(14,2) NOT NULL DEFAULT 0
other_snapshot            DECIMAL(14,2) NOT NULL DEFAULT 0
monthly_cost_snapshot     DECIMAL(14,2) NOT NULL  -- sum of all snapshot components at creation
calculated_cost           DECIMAL(14,2) NOT NULL  -- (days_worked / working_days_base) × monthly_cost_snapshot
-- ─────────────────────────────────────────────────────────────────────────────
notes                     TEXT NULL
created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
UNIQUE KEY uq_allocation (employee_id, project_id, allocation_year, allocation_month)
KEY idx_alloc_project_period (project_id, allocation_year, allocation_month)
```

Purpose: The monthly cost allocation record. One row per employee per project per month. All cost components are snapshotted at creation so project profitability reports reflect the cost known at that time and are never disturbed by later cost period edits.

**Allocation formula (applied at creation, then frozen):**

```
monthly_cost_snapshot = salary_snapshot + sgk_snapshot + meal_snapshot
                      + transportation_snapshot + bonus_snapshot
                      + accommodation_snapshot + other_snapshot
daily_rate            = monthly_cost_snapshot / working_days_base
calculated_cost       = days_worked × daily_rate
```

**Example from business rules:**

```
monthly_cost_snapshot = 22,000 TL
working_days_base     = 22
days_worked           = 6.5
calculated_cost       = (6.5 / 22) × 22,000 = 6,500 TL
```

**Snapshot guarantee:** If the employee's salary is later raised, existing allocation rows keep the old `monthly_cost_snapshot`. New allocations in subsequent months pick up the new cost period. Past project profitability figures never move.

#### `ak_roles`

```
id               CHAR(36) PK
name             VARCHAR(100) NOT NULL        -- e.g. 'Formen', 'Makine Operatörü'
normalized_name  VARCHAR(100) NOT NULL        -- lowercase, no diacritics, for dedup/search
is_active        TINYINT(1) NOT NULL DEFAULT 1
created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
UNIQUE KEY uq_role_normalized (normalized_name)
```

Purpose: Enumerated role catalog. Prevents free-text drift ("Formen" vs "formen" vs "Foreman"). New roles can be added by inserting a row.

#### `ak_employee_roles`

```
employee_id  CHAR(36) FK → ak_employees(id) ON DELETE CASCADE
role_id      CHAR(36) FK → ak_roles(id) ON DELETE RESTRICT
assigned_at  DATE NOT NULL
ended_at     DATE NULL      -- NULL = currently active role
PRIMARY KEY (employee_id, role_id, assigned_at)
KEY idx_er_employee (employee_id)
KEY idx_er_role (role_id)
```

Purpose: Many-to-many employee ↔ role with temporal tracking. An employee can hold multiple simultaneous roles (e.g. Formen + Makine Operatörü) and role history is preserved when roles change.

### 4.5 Project cost allocation — target query

```sql
SELECT
    a.project_id,
    SUM(a.calculated_cost) AS total_allocated_employee_cost
FROM ak_employee_project_allocations a
WHERE a.project_id = :project_id
GROUP BY a.project_id;
```

Per-employee breakdown:

```sql
SELECT
    e.full_name,
    a.allocation_year,
    a.allocation_month,
    a.days_worked,
    a.working_days_base,
    a.calculated_cost
FROM ak_employee_project_allocations a
JOIN ak_employees e ON e.id = a.employee_id
WHERE a.project_id = :project_id
ORDER BY a.allocation_year, a.allocation_month, e.full_name;
```

Both queries are possible only after `ak_employee_cost_periods` and `ak_employee_project_allocations` are created and populated.

---

## 5. ~~Recommended Target Architecture~~ (superseded)

> **This section is superseded by sections 8 and 9.**  
> The original recommendation included `ak_employee_work_logs` (daily attendance tracking). This was rejected by the owner. See section 8 for the rejection record and section 9 for the approved direction.

---

## 6. Migration Risk Assessment

| Risk | Severity | Notes |
|---|---|---|
| `role` column on `ak_employees` — kept for backward compatibility | **LOW** | Do not rename or remove until `ak_employee_roles` is live and all API/UI consumers have migrated. The column becomes deprecated-in-place. |
| Adding `ak_employee_cost_periods` | **LOW** | New table, no existing data affected. UI and API built from scratch. |
| Adding `ak_employee_project_assignments` | **LOW** | New table. Existing `ak_financial_entries.project_id` records remain valid and untouched. |
| Adding `ak_employee_project_allocations` | **LOW** | New table. Initial data empty. Users enter allocations going forward. |
| Adding `ak_roles` + `ak_employee_roles` | **LOW** | New tables. Seed with common roles (Formen, Makine Operatörü, Mühendis, Ustabaşı, etc.) on first deploy. |
| `calculated_cost` — snapshot accounting | **NONE** | Snapshot model adopted (owner decision 2026-06-24). Past allocations are immutable. No recalculation on cost period edit. No recalculation API needed. |
| Backfilling cost periods from existing financial entries | **MEDIUM** | Existing salary entries are free-text; cannot be auto-parsed into structured cost periods. Manual entry required for each employee. No automated migration. |
| Historical allocation backfill | **MEDIUM** | No attendance data exists. Past allocations cannot be recovered. Acceptable gap — start recording from go-live date. Older project cost reports will show zero allocation. |
| Dashboard personnel cost queries | **MEDIUM** | Once allocations exist, dashboard should show allocated cost per project alongside existing entry-based totals. Parallel display change, not a breaking replacement. |
| `ak_payment_plans.employee_id` — missing FK | **LOW** | Add FK constraint to match `ak_financial_entries` pattern. No data migration — constraint addition only. |

---

## 7. Pre-Revision Recommendation (archived)

The original gap analysis recommended three new tables:

| Table | Original status |
|---|---|
| `ak_employee_cost_periods` | Recommended — **retained in revised direction** |
| `ak_employee_project_assignments` | Recommended — **retained in revised direction** |
| `ak_employee_work_logs` | Recommended — **REJECTED** (see section 8) |

The original recommendation also included renaming `role` → `job_title`. This was **overridden** in the owner revision — the `role` column is kept for backward compatibility and the target solution is `ak_roles` + `ak_employee_roles`.

---

## 8. Owner Revision — Daily Work Logs Rejected

**Decision date:** 2026-06-24  
**Decision by:** Owner

### What was proposed

The initial audit (section 4.5 and original section 5) recommended `ak_employee_work_logs`: a daily attendance table with one row per employee per project per day, using a `day_fraction` field.

### Why it was rejected

The project does not need a daily attendance (puantaj) system. The goal is **project-based profitability**, not workforce management. Daily log entry would create significant operational overhead for no additional analytical value over monthly allocation.

### What replaces it

`ak_employee_project_allocations` — a monthly table where an administrator enters, once per month per employee per project: how many days that employee worked on that project and what the working-day base for that month was. The system stores the computed cost.

This achieves the same analytical outcome (exact project employee cost) with a fraction of the data entry burden.

### Rejected table specification (for historical reference)

```
-- REJECTED: ak_employee_work_logs
-- Reason: daily attendance tracking not required.
-- Replaced by: ak_employee_project_allocations (monthly)
id             CHAR(36) PK
employee_id    CHAR(36) FK → ak_employees(id)
project_id     CHAR(36) FK → ak_projects(id)
log_date       DATE NOT NULL
day_fraction   DECIMAL(4,2) NOT NULL DEFAULT 1.00
notes          TEXT NULL
```

---

## 9. Final Approved Direction

**Approved by owner: 2026-06-24**  
**Snapshot accounting decision: 2026-06-24** — past allocations are immutable; cost period edits do not retroactively affect recorded project costs.

### ak_employees — KEEP, extend

The table stays as-is. The `role` column is kept for backward compatibility during the transition. It is not renamed to `job_title`. It becomes deprecated-in-place once `ak_employee_roles` is live.

### New tables — approved

| Table | Status | Depends on |
|---|---|---|
| `ak_employee_cost_periods` | **APPROVED** | `ak_employees` |
| `ak_employee_project_assignments` | **APPROVED** | `ak_employees`, `ak_projects` |
| `ak_employee_project_allocations` | **APPROVED** | `ak_employees`, `ak_projects` |
| `ak_roles` | **APPROVED** | (none) |
| `ak_employee_roles` | **APPROVED** | `ak_employees`, `ak_roles` |

### Rejected tables

| Table | Status |
|---|---|
| `ak_employee_work_logs` | **REJECTED** — daily attendance not needed |

### Relationship diagram (approved)

```
ak_roles
    │
    └── ak_employee_roles ──────────────── ak_employees
                                               │
                                               ├── ak_employee_cost_periods
                                               │       effective_from / effective_to
                                               │       salary, sgk, meal, transportation,
                                               │       bonus, accommodation, other
                                               │
                                               ├── ak_employee_project_assignments
                                               │       start_date / end_date
                                               │       ↕
                                               │   ak_projects
                                               │
                                               └── ak_employee_project_allocations
                                                       allocation_year + allocation_month
                                                       days_worked / working_days_base
                                                       calculated_cost (stored)
                                                       ↕
                                                   ak_projects
```

### Financial model after implementation

| Concern | Current | After |
|---|---|---|
| Employee cash flow | `ak_financial_entries` with `employee_id` | Unchanged — salary paid, advances, reimbursements remain in financial entries |
| Project employee cost | Not computable | `SUM(calculated_cost)` from `ak_employee_project_allocations WHERE project_id = X` — values are frozen snapshots, never retroactively changed |
| Employee cost structure | Ad-hoc entries | Structured in `ak_employee_cost_periods` |
| Project membership | Inferred from entries | Explicit in `ak_employee_project_assignments` |
| Employee roles | Single free-text `role` column | `ak_employee_roles` → `ak_roles` (multi-role, historical) |
| Idle time | Not tracked | Unallocated months/days simply have no allocation row — never enter project cost |

### Implementation sequence (pending migration design approval)

1. **`ak_roles`** — seed with common roles; no FK dependencies
2. **`ak_employee_roles`** — junction table; depends on step 1
3. **`ak_employee_cost_periods`** — enter current cost structure for each active employee
4. **`ak_employee_project_assignments`** — assign employees to active projects
5. **`ak_employee_project_allocations`** — begin monthly allocation entry; retrospective backfill optional
6. **Dashboard** — add allocated-cost-per-project display alongside existing entry-based totals
7. **Deprecate `ak_employees.role`** — once `ak_employee_roles` UI is live and data is migrated

### What remains pending before implementation

- [ ] Migration SQL scripts for all 5 new tables (not generated yet — pending this approval)
- [ ] API design for `ak_employee_cost_periods` (CRUD endpoints)
- [ ] API design for `ak_employee_project_allocations` (CRUD + recalculation on cost period edit)
- [ ] API design for `ak_roles` and `ak_employee_roles`
- [ ] UI design for monthly allocation entry screen
- [ ] Seed data for `ak_roles` (initial role catalog)
- [x] Decision: snapshot accounting adopted — past allocations are immutable; no recalculation on cost period edit (owner decision 2026-06-24)
- [ ] FK constraint addition on `ak_payment_plans.employee_id` (minor, can be done independently)
