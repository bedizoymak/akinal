import { describe, expect, it } from "vitest";
import {
  assertNoOverAllocation,
  assertSettlementCompatibility,
  deriveCanonicalPlanStatus,
  validateInstrumentMaturity,
  validateLedgerPayload,
  validatePostedEntryMutation,
  validateReversalAdjustment,
} from "@/lib/canonicalFinanceContract";

const receipt = {
  business_transaction_id: "tx-1",
  event_type: "customer_receipt",
  direction: "income",
  status: "posted",
  account_type: "resmi",
  allocation_scope: "project",
  allocation_note: null,
  counterparty_type: "customer",
  counterparty_id: "customer-1",
  customer_id: "customer-1",
  project_id: "project-1",
  currency: "TRY",
  amount: 1000,
  base_amount: 1000,
  transaction_date: "2026-06-14",
};

describe("canonical finance contract", () => {
  it("accepts a valid customer receipt", () => {
    expect(validateLedgerPayload(receipt, "2026-06-14")).toEqual([]);
  });

  it("rejects unsupported currency and invalid account type", () => {
    const errors = validateLedgerPayload({ ...receipt, currency: "GBP", account_type: "mixed" });
    expect(errors).toContain("currency is required and must be canonical.");
    expect(errors).toContain("account_type is required and must be canonical.");
  });

  it("rejects invalid counterparty and missing project", () => {
    const errors = validateLedgerPayload({ ...receipt, counterparty_id: null, customer_id: null, project_id: null });
    expect(errors).toContain("The selected counterparty type requires counterparty_id.");
    expect(errors).toContain("Project scope requires project_id.");
  });

  it("allows company overhead only with no project and an allocation note", () => {
    const valid = validateLedgerPayload({
      ...receipt,
      event_type: "general_expense",
      direction: "expense",
      counterparty_type: "other",
      counterparty_id: null,
      customer_id: null,
      allocation_scope: "company_overhead",
      project_id: null,
      allocation_note: "Head office utility",
    });
    expect(valid).toEqual([]);
  });

  it("does not realize cheque or senet before cleared maturity", () => {
    const errors = validateInstrumentMaturity({
      ...receipt,
      payment_method: "Çek",
      cheque_maturity_date: "2026-06-20",
      instrument_status: "received",
    }, "2026-06-14");
    expect(errors).toContain("Cheque/senet is realized only when cleared or paid at maturity.");
  });

  it("rejects account and currency mismatch, including official/unofficial crossing", () => {
    const plan = { ...receipt, currency: "TRY", account_type: "resmi" };
    const entry = { ...receipt, currency: "EUR", account_type: "gayri_resmi" };
    expect(() => assertSettlementCompatibility(plan, entry, { currency: "TRY", account_type: "resmi" }))
      .toThrow("Resmi/Gayri Resmi settlement must never cross.");
    expect(() => assertSettlementCompatibility(plan, { ...entry, account_type: "resmi" }, { currency: "TRY", account_type: "resmi" }))
      .toThrow("Plan, entry, and settlement currency must match.");
  });

  it("rejects over-allocation", () => {
    expect(() => assertNoOverAllocation(600, 1000, 500, 1000, 200))
      .toThrow("Settlement exceeds remaining plan amount.");
  });

  it("derives partial, paid, and overdue remaining states", () => {
    expect(deriveCanonicalPlanStatus(1000, 400, "2026-06-20", "2026-06-14")).toEqual({
      status: "partial", remainingAmount: 600, isOverdue: false,
    });
    expect(deriveCanonicalPlanStatus(1000, 1000, "2026-06-20", "2026-06-14").status).toBe("paid");
    expect(deriveCanonicalPlanStatus(1000, 400, "2026-06-10", "2026-06-14")).toEqual({
      status: "partial", remainingAmount: 600, isOverdue: true,
    });
  });

  it("prevents destructive posted-entry edits", () => {
    expect(validatePostedEntryMutation(receipt, { amount: 900 }))
      .toContain("Posted entry field amount is immutable.");
  });

  it("requires parent entry and reason for reversal", () => {
    expect(validateReversalAdjustment({ event_type: "reversal" })).toEqual([
      "Reversal or adjustment requires parent_entry_id.",
      "Reversal or adjustment requires a reason.",
    ]);
  });
});
