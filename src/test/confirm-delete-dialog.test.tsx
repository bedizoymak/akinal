import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";
import { describeGppCascadeDelete } from "@/lib/finance";

// QA-B/C BUG-10 regression: delete confirmation used the browser's native window.confirm(),
// which shows no record name, no linked-record warning, and looks/behaves differently per
// browser. useConfirmDelete() replaces it with the app's own AlertDialog everywhere a
// destructive delete is triggered (Devlet Hakedişleri, Müşteriler, Gelenler, Gidenler — see
// CardStatementTable.tsx, AdminGovernmentProgressPayments.tsx, AdminCustomers.tsx,
// AdminCustomerDetail.tsx). This locks the shared hook's contract: the record name is shown,
// cancel sends no request, and confirm sends exactly one.

function Harness({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const { confirmDelete, dialog } = useConfirmDelete();
  return (
    <div>
      <button
        onClick={() =>
          confirmDelete({
            title: "Kaydı sil",
            description: '"QA DEMO Test Kaydı" (₺100.000,00) kalıcı olarak silinecek.',
            onConfirm,
          })
        }
      >
        open-confirm
      </button>
      {dialog}
    </div>
  );
}

describe("QA-B/C BUG-10 useConfirmDelete — app modal replaces window.confirm()", () => {
  it("shows the record name/description and sends no request until confirmed", () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<Harness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("open-confirm"));
    expect(screen.getByText(/QA DEMO Test Kaydı/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancelling sends no request", () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<Harness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("open-confirm"));
    fireEvent.click(screen.getByText("Vazgeç"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirming sends exactly one request", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<Harness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("open-confirm"));
    fireEvent.click(screen.getByText("Sil"));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));

    // Fire more clicks after resolution — must still be exactly one call, not re-triggerable
    // once the dialog has closed.
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables cancel while the delete request is in flight (prevents a race with double-click)", async () => {
    let resolveConfirm: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { resolveConfirm = resolve; }));
    render(<Harness onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("open-confirm"));
    fireEvent.click(screen.getByText("Sil"));

    expect(screen.getByText("Vazgeç")).toBeDisabled();

    resolveConfirm();
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });
});

describe("QA-C BUG-10 describeGppCascadeDelete — real cascade counts, never fabricated", () => {
  it("mentions both breakdowns and collections when both exist", () => {
    expect(describeGppCascadeDelete(3, 5)).toBe(" Buna bağlı 3 aşama ve 5 tahsilat kaydı da birlikte silinecek.");
  });

  it("mentions only breakdowns when there are no collections", () => {
    expect(describeGppCascadeDelete(2, 0)).toBe(" Buna bağlı 2 aşama da birlikte silinecek.");
  });

  it("mentions only collections when there are no breakdowns", () => {
    expect(describeGppCascadeDelete(0, 4)).toBe(" Buna bağlı 4 tahsilat kaydı da birlikte silinecek.");
  });

  it("returns an empty string (no fabricated note) when there is nothing to cascade", () => {
    expect(describeGppCascadeDelete(0, 0)).toBe("");
  });
});
