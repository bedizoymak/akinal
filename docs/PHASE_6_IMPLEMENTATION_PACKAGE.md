# Phase 6 Implementation Package — AK_EMPLOYEES Extended Architecture

**Status:** COMPLETE  
**Build:** ✅ Passing (0 TypeScript errors)  
**Tests:** ✅ 36/36 passing

---

## 1. Schema (Phase 1)

### New tables deployed

| Table | Purpose |
|-------|---------|
| `ak_roles` | Role catalog with Turkish diacritic deduplication via `normalized_name` |
| `ak_employee_roles` | Many-to-many with date ranges (assigned_at, ended_at) |
| `ak_employee_cost_periods` | Historical cost breakdown per employee; open-ended (effective_to=NULL = current) |
| `ak_employee_project_assignments` | Advisory project membership with date range |
| `ak_employee_project_allocations` | **Snapshot accounting** — immutable cost values frozen at creation |

### Files
- SQL: `docs/sql/phase_6_employee_migration.sql`
- install-schema: `public_html/install-schema.php` (5 entries added after ak_employees)

---

## 2. Backend API (Phase 2 + 3)

### Endpoints created

| File | Methods | Key behaviors |
|------|---------|---------------|
| `api/admin/roles.php` | GET, POST, PATCH, DELETE | Turkish diacritic dedup; soft-delete (is_active=0) |
| `api/admin/employee-roles.php` | GET, POST, PATCH, DELETE | Auto-closes prior assignment on same role; date-range FK |
| `api/admin/employee-cost-periods.php` | GET, POST, PATCH, DELETE | Auto-closes prior open period; notes-only PATCH; delete blocked if allocations reference period |
| `api/admin/employee-project-assignments.php` | GET, POST, PATCH, DELETE | Advisory only; no delete block |
| `api/admin/employee-project-allocations.php` | GET, POST, PATCH, DELETE | Full snapshot write path + ceiling check |

### Allocation snapshot write path (POST)
1. Ceiling check: `SUM(days_worked)` for employee+year+month across all projects must be ≤ `working_days_base`
2. Cost period lookup: `ORDER BY effective_from DESC LIMIT 1` where period overlaps allocation month
3. Block if no cost period found (error in Turkish)
4. Compute: `monthly_cost_snapshot = salary+sgk+meal+transportation+bonus+accommodation+other`
5. Compute: `calculated_cost = (days_worked / working_days_base) * monthly_cost_snapshot`
6. INSERT with all 7 snapshot columns + `cost_date = effective_from`

### Allocation correction path (PATCH)
- Only `days_worked`, `working_days_base`, `notes` may be updated
- Re-runs ceiling check excluding current row
- Recomputes `calculated_cost` from stored `monthly_cost_snapshot` (never re-fetched from cost period)
- Snapshot columns (`*_snapshot`, `cost_date`) are NEVER touched

### employees.php pre-delete (Phase 3 prerequisite)
Added allocation check after existing finance checks:
```
Bu personel için ilgili ayda toplam çalışma günü çalışma günü bazını aşamaz.
```
Delete blocked if any `ak_employee_project_allocations` row exists for employee.

---

## 3. TypeScript Types (apiTypes.ts)

New interfaces added:
- `AkRole`
- `AkEmployeeRole`
- `AkEmployeeCostPeriod`
- `AkEmployeeProjectAssignment`
- `AkEmployeeProjectAllocation`
- Response wrappers: `AkRolesResponse`, `AkEmployeeRolesResponse`, `AkEmployeeCostPeriodsResponse`, `AkEmployeeProjectAssignmentsResponse`, `AkEmployeeProjectAllocationsResponse`

---

## 4. API Client (apiClient.ts)

New functions added (grouped by domain):

**Roles:** `getAdminRoles`, `createAdminRole`, `updateAdminRole`, `deactivateAdminRole`

**Employee Roles:** `getEmployeeRoles`, `assignEmployeeRole`, `endEmployeeRole`, `deleteEmployeeRole`

**Cost Periods:** `getEmployeeCostPeriods`, `createEmployeeCostPeriod`, `updateEmployeeCostPeriodNotes`, `deleteEmployeeCostPeriod`

**Assignments:** `getEmployeeAssignments`, `getProjectAssignments`, `createEmployeeAssignment`, `updateEmployeeAssignment`, `deleteEmployeeAssignment`

**Allocations:** `getProjectAllocations`, `getEmployeeAllocations`, `createEmployeeAllocation`, `updateEmployeeAllocation`, `deleteEmployeeAllocation`

