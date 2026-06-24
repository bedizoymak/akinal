# ak_employees Migration Design — Review

**Date:** 2026-06-24  
**Reviewing:** [docs/AK_EMPLOYEES_MIGRATION_DESIGN.md](AK_EMPLOYEES_MIGRATION_DESIGN.md)  
**Scope:** Hidden risks, over-engineering, missing fields, workflow blockers, reporting limitations.  
**Not in scope:** Architecture redesign. No SQL generated.

---

## Critical Issues

### C1 — Pre-delete check is listed as "Pending Phase 3" but allocations cascade on employee delete

**Section 5.1** correctly notes that `employees.php` must be extended to block employee deletion if allocation rows exist. But this is listed in the Implementation Readiness table as "Pending Phase 3."

**The risk:** Phase 3 deploys allocation CRUD. If the pre-delete check is not added at the same time as Phase 3 goes live — or worse, added in a later patch — an operator can delete an employee and silently cascade-destroy historical project cost data. The allocation rows are gone. The project profitability figures drop. There is no warning.

**Required fix:** The pre-delete check extension in `employees.php` must be a hard prerequisite for Phase 3 deployment, not a follow-up item. The implementation readiness row should say "Required before Phase 3 go-live" not "Pending Phase 3."

---

### C2 — `days_worked` can legally exceed `working_days_base` — construction workflow unclear

**Section 3.5** says: "No upper bound enforced in schema — application validates against working_days_base."

On construction sites, workers regularly work Saturdays and sometimes Sundays. A month with `working_days_base = 22` (weekdays only) might have an employee working 26 or 27 days including weekends.

**The design does not define what the application validation rule is.** Two possible interpretations:

- **Interpretation A:** `days_worked` cannot exceed `working_days_base`. Weekend work is excluded from allocation (allocated cost is capped at 100% of monthly cost). This would under-represent project costs when workers put in extra days.
- **Interpretation B:** `days_worked` can exceed `working_days_base`. The operator enters actual days including weekends. `working_days_base` is only the divisor for the daily rate calculation. This produces allocation ratios above 1.0 (e.g., 26 ÷ 22 = 1.18), meaning the allocated cost exceeds the monthly cost.

Neither interpretation is wrong by itself — but they lead to very different project cost figures. The design must state which is intended and what the application enforces.

**Required clarification before Phase 6B SQL is authored (no schema change needed — this is an application logic decision).**

---

### C3 — Snapshot lookup query is missing ORDER BY in write path

**Section 7, Step 2** (write path) shows the allocation creation query with `ORDER BY effective_from DESC LIMIT 1`. This is correct.

**Section 8.6** (reporting query section) shows the same lookup without `ORDER BY`. While this does not affect the snapshot design itself, it sets a bad template for the PHP implementation. If an engineer copies the query from section 8.6 instead of section 7 during API development, the result is non-deterministic when two periods overlap due to a data entry error.

**Required fix:** Section 8.6 should include `ORDER BY effective_from DESC LIMIT 1` to match the canonical lookup pattern.

---

### C4 — `bonus` modeled as a monthly recurring cost component

`ak_employee_cost_periods` includes `bonus DECIMAL(14,2) NOT NULL DEFAULT 0` as a monthly cost component.

In Turkish construction, bonuses (ikramiye) are typically one-time or annual payments — Ramazan ikramiyesi, end-of-year bonus, project-completion bonus — not fixed monthly amounts. Modeling bonus as a monthly recurring figure has two problems:

1. An operator entering a December bonus of 10,000 TL would set the cost period's `bonus = 10,000`. This inflates the December monthly cost snapshot. If that employee is allocated to a project in December, the project absorbs the full bonus via `calculated_cost`. If the employee is later allocated to a second project in December (separate row), the bonus cost is counted twice — once per project allocation row, since the `monthly_cost_snapshot` includes the bonus in both.
2. After December, the operator must remember to create a new cost period with `bonus = 0` or the bonus remains active in future months' snapshots.

