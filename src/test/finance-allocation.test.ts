import { describe, expect, it } from "vitest";
import {
  allocateCollectionsToPlans,
  derivePlanStatus,
  effectivePaidForPlan,
} from "@/lib/finance";

describe("finance allocation", () => {
  const plans = [
    { id: "early", amount: 100, due_date: "2026-01-01", status: "Bekliyor", account_type: "resmi" },
    { id: "late", amount: 100, due_date: "2026-02-01", status: "Bekliyor", account_type: "resmi" },
  ];

  it("keeps explicitly linked collections on their selected plan", () => {
    const allocations = allocateCollectionsToPlans(plans, [
      { payment_plan_id: "late", amount: 75, account_type: "resmi" },
    ]);

    expect(allocations.get("early")).toBe(0);
    expect(allocations.get("late")).toBe(75);
  });

  it("allocates only unlinked collections by due-date FIFO", () => {
    const allocations = allocateCollectionsToPlans(plans, [
      { payment_plan_id: null, amount: 125, account_type: "resmi" },
    ]);

    expect(allocations.get("early")).toBe(100);
    expect(allocations.get("late")).toBe(25);
  });

  it("does not consume unlinked collections with a manually paid plan", () => {
    const allocations = allocateCollectionsToPlans(
      [
        { ...plans[0], status: "Ödendi" },
        plans[1],
      ],
      [{ payment_plan_id: null, amount: 80, account_type: "resmi" }],
    );

    expect(allocations.get("early")).toBe(0);
    expect(allocations.get("late")).toBe(80);
  });

  it("keeps manual paid and partial amounts consistent", () => {
    expect(effectivePaidForPlan({ ...plans[0], status: "Ödendi" }, [])).toBe(100);
    expect(effectivePaidForPlan({ ...plans[0], status: "Kısmi Ödendi", paid_amount: 35 }, [])).toBe(35);
    expect(effectivePaidForPlan(plans[0], [], 40)).toBe(40);
  });

  it("derives overdue only for an unpaid past-due plan", () => {
    expect(derivePlanStatus({ amount: 100, due_date: "2020-01-01", status: "Bekliyor" }, 0)).toBe("Vadesi Geçti");
    expect(derivePlanStatus({ amount: 100, due_date: "2020-01-01", status: "Bekliyor" }, 10)).toBe("Kısmi Ödendi");
  });
});
