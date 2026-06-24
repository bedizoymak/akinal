# Codex Table Review Handover

**Project:** akinalinsaat.com  
**Stack:** PHP/MySQL REST API (cPanel shared hosting) + React 18 + Vite + TypeScript SPA  
**Last updated:** 2026-06-24  
**Next table:** 7/21 (identify from schema, then ask owner business questions)

---

## 1. Closed Table Status

| # | Table | Status |
|---|-------|--------|
| 1 | `ak_projects` | ✅ CLOSED |
| 2 | `ak_customers` | ✅ CLOSED |
| 3 | `ak_customer_projects` | ✅ CLOSED |
| 4 | `ak_customer_notes` | ✅ CLOSED / removed (dropped) |
| 5 | `ak_documents` | ✅ CLOSED / removed (dropped) |
| 6 | `ak_employees` | ✅ CLOSED / complete |
| 7–21 | (remaining) | ⏳ not started |

---

## 2. Important Commits

- **Production agent access docs commit:** committed (search git log for "production agent access" or "agent-sql")
- **ak_documents final removal commit:** committed (search git log for "drop_ak_documents" or "remove ak_documents")
- **Phase 6 (ak_employees) implementation:** ❌ **UNCOMMITTED** — all Phase 6 files are untracked/modified as of 2026-06-24. Do not assume they are in git history.

---

## 3. Production Access

All production access context is at:

```
docs/production-agent-access/README_PRODUCTION_ACCESS.md
```

Read this before making any production DB calls. It covers:
- FTP credentials location
- agent-sql.php bridge + token
- WAF bypass via operation mode
- DB name
- Key constraints and safety rules

---

## 4. Phase 6 Employee Outputs

All of the following are **untracked** (not yet committed):

| File | Purpose |
|------|---------|
| `docs/AK_EMPLOYEES_AUDIT_REPORT.md` | Initial audit findings |
| `docs/AK_EMPLOYEES_MIGRATION_DESIGN.md` | Approved architecture (5 new tables) |
| `docs/AK_EMPLOYEES_MIGRATION_REVIEW.md` | Independent review — APPROVE WITH CHANGES verdict, all blockers resolved |
| `docs/AK_EMPLOYEES_FINAL_PACKAGE.md` | Full implementation package (SQL, API plan, UI plan, closure criteria) |
| `docs/PHASE_6_IMPLEMENTATION_PACKAGE.md` | Delivery doc — all files created, build/test results |
| `docs/PHASE_6_CLOSURE_REPORT.md` | Final closure report — all checklist items ✅, deployment checklist |
| `docs/sql/phase_6_employee_migration.sql` | SQL DDL for all 5 new tables |

### New PHP endpoints (untracked):
- `public_html/api/admin/roles.php`
- `public_html/api/admin/employee-roles.php`
- `public_html/api/admin/employee-cost-periods.php`
- `public_html/api/admin/employee-project-assignments.php`
- `public_html/api/admin/employee-project-allocations.php`

### Modified PHP (uncommitted):
- `public_html/api/admin/employees.php` — pre-delete allocation check added
- `public_html/install-schema.php` — 5 new table entries added

### New React (untracked):
- `src/components/admin/employees/EmployeeRolesPanel.tsx`
- `src/components/admin/employees/CostPeriodsPanel.tsx`
- `src/components/admin/employees/ProjectAssignmentsPanel.tsx`
- `src/components/admin/projects/ProjectEmployeeCostPanel.tsx`
- `src/pages/admin/AdminEmployeeDetail.tsx`
- `src/pages/admin/AdminEmployeeAllocations.tsx`

### Modified TS (uncommitted):
- `src/lib/apiTypes.ts` — 5 new interfaces + response wrappers
- `src/lib/apiClient.ts` — 19 new API functions
- `src/App.tsx` — 2 new routes
- `src/pages/admin/AdminEmployees.tsx` — Detay + Tahsisat buttons
- `src/pages/admin/AdminProjectEdit.tsx` — ProjectEmployeeCostPanel wired in

---

## 5. Golden Workflow (must follow)

- **WIP = 1** — one table at a time, finish before starting next
- **Audit first** — read existing table schema and code before designing anything
- **Ask business questions** — before designing, ask owner about purpose, workflows, reporting needs
- **No broad repo scans** — read only files required for current table
- **No subagents** — single-agent execution only
- **Concise reports** — no padding, no repetition
- **Do not revisit closed tables** — 1–6 are done; do not reopen unless production bug confirmed

---

## 6. Next Objective

**Start 7/21.**

Identify the 7th table from the current production schema (query via agent-sql.php bridge or read install-schema.php table list), then ask the owner business questions before designing anything.

---

## 7. Required First Action for Codex

1. Determine which table is 7/21 (read `public_html/install-schema.php` or query `SHOW TABLES` via agent-sql.php)
2. Read that table's current DDL (`SHOW CREATE TABLE <name>`)
3. Find existing API endpoint(s) for that table (if any) in `public_html/api/admin/`
4. Ask owner: What does this table do? Who uses it? What workflows depend on it? What reporting is needed?
5. Only after owner answers: produce audit → design → review → implement

---

## 8. Warnings

- **Do NOT regenerate 6/21 architecture.** It is complete. See `docs/PHASE_6_CLOSURE_REPORT.md`.
- **Do NOT re-open ak_employees** unless production verification finds a confirmed bug.
- **Do NOT commit Phase 6 files** unless the owner explicitly requests it — they are staged for review.
- **Do NOT execute SQL** against production without reading `docs/production-agent-access/README_PRODUCTION_ACCESS.md` first.
- **Do NOT deploy** frontend or PHP files — that is an owner action.