**The double-counting risk is the critical part:** if an employee works 10 days on Project A and 5 days on Project B in December, and their monthly cost with bonus is 32,000 TL (22,000 salary + 10,000 bonus), the allocation correctly splits it:
- Project A: (10/22) × 32,000 = 14,545 TL
- Project B: (5/22) × 32,000 = 7,273 TL
- Total allocated: 21,818 TL < 32,000 TL ← bonus cost is proportionally distributed, not double-counted.

On reflection, the allocation formula handles this correctly — the bonus is distributed proportionally. The only real risk is the operator forgetting to zero it out after the bonus month. This is an operational concern, not a schema defect.

**Severity revised to: LOW operational risk, not a schema flaw.** Flag for the UI: the cost period entry screen should warn if `bonus > 0` on a period with no end date ("Is this a recurring monthly bonus, or a one-time payment?").

---

## Recommended Adjustments

### R1 — `ak_employee_project_assignments` has no UNIQUE constraint and no FK from allocations

The design notes that assignments have "no schema-level overlap prevention." This is acceptable. But there is a more fundamental gap: **no FK links allocations to assignments**.

The current design allows creating allocations for projects where the employee has no formal assignment row. The assignment table is therefore entirely advisory — it can be skipped, and the system continues to work. If assignments are meant to gate allocation entry ("you can only allocate an employee to a project they are assigned to"), this must be enforced in the application, and the design should say so explicitly.

If assignments are purely informational (human-readable membership record, not an allocation gate), the design should say that too — so the API developer does not add an unnecessary pre-check.

**Recommendation:** State explicitly in the design whether allocation creation must verify that a matching assignment row exists. This decision affects the Phase 3 API behavior.

---

### R2 — Idle cost query (8.7) is not snapshot-consistent

Query 8.7 joins live `ak_employee_cost_periods` to compute idle cost at a given month. This means historical idle cost figures change if cost periods are edited later.

This is noted as "informational only — not stored" which is the right call. But the implication — that idle cost is not frozen while project cost is frozen — creates a reconciliation gap. If someone asks "what was our total personnel cost in June 2026?", the answer is:

- Allocated cost: frozen, from `calculated_cost` snapshots ✓
- Idle cost: not frozen, computed from live cost periods (changes if cost periods are edited) ✗

**Recommendation:** Add a note to the design: "Total company personnel cost for a historical month cannot be computed with full accuracy from this schema alone; only the allocated portion is immutable. The unallocated (idle) portion uses live cost period values and may change."

This is not a schema defect — it is a documented limitation that the API and UI should communicate to operators.

---

### R3 — `ak_employee_roles` allows duplicate active assignments for the same role

The composite PK is `(employee_id, role_id, assigned_at)`. If an operator assigns Formen to an employee on 2026-01-01 (without closing it) and then assigns Formen again on 2026-06-01 (without closing the first), both rows exist with `ended_at IS NULL`. Querying active roles returns Formen twice.

The application must enforce: before creating a new assignment for a role the employee already holds actively, close the existing one first (`ended_at = :new_date - 1 day`). This is the same pattern as cost period overlap prevention.

**Recommendation:** Add this invariant explicitly to the `ak_employee_roles` column notes, matching how the cost period overlap invariant is documented in section 3.3.

---

### R4 — `normalized_name` on `ak_roles` is over-complex for this use case

Eight to twenty roles in a small construction business. The `normalized_name` column (lowercased, diacritics stripped, application-computed) adds implementation complexity — the PHP must perform Turkish diacritic normalization before every INSERT and LOOKUP.

MySQL's `utf8mb4_unicode_ci` collation already handles case-insensitive comparison and many diacritic equivalences. A simpler alternative: add a `UNIQUE KEY uq_roles_name (name)` with a case-insensitive collation, and skip `normalized_name` entirely.

**This is a mild over-engineering finding.** If the `normalized_name` approach is preferred for explicit control over Turkish-specific diacritic handling (ı vs i, ş vs s, etc. — which utf8mb4_unicode_ci handles imperfectly), it is defensible. The decision should be made consciously.