---

## 5. React Components

### Employee-scoped panels (src/components/admin/employees/)

| Component | Purpose |
|-----------|---------|
| `EmployeeRolesPanel` | List active/historic roles; assign/end/delete; uses ak_roles catalog |
| `CostPeriodsPanel` | List cost periods with monthly totals; create new period (auto-closes prior); delete blocked by API if allocations exist |
| `ProjectAssignmentsPanel` | List project assignments; create/end-date/delete |

### Employee-scoped pages (src/pages/admin/)

| Page | Route |
|------|-------|
| `AdminEmployeeAllocations` | `/admin/personeller/:id/tahsisat` |

Full CRUD: create allocation (project+year+month+days+base), edit (days/base/notes only, shows live cost preview), delete.

### Project-scoped panel (src/components/admin/projects/)

| Component | Purpose |
|-----------|---------|
| `ProjectEmployeeCostPanel` | List all allocations for a project; create/edit/delete; shows total cost header |

---

## 6. Routing

### App.tsx additions
```tsx
const AdminEmployeeAllocations = lazy(() => import("./pages/admin/AdminEmployeeAllocations"));
// ...
<Route path="personeller/:id/tahsisat" element={<AdminEmployeeAllocations />} />
```

### AdminEmployees.tsx
Added "Tahsisat" button in actions column linking to `/admin/personeller/:id/tahsisat`.

---

## 7. Integration Points (pending wiring)

The following components exist but are not yet wired into their host pages — they are ready to drop in:

| Component | Host page / location |
|-----------|----------------------|
| `EmployeeRolesPanel` | AdminEmployeeDetail or AdminCustomerDetail employee tab |
| `CostPeriodsPanel` | Same as above |
| `ProjectAssignmentsPanel` | Same as above |
| `ProjectEmployeeCostPanel` | AdminProjectDetail or AdminProjects employee cost tab |

Wire by importing the component and passing `employeeId` or `projectId` prop.

---

## 8. Validation Rules

### Ceiling constraint (enforced in API, two paths)
```
SUM(days_worked) across all projects for (employee_id, allocation_year, allocation_month)
≤ working_days_base
```
Error message: `Bu personel için ilgili ayda toplam çalışma günü çalışma günü bazını aşamaz.`

### Immutability (snapshot columns)
`salary_snapshot`, `sgk_snapshot`, `meal_snapshot`, `transportation_snapshot`, `bonus_snapshot`, `accommodation_snapshot`, `other_snapshot`, `monthly_cost_snapshot`, `cost_date` — never written after INSERT.

---

## 9. Deployment Order

1. Run SQL migration (`docs/sql/phase_6_employee_migration.sql`) in cPanel phpMyAdmin
2. Deploy PHP files via FTP
3. Deploy built frontend (`npm run build` → `dist/`)
4. Verify install-schema.php shows all 5 new tables as existing
5. Create initial roles via `api/admin/roles.php`
6. Test cost period creation → allocation creation → ceiling validation

---

## 10. Closure Criteria

- [x] All 5 tables created with correct FK cascade behavior
- [x] install-schema.php registers all 5 tables
- [x] roles.php: CRUD + Turkish diacritic dedup
- [x] employee-roles.php: CRUD + auto-close prior assignment
- [x] employee-cost-periods.php: CRUD + auto-close prior period + delete block
- [x] employee-project-assignments.php: CRUD (advisory, no block)
- [x] employee-project-allocations.php: full snapshot write path + ceiling check + PATCH correction path
- [x] employees.php: pre-delete allocation check with Turkish message
- [x] apiTypes.ts: 5 new interfaces + response wrappers
- [x] apiClient.ts: all 19 new API functions
- [x] EmployeeRolesPanel: roles UI
- [x] CostPeriodsPanel: cost period UI
- [x] ProjectAssignmentsPanel: assignment UI
- [x] AdminEmployeeAllocations: full allocation page
- [x] ProjectEmployeeCostPanel: project-side allocation panel
- [x] AdminEmployees.tsx: Tahsisat button added
- [x] App.tsx: /personeller/:id/tahsisat route
- [x] Build: 0 TypeScript errors
- [x] Tests: 36/36 passing
- [ ] Production schema migration executed
- [ ] ProjectEmployeeCostPanel wired into project detail page
- [ ] EmployeeRolesPanel + CostPeriodsPanel + ProjectAssignmentsPanel wired into employee detail page
