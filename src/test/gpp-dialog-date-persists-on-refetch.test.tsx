import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GppDialog, BreakdownDialog } from "@/pages/admin/AdminGovernmentProgressPayments";
import type { GovernmentProgressPayment, GppBreakdown } from "@/lib/apiTypes";

// AKINAL-QA-C-002 regression: the standalone "Devlet Hakedişleri" page's own
// GppDialog/BreakdownDialog reset ALL form state — including a just-typed Vade
// Tarihi/Ödeme Tarihi — on every render where `initial`/`editing`/`breakdown`
// received a new object reference, not just when the dialog actually opened.
// This is the same anti-pattern already fixed in CardEntryForm.tsx and the
// customer-detail GppDialog (see card-entry-form-date-persists-on-refetch.test.tsx);
// this file locks in the mechanical port of that fix to the two dialogs in
// AdminGovernmentProgressPayments.tsx that the earlier fix missed.

function getDateInputs(): HTMLInputElement[] {
  return Array.from(document.body.querySelectorAll('input[type="date"]'));
}

function gppRow(overrides: Partial<GovernmentProgressPayment> = {}): GovernmentProgressPayment {
  return {
    id: "gpp-1",
    project_id: "proj-1",
    customer_id: "cust-1",
    source_customer_financial_entry_id: null,
    title: "Hakediş / Demo",
    stage: "Belirtilmemiş",
    stage_percentage: 0,
    planned_amount_try: 300000,
    paid_amount_try: 0,
    due_date: null,
    paid_date: null,
    status: "planned",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    breakdowns: [],
    collections: [],
    ...overrides,
  };
}

function GppHarness({ initial, editing }: { initial: GovernmentProgressPayment | null; editing: GovernmentProgressPayment | null }) {
  const [refetchTick, setRefetchTick] = useState(0);
  // Simulate a background payments-list refetch handing the dialog a brand-new
  // `initial`/`editing` object with the same content every time the tick changes.
  const liveEditing = editing ? ({ ...editing, __tick: refetchTick } as unknown as GovernmentProgressPayment) : null;
  const liveInitial = initial
    ? { customer_id: initial.customer_id ?? "", project_id: initial.project_id ?? "", title: initial.title, planned_amount_try: String(initial.planned_amount_try), due_date: initial.due_date ?? "", notes: initial.notes ?? "" }
    : { customer_id: "", project_id: "", title: "", planned_amount_try: "1750000", due_date: "", notes: "" };

  return (
    <div>
      <button onClick={() => setRefetchTick((t) => t + 1)}>simulate-refetch</button>
      <GppDialog
        open
        onClose={() => {}}
        onSave={vi.fn().mockResolvedValue(undefined)}
        initial={liveInitial}
        editing={liveEditing}
        customers={[{ id: "cust-1", display: "Demo Müşteri" }]}
        projects={[{ id: "proj-1", title: "Demo Proje" }]}
      />
    </div>
  );
}

function BreakdownHarness({ breakdown }: { breakdown: GppBreakdown }) {
  const [refetchTick, setRefetchTick] = useState(0);
  const liveBreakdown = { ...breakdown, __tick: refetchTick } as unknown as GppBreakdown;

  return (
    <div>
      <button onClick={() => setRefetchTick((t) => t + 1)}>simulate-refetch</button>
      <BreakdownDialog open onClose={() => {}} onSave={vi.fn().mockResolvedValue(undefined)} breakdown={liveBreakdown} />
    </div>
  );
}

describe("AKINAL-QA-C-002 GppDialog Vade Tarihi survives a mid-edit refetch", () => {
  it("keeps a user-typed Vade Tarihi for a NEW Hakediş after the parent re-renders", () => {
    render(<GppHarness initial={null} editing={null} />);
    const [dueDateInput] = getDateInputs();

    fireEvent.change(dueDateInput, { target: { value: "2026-10-20" } });
    expect(dueDateInput.value).toBe("2026-10-20");

    fireEvent.click(screen.getByText("simulate-refetch"));

    expect(dueDateInput.value).toBe("2026-10-20");
  });

  it("keeps a user-typed Vade Tarihi while EDITING an existing Hakediş after a same-open-state refetch", () => {
    const existing = gppRow({ due_date: "2026-09-01" });
    render(<GppHarness initial={existing} editing={existing} />);
    const [dueDateInput] = getDateInputs();

    expect(dueDateInput.value).toBe("2026-09-01");
    fireEvent.change(dueDateInput, { target: { value: "2026-10-20" } });
    expect(dueDateInput.value).toBe("2026-10-20");

    fireEvent.click(screen.getByText("simulate-refetch"));

    expect(dueDateInput.value).toBe("2026-10-20");
  });
});

describe("AKINAL-QA-C-002 BreakdownDialog Vade/Ödeme Tarihi survives a mid-edit refetch", () => {
  it("keeps user-typed Vade Tarihi and Ödeme Tarihi after a same-open-state refetch", () => {
    const breakdown: GppBreakdown = {
      id: "bd-1",
      government_progress_payment_id: "gpp-1",
      stage: "Su Basmanı",
      stage_percentage: 30,
      planned_amount_try: 90000,
      paid_amount_try: 0,
      due_date: null,
      paid_date: null,
      status: "planned",
      notes: null,
      sort_order: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    render(<BreakdownHarness breakdown={breakdown} />);
    const [dueDateInput, paidDateInput] = getDateInputs();

    fireEvent.change(dueDateInput, { target: { value: "2026-10-20" } });
    fireEvent.change(paidDateInput, { target: { value: "2026-08-05" } });
    expect(dueDateInput.value).toBe("2026-10-20");
    expect(paidDateInput.value).toBe("2026-08-05");

    fireEvent.click(screen.getByText("simulate-refetch"));

    expect(dueDateInput.value).toBe("2026-10-20");
    expect(paidDateInput.value).toBe("2026-08-05");
  });
});
