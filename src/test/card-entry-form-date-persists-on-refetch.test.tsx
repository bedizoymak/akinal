import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardEntryForm, type CardEntryFormValues } from "@/components/admin/finance/CardEntryForm";

// QA-B BUG-02/03/08 regression: CardEntryForm (and the analogous GppDialog in
// AdminCustomerDetail.tsx) reset ALL form state — including the date the admin had just typed —
// on every render where `initial`/`defaultAccountType` received a new object/prop reference,
// not just when the dialog actually opened. In production this fires whenever a background
// query refetch (projects list, entries list) resolves a structurally-new object while the
// admin is still mid-edit with the dialog open, silently reverting the date field to its
// default (today for a new entry, empty for an edit) before Kaydet is ever clicked. The fix
// keys the reset effect off the closed→open transition only (see the `wasOpen` ref in
// CardEntryForm.tsx). This test proves a user-typed date survives a same-open-state re-render
// with a brand-new `initial` object.

// Dialog content is rendered into a Radix Portal (document.body), not inside RTL's `container`.
function getDateInput(): HTMLInputElement {
  const input = document.body.querySelector('input[type="date"]');
  if (!input) throw new Error("date input not found");
  return input as HTMLInputElement;
}

function Harness({ initial }: { initial?: Partial<CardEntryFormValues> }) {
  const [refetchTick, setRefetchTick] = useState(0);
  // Simulate a query refetch: a NEW object reference with the SAME content every time the
  // tick changes — exactly what TanStack Query without structural sharing (or a first
  // resolution replacing an empty-array fallback) would hand to the dialog while it stays open.
  const liveInitial = initial ? ({ ...initial, __tick: refetchTick } as unknown as Partial<CardEntryFormValues>) : undefined;

  return (
    <div>
      <button onClick={() => setRefetchTick((t) => t + 1)}>simulate-refetch</button>
      <CardEntryForm
        open
        onClose={() => {}}
        onSave={vi.fn().mockResolvedValue(undefined)}
        initial={liveInitial}
        projects={[{ id: "proj-1", title: "Demo Proje" }]}
        direction="income"
      />
    </div>
  );
}

describe("QA-B BUG-02/03/08 CardEntryForm date survives a mid-edit refetch", () => {
  // Baseline sanity check for the NEW-entry path (`initial` stays `undefined` throughout, so
  // this doesn't exercise the unstable-reference bug itself — it passes even without the fix —
  // but locks in that new-entry creation keeps working now that the reset effect changed).
  it("keeps a user-typed date for a NEW entry after the parent re-renders", () => {
    render(<Harness />);
    const dateInput = getDateInput();

    fireEvent.change(dateInput, { target: { value: "2026-08-01" } });
    expect(dateInput.value).toBe("2026-08-01");

    // Force the harness to re-render with the dialog still open (open=true throughout).
    fireEvent.click(screen.getByText("simulate-refetch"));

    expect(dateInput.value).toBe("2026-08-01");
  });

  it("keeps a user-typed date while EDITING an existing entry after a same-open-state refetch", () => {
    render(
      <Harness
        initial={{ id: "entry-1", entry_date: "2026-07-01", title: "Mevcut Kayıt", amount: 1000 } as unknown as Partial<CardEntryFormValues>}
      />,
    );
    const dateInput = getDateInput();

    expect(dateInput.value).toBe("2026-07-01");
    fireEvent.change(dateInput, { target: { value: "2026-09-15" } });
    expect(dateInput.value).toBe("2026-09-15");

    fireEvent.click(screen.getByText("simulate-refetch"));

    expect(dateInput.value).toBe("2026-09-15");
  });
});
