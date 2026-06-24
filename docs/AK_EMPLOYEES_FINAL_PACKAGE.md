# ak_employees — Phase 6 Finalization Package

**Date:** 2026-06-24  
**Phase:** 6/21 — Complete implementation package. Do NOT start 7/21 until closure criteria are met.  
**Source documents:**
- [docs/AK_EMPLOYEES_AUDIT_REPORT.md](AK_EMPLOYEES_AUDIT_REPORT.md)
- [docs/AK_EMPLOYEES_MIGRATION_DESIGN.md](AK_EMPLOYEES_MIGRATION_DESIGN.md)
- [docs/AK_EMPLOYEES_MIGRATION_REVIEW.md](AK_EMPLOYEES_MIGRATION_REVIEW.md)

---

## 1. Executive Summary

### Final approved architecture

Five new tables are added around `ak_employees`. No existing table is altered. All existing API endpoints, pages, and financial entries operate unchanged through all three deployment phases.

| Table | Action | Purpose |
|---|---|---|
| `ak_employees` | KEEP — no structural changes | Master data; `role` column kept, deprecated-in-place |
| `ak_roles` | CREATE | Enumerated role catalog |
| `ak_employee_roles` | CREATE | Employee ↔ role, many-to-many, historical |
| `ak_employee_cost_periods` | CREATE | Historical monthly cost structure per employee |
| `ak_employee_project_assignments` | CREATE | Formal project membership with date range |
| `ak_employee_project_allocations` | CREATE | Monthly man-day allocation, snapshot accounting |

**Rejected:** `ak_employee_work_logs` (daily attendance — not needed).

### Accounting model

Snapshot. When an allocation is created, all cost values are copied from `ak_employee_cost_periods` and frozen permanently. Editing a cost period later does not change any existing allocation. Project profitability figures are immutable once recorded.

### days_worked ceiling rule (owner decision 2026-06-24)

`SUM(days_worked)` across all projects for a given `(employee_id, year, month)` must not exceed `working_days_base`. Overtime is handled through cost period adjustments (`bonus`, `other`, updated salary) — not by allocating above 100%.

### Pre-delete protection rule (owner decision 2026-06-24)

Extending `employees.php` to block deletion when allocation rows exist is a hard prerequisite for Phase 3 go-live, not a follow-up.

---

## 2. Migration SQL

Execute in the order shown. Each statement is safe to run independently. All use `IF NOT EXISTS` and `IF EXISTS` guards so re-execution is harmless.

### Step 1 — `ak_roles`

No FK dependencies. Must be created before `ak_employee_roles`.

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

Seed data — insert after table is created:

```sql
INSERT IGNORE INTO ak_roles (id, name, normalized_name) VALUES
  (UUID(), 'Formen',            'formen'),
  (UUID(), 'Ustabaşı',          'ustabasi'),
  (UUID(), 'Makine Operatörü',  'makine operatoru'),
  (UUID(), 'Mühendis',          'muhendis'),
  (UUID(), 'Şef Mühendis',      'sef muhendis'),
  (UUID(), 'Şantiye Şefi',      'santiye sefi'),
  (UUID(), 'İşçi',              'isci'),
  (UUID(), 'Serbest Çalışan',   'serbest calisan');
```

`INSERT IGNORE` on `normalized_name` UNIQUE prevents duplicates if re-run.

---

### Step 2 — `ak_employee_roles`

Depends on: `ak_employees` (exists), `ak_roles` (step 1).

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

---

### Step 3 — `ak_employee_cost_periods`

Depends on: `ak_employees` (exists).

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

---

### Step 4 — `ak_employee_project_assignments`

