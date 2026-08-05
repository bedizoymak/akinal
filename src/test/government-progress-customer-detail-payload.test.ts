import { describe, expect, it } from "vitest";
import { GppFormToPayload, type GppFormState } from "@/pages/admin/AdminCustomerDetail";

// P0-4 regression: the customer-detail "Hakediş Kaydı" dialog used to send
// stage/paid_amount_try/paid_date to government-progress-payments.php, which
// silently discards them (gpp_payload() hardcodes stage to "Belirtilmemiş"
// and derives paid_amount_try/paid_date from collections/breakdowns only —
// never from the client). The form now only offers fields that actually
// persist; this locks the payload contract so those fields can never
// silently reappear and re-introduce the "success but discarded" bug.

const baseForm: GppFormState = {
  title: "QA UAT Devlet Kentsel Dönüşüm Hakedişi",
  planned_amount_try: "425000",
  due_date: "2026-09-30",
  notes: "",
  project_id: "a75bd005-088e-4b04-8c1f-b699773f0e1b",
};

describe("P0-4 government-progress customer-detail payload", () => {
  it("never sends stage, paid_amount_try, or paid_date (server ignores/overrides them)", () => {
    const payload = GppFormToPayload(baseForm, "afdff20f-b26c-4864-8f8c-18499574bb54") as unknown as Record<string, unknown>;
    expect(payload).not.toHaveProperty("stage");
    expect(payload).not.toHaveProperty("paid_amount_try");
    expect(payload).not.toHaveProperty("paid_date");
  });

  it("persists exactly the plan-level fields the backend accepts", () => {
    const payload = GppFormToPayload(baseForm, "afdff20f-b26c-4864-8f8c-18499574bb54");
    expect(payload).toEqual({
      customer_id: "afdff20f-b26c-4864-8f8c-18499574bb54",
      project_id: "a75bd005-088e-4b04-8c1f-b699773f0e1b",
      title: "QA UAT Devlet Kentsel Dönüşüm Hakedişi",
      planned_amount_try: 425000,
      due_date: "2026-09-30",
      notes: null,
    });
  });

  it("maps the '__none' project sentinel to null and an empty due date to null", () => {
    const payload = GppFormToPayload({ ...baseForm, project_id: "__none", due_date: "" }, "cust-1");
    expect(payload.project_id).toBeNull();
    expect(payload.due_date).toBeNull();
  });
});
