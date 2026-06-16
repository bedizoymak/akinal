import { describe, expect, it } from "vitest";
import {
  calculateCanonicalCardMetrics,
  compareCanonicalParity,
  countExcludedDuplicateRisk,
  countUnresolvedLegacy,
  deriveCanonicalReadPlanState,
  type CanonicalReadModelInput,
} from "@/lib/canonicalReadModel";

const baseInput = (): CanonicalReadModelInput => ({
  asOfDate: "2026-06-15",
  plans: [
    { id: "cust-plan-1", amount: 1000, direction: "income", owner_type: "customer", owner_id: "cust-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", due_date: "2026-06-10", status: "pending" },
    { id: "cust-plan-2", amount: 500, direction: "income", owner_type: "customer", owner_id: "cust-1", project_id: "proj-1", account_type: "gayri_resmi", currency: "TRY", due_date: "2026-06-20", status: "pending" },
    { id: "employee-plan-1", amount: 300, direction: "expense", owner_type: "employee", owner_id: "emp-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", due_date: "2026-06-01", status: "pending", category_code: "payroll" },
    { id: "supplier-plan-1", amount: 400, direction: "expense", owner_type: "supplier", owner_id: "sup-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", due_date: "2026-06-25", status: "pending", category_code: "iron" },
    { id: "canceled-plan", amount: 999, direction: "income", owner_type: "customer", owner_id: "cust-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", due_date: "2026-06-01", status: "İptal" },
    { id: "duplicate-plan", amount: 999, direction: "income", owner_type: "customer", owner_id: "cust-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", due_date: "2026-06-01", status: "pending", duplicate_risk: true },
  ],
  entries: [
    { id: "receipt-1", amount: 600, direction: "income", status: "posted", event_type: "customer_receipt", owner_type: "customer", owner_id: "cust-1", project_id: "proj-1", account_type: "resmi", currency: "TRY" },
    { id: "receipt-2", amount: 200, direction: "income", status: "posted", event_type: "customer_receipt", owner_type: "customer", owner_id: "cust-1", project_id: "proj-1", account_type: "gayri_resmi", currency: "TRY" },
    { id: "payroll-1", amount: 100, direction: "expense", status: "posted", event_type: "personnel_payment", owner_type: "employee", owner_id: "emp-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", category_code: "payroll" },
    { id: "supplier-pay-1", amount: 250, direction: "expense", status: "posted", event_type: "supplier_payment", owner_type: "supplier", owner_id: "sup-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", category_code: "iron" },
    { id: "reversed-expense", amount: 999, direction: "expense", status: "reversed", event_type: "supplier_payment", owner_type: "supplier", owner_id: "sup-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", reversal_entry_id: "rev-1" },
    { id: "duplicate-receipt", amount: 600, direction: "income", status: "posted", event_type: "customer_receipt", owner_type: "customer", owner_id: "cust-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", duplicate_risk: true },
    { id: "unresolved-expense", amount: 100, direction: "expense", status: "posted", event_type: "general_expense", owner_type: "supplier", owner_id: "sup-1", project_id: "proj-1", account_type: "resmi", currency: "TRY", unresolved: true },
  ],
  settlements: [
    { id: "set-1", payment_plan_id: "cust-plan-1", financial_entry_id: "receipt-1", allocated_amount: 600, account_type: "resmi", currency: "TRY" },
    { id: "set-2", payment_plan_id: "cust-plan-2", financial_entry_id: "receipt-2", allocated_amount: 200, account_type: "gayri_resmi", currency: "TRY" },
    { id: "set-3", payment_plan_id: "employee-plan-1", financial_entry_id: "payroll-1", allocated_amount: 100, account_type: "resmi", currency: "TRY" },
    { id: "set-4", payment_plan_id: "supplier-plan-1", financial_entry_id: "supplier-pay-1", allocated_amount: 250, account_type: "resmi", currency: "TRY" },
    { id: "set-reversed", payment_plan_id: "supplier-plan-1", financial_entry_id: "supplier-pay-1", allocated_amount: 50, account_type: "resmi", currency: "TRY", reversed_at: "2026-06-15" },
  ],
});