Depends on: `ak_employees` (exists), `ak_projects` (exists).

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
  KEY idx_epa_employee (employee_id),
  KEY idx_epa_project  (project_id),
  KEY idx_epa_emp_proj (employee_id, project_id),

  CONSTRAINT fk_epa_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_epa_project
    FOREIGN KEY (project_id) REFERENCES ak_projects(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### Step 5 — `ak_employee_project_allocations`

Depends on: `ak_employees` (exists), `ak_projects` (exists).  
No FK to `ak_employee_cost_periods` — by design. Snapshot values are copied at creation, not referenced.

```sql
CREATE TABLE IF NOT EXISTS ak_employee_project_allocations (
  id                      CHAR(36)      NOT NULL,
  employee_id             CHAR(36)      NOT NULL,
  project_id              CHAR(36)      NOT NULL,
  allocation_year         SMALLINT      NOT NULL,
  allocation_month        TINYINT       NOT NULL,
  days_worked             DECIMAL(5,2)  NOT NULL,
  working_days_base       TINYINT       NOT NULL,

  -- Snapshot columns — written once at creation, never updated.
  -- Copied from ak_employee_cost_periods active at creation time.
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

  notes      TEXT     NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_allocation          (employee_id, project_id, allocation_year, allocation_month),
  KEY idx_alloc_project_period      (project_id, allocation_year, allocation_month),
  KEY idx_alloc_employee_period     (employee_id, allocation_year, allocation_month),

  CONSTRAINT fk_alloc_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_alloc_project
    FOREIGN KEY (project_id) REFERENCES ak_projects(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Step 6 — FK on `ak_payment_plans.employee_id` (independent, low risk)

This constraint is missing from the existing table. It can be added independently of the five new tables, at any phase.

```sql
ALTER TABLE ak_payment_plans
  ADD CONSTRAINT fk_payment_plans_employee
    FOREIGN KEY (employee_id) REFERENCES ak_employees(id)
    ON DELETE SET NULL ON UPDATE CASCADE;
```

Run only if the constraint does not already exist. Verify first:

```sql
SELECT CONSTRAINT_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'ak_payment_plans'
  AND COLUMN_NAME = 'employee_id'
  AND REFERENCED_TABLE_NAME = 'ak_employees';
```

If 0 rows returned, safe to run the ALTER.

### Rollback SQL (reverse order)

```sql
DROP TABLE IF EXISTS ak_employee_project_allocations;
DROP TABLE IF EXISTS ak_employee_project_assignments;
DROP TABLE IF EXISTS ak_employee_cost_periods;
DROP TABLE IF EXISTS ak_employee_roles;
DROP TABLE IF EXISTS ak_roles;
```

---

## 3. install-schema.php Changes

**File:** `public_html/install-schema.php`

The install schema file maintains a map of table name → CREATE TABLE SQL used by the schema installer. Add five entries in creation order after the existing `ak_employees` entry.

### What to add

Locate the `ak_employees` entry in the table map and insert the five new entries immediately after it, before the closing of whatever data structure holds them. The exact form must match the existing file's pattern (heredoc array entries).

Five entries to add, in this order:

1. `'ak_roles'` — Step 1 SQL (without `INSERT IGNORE` seed data; seed data is a separate operation)
2. `'ak_employee_roles'` — Step 2 SQL
3. `'ak_employee_cost_periods'` — Step 3 SQL
4. `'ak_employee_project_assignments'` — Step 4 SQL
5. `'ak_employee_project_allocations'` — Step 5 SQL

### What NOT to change

- The existing `ak_employees` entry — do not modify it.
- The `ak_payment_plans` entry — the FK addition is done via `agent-sql.php` operation, not through install-schema.
- Seed data for `ak_roles` is NOT part of install-schema — it is a one-time seed script run separately after table creation.

### When this is needed

Only if the install-schema.php endpoint is used to build a fresh environment (local dev, staging). Production already has the tables after the migration SQL in section 2 is executed via `agent-sql.php`. The install-schema change ensures new local dev environments get the full schema without manual SQL.

---

## 4. Runtime Impact Map

### PHP — files requiring modification

| File | Phase | Change required |
|---|---|---|
| `public_html/api/admin/employees.php` | **Phase 3 prerequisite** | Extend pre-delete check: add a third check blocking deletion if `ak_employee_project_allocations.employee_id` rows exist. Current checks cover `ak_payment_plans` and `ak_financial_entries` only. |
| `public_html/install-schema.php` | Phase 1 | Add five new table entries (see section 3). |

**New PHP files to create (no existing files modified):**

| New file | Phase | Purpose |
|---|---|---|
| `public_html/api/admin/roles.php` | Phase 2 | CRUD for `ak_roles`: GET list, POST create, PATCH update (name/is_active), DELETE (blocked if role has assignments — RESTRICT handles at DB level) |
| `public_html/api/admin/employee-roles.php` | Phase 2 | CRUD for `ak_employee_roles`: GET by employee_id, POST assign (with duplicate-active-role guard), PATCH end-date, DELETE row |
| `public_html/api/admin/employee-cost-periods.php` | Phase 2 | CRUD for `ak_employee_cost_periods`: GET by employee_id, POST create (with overlap prevention: close prior period), PATCH notes only, DELETE (blocked if allocations reference cost_date within this period's range — application-level guard, not DB FK) |
| `public_html/api/admin/employee-project-assignments.php` | Phase 3 | CRUD for `ak_employee_project_assignments`: GET by employee_id or project_id, POST create, PATCH end_date/notes, DELETE |
| `public_html/api/admin/employee-project-allocations.php` | Phase 3 | CRUD for `ak_employee_project_allocations`: GET by project_id or employee_id, POST create (runs full snapshot write path from design doc section 7), PATCH days_worked/working_days_base/notes (recomputes calculated_cost from stored snapshots), DELETE |

### TypeScript — files requiring modification

| File | Phase | Change required |
|---|---|---|
| `src/lib/apiTypes.ts` | Phase 2 | Add interfaces: `AkRole`, `AkEmployeeRole`, `AkEmployeeCostPeriod` |
| `src/lib/apiTypes.ts` | Phase 3 | Add interfaces: `AkEmployeeProjectAssignment`, `AkEmployeeProjectAllocation` |
| `src/lib/apiClient.ts` | Phase 2 | Add API functions for roles, employee roles, cost periods |
| `src/lib/apiClient.ts` | Phase 3 | Add API functions for assignments, allocations |

**No changes to existing type definitions.** `AdminEmployee` keeps the `role` field — it remains valid until Phase 3 deprecation.

### React — files requiring modification

| File | Phase | Change required |
|---|---|---|
| `src/pages/admin/AdminEmployees.tsx` | Phase 3 | Add roles display (from `ak_employee_roles`) alongside or replacing the legacy `role` text field in the list view. |
| *(new)* `src/components/admin/employees/EmployeeRolesPanel.tsx` | Phase 2 | Role assignment UI — assign/end-date roles, list active and historical roles. |
| *(new)* `src/components/admin/employees/CostPeriodsPanel.tsx` | Phase 2 | Cost period management — list periods, create new period (with bonus warning if `bonus > 0` and `effective_to IS NULL`), view history. |
| *(new)* `src/components/admin/employees/ProjectAssignmentsPanel.tsx` | Phase 3 | Project assignment list — assign to project with start_date, close assignment with end_date. |
| *(new)* `src/pages/admin/AdminEmployeeAllocations.tsx` | Phase 3 | Monthly allocation entry screen — new route `/admin/personeller/:id/tahsisat`. Shows month picker, days_worked input per project, live calculated_cost preview, days_worked ceiling validation. |
| *(new)* `src/components/admin/projects/ProjectEmployeeCostPanel.tsx` | Phase 3 | Project profitability panel — embeds in the project detail page. Shows `SUM(calculated_cost)` per employee per month, total. Read-only. |

### Reports — dashboard impact

| File | Phase | Change required |
|---|---|---|
| `public_html/api/admin/dashboard.php` | Phase 3 | Add allocated employee cost per project to existing dashboard aggregations. Display alongside existing entry-based personnel cost totals. Do not replace — run both in parallel so the transition is visible. |

---

## 5. API Change Plan

### Phase 2 endpoints (new)

All endpoints follow the existing pattern: JSON responses, `json_success()` / `json_error()`, token-gated via existing admin auth middleware.

| Method | Endpoint | Action |
|---|---|---|
| `GET` | `/api/admin/roles` | List all roles. Optional `?active_only=1` filter. |
| `POST` | `/api/admin/roles` | Create role. Body: `{name, normalized_name}`. Returns created row. |
| `PATCH` | `/api/admin/roles/:id` | Update `name`, `is_active`. Cannot update `normalized_name` without matching `name` change. |
| `DELETE` | `/api/admin/roles/:id` | Soft-delete (`is_active = 0`) preferred. Hard delete blocked at DB level (RESTRICT) if assignments exist. |
| `GET` | `/api/admin/employees/:id/roles` | All role assignments for employee, ordered by `assigned_at DESC`. |
| `POST` | `/api/admin/employees/:id/roles` | Assign role. Body: `{role_id, assigned_at}`. Application checks: if employee already has active row for this `role_id` (`ended_at IS NULL`), set `ended_at = assigned_at - 1 day` on prior row before inserting new one. |
| `PATCH` | `/api/admin/employee-roles/:employee_id/:role_id/:assigned_at` | Set `ended_at`. Cannot change `role_id` or `assigned_at` (part of PK). |
| `GET` | `/api/admin/employees/:id/cost-periods` | All cost periods for employee, ordered by `effective_from DESC`. |
| `POST` | `/api/admin/employees/:id/cost-periods` | Create cost period. Body: `{effective_from, salary, sgk, meal, transportation, bonus, accommodation, other, notes}`. Application: find any open period (`effective_to IS NULL`), set its `effective_to = effective_from - 1 day`. Returns created row. |
| `PATCH` | `/api/admin/cost-periods/:id` | Update `notes` only. Cost values are immutable once set (changing them would invalidate the snapshot audit trail). |
| `DELETE` | `/api/admin/cost-periods/:id` | Blocked if any allocation's `cost_date` falls within this period's date range. |

### Phase 3 endpoints (new)

| Method | Endpoint | Action |
|---|---|---|
| `GET` | `/api/admin/employees/:id/assignments` | All project assignments for employee. |
| `GET` | `/api/admin/projects/:id/assignments` | All employee assignments for project. |
| `POST` | `/api/admin/employees/:id/assignments` | Create assignment. Body: `{project_id, start_date, notes}`. |
| `PATCH` | `/api/admin/assignments/:id` | Set `end_date`, update `notes`. |
| `DELETE` | `/api/admin/assignments/:id` | Delete assignment. Blocked in application if allocation rows exist for this `(employee_id, project_id)` pair. |
| `GET` | `/api/admin/projects/:id/allocations` | All allocations for project, JOINed with `ak_employees.full_name`. Used by project profitability panel. |
| `GET` | `/api/admin/employees/:id/allocations` | All allocations for employee across all projects. Used by employee allocation screen. |
| `POST` | `/api/admin/employees/:id/allocations` | Create allocation. Runs full snapshot write path (section 7 of migration design): ceiling check → cost period lookup → snapshot copy → computed cost insert. |
| `PATCH` | `/api/admin/allocations/:id` | Update `days_worked`, `working_days_base`, `notes`. Recomputes `calculated_cost` from stored snapshot. Snapshot columns and `cost_date` are never updated. Runs ceiling check excluding this row's current `days_worked`. |
| `DELETE` | `/api/admin/allocations/:id` | Delete allocation. Reduces that month's project cost immediately. Confirm in UI before allowing. |

### Phase 3 prerequisite — modify existing endpoint

| Method | File | Current behavior | New behavior |
|---|---|---|---|
| `DELETE` | `employees.php` | Checks `ak_payment_plans` and `ak_financial_entries` | Add third check: `SELECT id FROM ak_employee_project_allocations WHERE employee_id = :id LIMIT 1`. If found, return 409: `'Tahsisat kaydı bulunan personel silinemez. Önce tahsisat kayıtlarını silin veya personeli Pasif yapın.'` |

---

## 6. UI Change Plan

### Phase 2 screens

**Employee detail page — new panels**

The existing employee detail/edit page gains two new collapsible panels below the current form fields:

**Panel: Roller (Roles)**
- List of current active roles with `assigned_at` date.
- Dropdown to assign a new role from `ak_roles` (active only). Date picker for `assigned_at`.
- "Rolü Bitir" button per active role — sets `ended_at`, shows confirmation.
- Collapsed history section showing ended roles with `assigned_at` and `ended_at`.

**Panel: Maliyet Dönemleri (Cost Periods)**
- List of cost periods, newest first. Each row shows: `effective_from`, `effective_to` (or "Açık"), and the sum `salary + sgk + ...` as monthly total.
- "Yeni Dönem" button opens a form with all 7 cost component fields. Submitting closes the prior open period automatically.
- Warning banner if a period has `bonus > 0` and `effective_to IS NULL`: "Bonus aylık tekrar eden olarak ayarlandı. Bu kasıtlı mı?"
- Cost period rows are read-only after creation (notes field is editable).

### Phase 3 screens

**New route: `/admin/personeller/:id/tahsisat`**

Monthly allocation entry screen. Linked from the employee detail page.

Layout:
- Month/year picker at the top.
- For the selected month: show active project assignments for that employee.
- Per project: input for `days_worked` (decimal, e.g. 6.5) and `working_days_base` (integer, defaults to calendar working days for that month).
- Live preview: "Günlük Ücret: X TL | Tahsis Tutarı: Y TL" as the operator types.
- Running total of days_worked across all projects for the month. Turns red if total approaches or exceeds `working_days_base`.
- Save button per project. An existing allocation for that (project, month) shows the stored snapshot values in a read-only info box alongside the editable fields.

**Project detail page — new panel: Personel Maliyeti**

Embeds in the existing project detail view (after financial summary).
- Shows total allocated employee cost: `SUM(calculated_cost)` for this project.
- Expandable table: employee name, month, days_worked, calculated_cost.
- Sorted by year/month desc.
- No edit functionality from this panel — employees manage allocations from their own screen.

**Employee list page (`/admin/personeller`)**

Minor change: replace the `role` text column with a roles chip list from `ak_employee_roles` (active roles only). Fallback to legacy `ak_employees.role` text if no `ak_employee_roles` rows exist for that employee — ensures the list works before any role data is entered.

**Dashboard**

Phase 3: add a "Tahsis Edilen Personel Maliyeti" section per project alongside the existing entry-based personnel totals. Label clearly as "Tahsisat bazlı" vs "Finans girişi bazlı" so the operator understands the two figures may differ until all months are backfilled.

---

## 7. Data Migration Plan

### Existing employees

No structural change to `ak_employees`. All existing rows are valid. No data migration is needed for the employee records themselves.

### Existing `ak_employees.role` values

The `role` VARCHAR(100) column contains free-text strings entered by operators. These values are not automatically migrated into `ak_employee_roles` because:

1. The free-text values may not match any seed role name exactly (typos, variants).
2. `ak_employee_roles` requires a `role_id` from `ak_roles` — a UUID lookup, not a text match.
3. The `assigned_at` date for legacy role entries is unknown.

**Migration approach:** Manual, operator-driven.

- After Phase 2 go-live, the operator reviews each employee's legacy `role` field and assigns the equivalent structured role via the new Roles panel.
- No automated import script is generated.
- The legacy `role` field remains visible in the UI (as a read-only "Eski Rol" display field) until the operator has migrated all employees and confirmed the structured roles are correct.
- Once all employees have at least one active `ak_employee_roles` row, the legacy field is hidden from the main UI but remains in the database.

### Existing cost data

There is no existing structured cost data. The `ak_employee_cost_periods` table starts empty. Operators enter current cost structures for each active employee in Phase 2. Historical cost data (pre-go-live salaries) cannot be recovered automatically — no structured records exist. This is an accepted gap: allocation recording begins from go-live month forward.

### Migration sequence

```
Phase 1 (schema deploy):
  → Execute SQL steps 1–5 via agent-sql.php
  → Verify all 5 tables exist (SHOW TABLES)
  → Verify 0 rows in each
  → Update install-schema.php

Phase 2 (operator data entry — no rush, no deadline):
  → Seed ak_roles (SQL step 1 seed INSERT)
  → For each active employee:
      a. Assign structured roles via Roles panel
      b. Enter current cost period via Cost Periods panel
  → No impact on existing operations until Phase 3

Phase 3 (allocation go-live):
  → Pre-delete check deployed to employees.php FIRST
  → Project assignment and allocation APIs deployed
  → UI deployed
  → Operators begin entering monthly allocations for current month
  → Retrospective backfill: optional, operator decides how far back to go
```

### Retrospective backfill

Past months cannot be backfilled with accurate cost data because the historical cost periods are unknown. Options:

1. **No backfill** — project cost reports show zero for personnel before go-live month. Accepted.
2. **Approximate backfill** — operator enters the current cost period with `effective_from` backdated (e.g., 2026-01-01) and manually creates allocations for past months using those approximate costs. The snapshot records the `cost_date` as the actual creation date, making the approximation visible in the audit trail.

Decision is at the operator's discretion. The schema supports both approaches.

### Rollback

**Phase 1 rollback (before any data):** DROP the five tables in reverse order. Zero data loss.

**Phase 2 rollback (after role/cost data entered):**

Before any DROP:
```sql
SELECT COUNT(*) FROM ak_employee_cost_periods;
SELECT COUNT(*) FROM ak_employee_roles;
```
If > 0: export data first. Then DROP. Data loss is limited to manually entered cost structures.

**Phase 3 rollback (after allocations entered):**

Before any DROP:
```sql
SELECT COUNT(*) FROM ak_employee_project_allocations;
SELECT COUNT(*) FROM ak_employee_project_assignments;
```
Dropping allocations permanently destroys project cost history. Require explicit owner sign-off. Export to CSV before DROP.

---

## 8. Verification Plan

### Phase 1 — Schema verification

Run via `agent-sql.php` after deploying the five CREATE TABLE statements.

- [ ] `SHOW TABLES LIKE 'ak_roles'` → 1 row
- [ ] `SHOW TABLES LIKE 'ak_employee_roles'` → 1 row
- [ ] `SHOW TABLES LIKE 'ak_employee_cost_periods'` → 1 row
- [ ] `SHOW TABLES LIKE 'ak_employee_project_assignments'` → 1 row
- [ ] `SHOW TABLES LIKE 'ak_employee_project_allocations'` → 1 row
- [ ] `SELECT COUNT(*) FROM ak_roles` → 0 (before seed)
- [ ] After seed: `SELECT COUNT(*) FROM ak_roles` → 8
- [ ] Verify FKs exist:
  ```sql
  SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND REFERENCED_TABLE_NAME IN ('ak_employees','ak_projects','ak_roles')
    AND TABLE_NAME LIKE 'ak_employee%'
  ORDER BY TABLE_NAME, COLUMN_NAME;
  ```
  Expected: 7 rows covering all FK constraints defined in section 2.
- [ ] Existing system health check: `SELECT COUNT(*) FROM ak_employees` returns the same count as before — confirms no existing data was affected.

### Phase 2 — API and data entry verification

- [ ] `GET /api/admin/roles` returns 8 seeded roles with correct names.
- [ ] `POST /api/admin/employees/:id/roles` creates a role assignment. Verify row exists in `ak_employee_roles`.
- [ ] Assigning the same role twice to the same employee (without ending the first) closes the first assignment's `ended_at` automatically.
- [ ] `POST /api/admin/employees/:id/cost-periods` creates a cost period. Verify previous open period's `effective_to` is set.
- [ ] Attempt to create overlapping cost period — should be blocked (UNIQUE constraint on `employee_id, effective_from`).
- [ ] UI: employee list shows structured roles for employees with `ak_employee_roles` rows; falls back to legacy `role` text for others.
- [ ] Existing financial statement, payment plans, and dashboard work unchanged.

### Phase 3 — Allocation verification

- [ ] `employees.php` DELETE with an employee who has allocation rows → 409 error with Turkish message.
- [ ] `employees.php` DELETE with an employee who has no allocation rows → still deletes (existing behavior).
- [ ] `POST /api/admin/employees/:id/allocations` — create allocation for employee with active cost period → returns row with all snapshot columns populated.
- [ ] Verify snapshot isolation: edit the employee's cost period after allocation is created → existing allocation's `*_snapshot` and `calculated_cost` are unchanged.
- [ ] Verify days_worked ceiling: create allocation for 15 days on Project A. Attempt to create allocation for 10 days on Project B in same month with `working_days_base = 22` (total 25 > 22) → blocked with error.
- [ ] `GET /api/admin/projects/:id/allocations` → returns all allocations with employee names and correct `calculated_cost`.
- [ ] Project detail page shows personnel cost panel with correct `SUM(calculated_cost)`.
- [ ] Verify formula: if `monthly_cost_snapshot = 22000`, `days_worked = 6.5`, `working_days_base = 22` → `calculated_cost = 6500.00` exactly.
- [ ] Dashboard personnel cost section shows both entry-based and allocation-based totals.

---

## 9. Production Deployment Order

### Phase 1 — Schema deploy (execute immediately after this document is approved)

```
1. Run SQL Step 1: CREATE TABLE ak_roles
2. Run SQL Step 1 seed: INSERT IGNORE ak_roles (8 rows)
3. Run SQL Step 2: CREATE TABLE ak_employee_roles
4. Run SQL Step 3: CREATE TABLE ak_employee_cost_periods
5. Run SQL Step 4: CREATE TABLE ak_employee_project_assignments
6. Run SQL Step 5: CREATE TABLE ak_employee_project_allocations
7. Run verification queries from section 8, Phase 1 checklist
8. Update install-schema.php locally, run build (npm run build)
9. Deploy via: python scripts/deploy_ftp.py
   (uploads public_html/api/install-schema.php only — no runtime API changes)
```

All steps via `agent-sql.php` except step 9.  
Zero downtime. No user-visible change.

### Phase 2 — API and UI deploy (after Phase 1 verified, when development is ready)

```
1. Develop and test locally:
   - roles.php
   - employee-roles.php
   - employee-cost-periods.php
   - TypeScript types + API client functions (Phase 2 additions)
   - EmployeeRolesPanel.tsx
   - CostPeriodsPanel.tsx
   - Updated AdminEmployees.tsx (roles chip display)

2. Run full build + test suite: npm run build && npm test
   (36 tests must pass; no regressions)

3. Deploy: python scripts/deploy_ftp.py
   (uploads dist/ and public_html/api/)

4. Run Phase 2 verification checklist from section 8
5. Operators begin entering roles and cost periods for active employees
```

### Phase 3 — Allocation deploy (after Phase 2 is live and cost periods are entered for all active employees)

**Hard prerequisite check before starting Phase 3 deploy:**
```sql
-- Every active employee must have at least one cost period
SELECT e.id, e.full_name
FROM ak_employees e
WHERE e.status = 'Aktif'
  AND NOT EXISTS (
    SELECT 1 FROM ak_employee_cost_periods cp
    WHERE cp.employee_id = e.id
  );
-- Must return 0 rows before Phase 3 allocations can be used.
```

```
1. Develop and test locally:
   - Modified employees.php (pre-delete check extension)
   - employee-project-assignments.php
   - employee-project-allocations.php
   - TypeScript types + API client functions (Phase 3 additions)
   - ProjectAssignmentsPanel.tsx
   - AdminEmployeeAllocations.tsx (new route)
   - ProjectEmployeeCostPanel.tsx
   - Updated AdminEmployees.tsx, dashboard.php

2. Run full build + test suite: npm run build && npm test

3. Deploy: python scripts/deploy_ftp.py

4. Verify pre-delete check is live:
   Attempt to delete an employee with allocation rows → must return 409.

5. Run Phase 3 verification checklist from section 8.
6. Operators begin monthly allocation entry.
```

---

## 10. Closure Criteria

Phase 6/21 — `ak_employees` — may be marked **COMPLETE** when all of the following are true:

### Schema

- [ ] All 5 new tables exist in production with correct structure, FKs, indexes, and UNIQUE constraints.
- [ ] `ak_roles` is seeded with the 8 standard roles.
- [ ] `ak_payment_plans.employee_id` FK constraint added (independent step — may be deferred but must be done before 6/21 is closed).

### API

- [ ] Roles CRUD endpoints live and returning correct responses.
- [ ] Employee roles endpoints live with duplicate-active-role guard working.
- [ ] Cost periods endpoints live with overlap prevention working.
- [ ] Project assignment endpoints live.
- [ ] Allocation endpoints live with snapshot write path, ceiling check, and correction path all working.
- [ ] `employees.php` DELETE check extended — deletion blocked when allocation rows exist.

### Data quality

- [ ] Every active employee (`status = 'Aktif'`) has at least one active row in `ak_employee_roles`.
- [ ] Every active employee has at least one cost period in `ak_employee_cost_periods` with `effective_to IS NULL`.
- [ ] Allocation has been entered for at least one employee × project × month (confirms the full write path works end-to-end in production).

### UI

- [ ] Employee list shows structured roles (no regression on existing employee data).
- [ ] Roles panel and cost period panel operational in employee detail page.
- [ ] Monthly allocation entry screen accessible via `/admin/personeller/:id/tahsisat`.
- [ ] Project detail page shows personnel cost panel with correct totals.
- [ ] Dashboard shows allocation-based totals alongside entry-based totals.

### Verification

- [ ] All Phase 1, 2, and 3 verification checklist items from section 8 are checked off.
- [ ] Formula verified in production: `(days_worked / working_days_base) × monthly_cost_snapshot` matches expected output.
- [ ] Snapshot isolation verified: editing a cost period does not change any existing allocation's `calculated_cost`.

### Documentation

- [ ] `install-schema.php` updated and deployed with all 5 new table definitions.
- [ ] This package document is committed to the repository.

---

**When all boxes above are checked: mark ak_employees 6/21 COMPLETE. Do not start 7/21 before this.**

---

### Final blocking issues remaining

**None.** All design review issues (C1, C2, C3) have been resolved and incorporated into the migration design document. The schema is approved. This package is ready for Phase 6B implementation.
