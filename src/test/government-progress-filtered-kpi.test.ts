import { describe, expect, it } from "vitest";
import { computeGppKpi } from "@/pages/admin/AdminGovernmentProgressPayments";
import type { GovernmentProgressPayment } from "@/lib/apiTypes";

// P2-5 regression: the government-progress summary KPIs used to be computed
// from the full unfiltered payments list even while the card list below was
// correctly filtered — e.g. filtering to one project still showed the
// global ₺5,675,000 planned total instead of that project's ₺425,000.
// computeGppKpi() must be a pure function of whatever row list it's given,
// so wiring it to the filtered list (not the raw query result) is what
// fixes this — this test locks the calculation itself.

function row(overrides: Partial<GovernmentProgressPayment>): GovernmentProgressPayment {
  return {
    id: "id-1",
    customer_id: "cust-1",
    project_id: "proj-1",
    title: "Hakediş",
    stage: "Belirtilmemiş",
    stage_percentage: 0,
    planned_amount_try: 0,
    paid_amount_try: 0,
    due_date: null,
    paid_date: null,
    status: "planned",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as GovernmentProgressPayment;
}

describe("P2-5 government-progress filtered KPI", () => {
  const qaProjectRow = row({
    id: "qa-1",
    project_id: "a75bd005-088e-4b04-8c1f-b699773f0e1b",
    planned_amount_try: 425000,
    paid_amount_try: 127500,
    status: "partial",
  });
  const otherProjectRow = row({
    id: "other-1",
    project_id: "other-project",
    planned_amount_try: 5250000,
    paid_amount_try: 0,
    status: "planned",
  });
  const allRows = [qaProjectRow, otherProjectRow];

  it("computes global totals from the full list", () => {
    const kpi = computeGppKpi(allRows);
    expect(kpi.planned).toBe(5675000);
    expect(kpi.paid).toBe(127500);
  });

  it("computes scoped totals when given only the filtered (QA project) subset", () => {
    const kpi = computeGppKpi([qaProjectRow]);
    expect(kpi.planned).toBe(425000);
    expect(kpi.paid).toBe(127500);
    expect(kpi.pending).toBe(297500);
  });

  it("excludes cancelled rows from every total", () => {
    const cancelled = row({ id: "c-1", planned_amount_try: 999999, paid_amount_try: 500000, status: "cancelled" });
    const kpi = computeGppKpi([qaProjectRow, cancelled]);
    expect(kpi.planned).toBe(425000);
    expect(kpi.paid).toBe(127500);
  });
});