describe("canonical read model", () => {
  it("calculates customer balance from active plans and settlements only", () => {
    const metrics = calculateCanonicalCardMetrics(baseInput(), { ownerType: "customer", ownerId: "cust-1", currency: "TRY" });

    expect(metrics.totalPlannedReceivable).toBe(1500);
    expect(metrics.totalRealizedCollection).toBe(800);
    expect(metrics.remainingReceivable).toBe(700);
    expect(metrics.overdueReceivable).toBe(400);
    expect(metrics.officialReceivable).toBe(400);
    expect(metrics.unofficialReceivable).toBe(300);
    expect(metrics.unallocatedCollections).toBe(0);
  });

  it("keeps official and unofficial buckets separated", () => {
    const official = calculateCanonicalCardMetrics(baseInput(), { ownerType: "customer", ownerId: "cust-1", accountType: "resmi", currency: "TRY" });
    const unofficial = calculateCanonicalCardMetrics(baseInput(), { ownerType: "customer", ownerId: "cust-1", accountType: "gayri_resmi", currency: "TRY" });

    expect(official.remainingReceivable).toBe(400);
    expect(unofficial.remainingReceivable).toBe(300);
  });

  it("calculates project profitability without double-counting duplicates or reversed rows", () => {
    const metrics = calculateCanonicalCardMetrics(baseInput(), { projectId: "proj-1", currency: "TRY" });

    expect(metrics.realizedIncome).toBe(800);
    expect(metrics.realizedExpense).toBe(350);
    expect(metrics.remainingReceivable).toBe(700);
    expect(metrics.remainingPayable).toBe(350);
    expect(metrics.realizedNetCash).toBe(450);
    expect(metrics.forecastCompletionProfit).toBe(800);
  });

  it("calculates personnel payroll and overdue payable from the same settlement contract", () => {
    const metrics = calculateCanonicalCardMetrics(baseInput(), { ownerType: "employee", ownerId: "emp-1", currency: "TRY" });

    expect(metrics.plannedPayroll).toBe(300);
    expect(metrics.realizedPayroll).toBe(100);
    expect(metrics.remainingPayable).toBe(200);
    expect(metrics.overduePayable).toBe(200);
  });

  it("calculates supplier payable and material category impact", () => {
    const supplier = calculateCanonicalCardMetrics(baseInput(), { ownerType: "supplier", ownerId: "sup-1", currency: "TRY" });
    const iron = calculateCanonicalCardMetrics(baseInput(), { categoryCode: "iron", currency: "TRY" });

    expect(supplier.contractedPayable).toBe(400);
    expect(supplier.realizedPayment).toBe(250);
    expect(supplier.remainingPayable).toBe(150);
    expect(iron.plannedCategoryCost).toBe(400);
    expect(iron.realizedCategoryCost).toBe(250);
    expect(iron.remainingCategoryPayable).toBe(150);
  });

  it("derives paid, partial, overdue, pending, and canceled plan states", () => {
    const input = baseInput();
    expect(deriveCanonicalReadPlanState(input.plans![0], input.settlements!, input.asOfDate)).toMatchObject({ status: "partial", remainingAmount: 400, isOverdue: true });
    expect(deriveCanonicalReadPlanState({ ...input.plans![0], id: "full", amount: 100 }, [{ id: "s", payment_plan_id: "full", financial_entry_id: "e", allocated_amount: 100 }], input.asOfDate).status).toBe("paid");
    expect(deriveCanonicalReadPlanState({ ...input.plans![0], id: "future", due_date: "2026-07-01" }, [], input.asOfDate).status).toBe("pending");
    expect(deriveCanonicalReadPlanState(input.plans![4], [], input.asOfDate).status).toBe("canceled");
  });

  it("reports parity deltas and debt counters", () => {
    const input = baseInput();
    const metrics = calculateCanonicalCardMetrics(input, { projectId: "proj-1", currency: "TRY" });
    const comparisons = compareCanonicalParity({
      cardType: "project",
      projectId: "proj-1",
      currency: "TRY",
      canonical: { forecastCompletionProfit: metrics.forecastCompletionProfit },
      current: { forecastCompletionProfit: 900 },
      includedRowCount: 8,
      excludedDuplicateRiskCount: countExcludedDuplicateRisk(input),
      unresolvedLegacyCount: countUnresolvedLegacy(input),
    });

    expect(comparisons[0]).toMatchObject({
      metric: "forecastCompletionProfit",
      delta: 100,
      mismatchClass: "amount mismatch",
      excludedDuplicateRiskCount: 2,
      unresolvedLegacyCount: 1,
    });
  });
});