---

## Nice-to-Have Improvements

### N1 — No `role_id` on `ak_employee_project_assignments`

The design intentionally separates project membership from role. This is architecturally clean. However, in construction, the role held on a specific project is often different from the employee's catalog role.

Example: An engineer holds role "Mühendis" in the catalog but serves as "Şantiye Şefi" on Project A and as a regular engineer on Project B.

Without a project-level role field, the answer to "what role did this person have on this project?" requires correlating date ranges between `ak_employee_roles` and `ak_employee_project_assignments` — a complex join with no guarantee of a clean overlap.

**Not required for the current profitability goal.** Flagging only because it is a common construction reporting question.

---

### N2 — No company-wide total personnel cost query (allocated + unallocated combined)

Query 8.4 computes company-wide personnel cost from allocations only. Employees with no allocations in a given month do not appear. If the owner asks "what did we pay all employees in June 2026, total?" — the answer from allocations alone is incomplete. It covers only allocated time.

A complete answer requires: sum of all active cost periods for June 2026 (from `ak_employee_cost_periods`) as the gross figure, minus idle time. Neither a combined query nor its limitations are documented.

**Recommendation (optional):** Add a note or example query to section 8 that shows how to compute gross company personnel cost from cost periods, alongside the allocation-based total.

---

### N3 — No employee utilization query documented

"Which employees are overallocated this month?" and "Which employees have zero allocation this month?" are natural operational questions in a construction business. The data exists (`idx_alloc_employee_period` supports this). The query pattern is straightforward: sum `days_worked` per employee per month across all projects, compare to `working_days_base`.

Not blocking. Worth adding to the reporting section for completeness.

---

### N4 — `created_by` absent from cost periods and allocations

On a system with multiple admin users, knowing who entered a cost period or allocation could matter for auditing disputes ("who changed the salary to this amount?"). Both tables have `created_at` but no `created_by`.

Low priority for a small team with a single admin account. Noted for future consideration.

---

## Final Verdict

### Summary

| # | Finding | Severity | Schema change needed |
|---|---|---|---|
| C1 | Pre-delete check must be Phase 3 prerequisite, not follow-up | **Critical** | No — sequencing/process change |
| C2 | `days_worked > working_days_base` — application rule undefined | **Critical** | No — application logic decision |
| C3 | Section 8.6 missing ORDER BY in cost period lookup template | **High** | No — doc fix |
| C4 | Bonus double-counting risk | Low (not a defect) | No |
| R1 | Assignment↔allocation gating rule not stated | **Medium** | No — doc clarification |
| R2 | Idle cost is not snapshot-consistent — not documented as limitation | **Medium** | No — doc clarification |
| R3 | Duplicate active role assignment not prevented by invariant doc | **Medium** | No — doc fix |
| R4 | `normalized_name` on `ak_roles` is over-complex | Low | Optional simplification |
| N1 | No role on assignment (project-level role) | Nice-to-have | Optional column |
| N2 | No gross company cost query | Nice-to-have | No |
| N3 | No utilization query | Nice-to-have | No |
| N4 | No `created_by` on cost periods/allocations | Nice-to-have | Optional column |

### No schema changes are required.

All critical and high-severity findings are documentation or process clarifications, not structural defects. The five-table design is sound. The snapshot model is correct. The index strategy is appropriate. The delete behaviors are well-reasoned.

The two blocking clarifications before Phase 6B SQL is authored:

1. **C1:** Mark pre-delete check as a hard Phase 3 prerequisite.
2. **C2:** Define explicitly whether `days_worked > working_days_base` is permitted (construction overtime) or blocked.

Once those two decisions are recorded, SQL authoring can proceed without design risk.

---

**APPROVE WITH CHANGES**

Changes required: C1 (sequencing note), C2 (application rule definition), C3 (ORDER BY in 8.6). All are documentation edits to the design document — no schema redesign.
