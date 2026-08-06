import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardEntryForm } from "@/components/admin/finance/CardEntryForm";

// QA-B/C BUG-11 regression: submitting an empty gelir/gider modal used to show only the FIRST
// validation error, requiring the user to resubmit once per fixed field. Kaydet must now surface
// every missing field's message in a single attempt.

describe("QA-B/C BUG-11 CardEntryForm aggregate validation", () => {
  it("shows all missing-field errors at once on an empty submit, not just the first", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CardEntryForm
        open
        onClose={() => {}}
        onSave={onSave}
        projects={[{ id: "proj-1", title: "Demo Proje" }]}
        direction="income"
      />,
    );

    fireEvent.click(screen.getByText("Kaydet"));

    expect(screen.getByText("Başlık zorunludur.")).toBeInTheDocument();
    expect(screen.getByText("Proje seçimi zorunludur.")).toBeInTheDocument();
    expect(screen.getByText("Geçerli bir tutar girin.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("clears once all required fields are filled and submit succeeds", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <CardEntryForm
        open
        onClose={onClose}
        onSave={onSave}
        projects={[{ id: "proj-1", title: "Demo Proje" }]}
        direction="income"
      />,
    );

    fireEvent.click(screen.getByText("Kaydet"));
    expect(screen.getByText("Başlık zorunludur.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Tahsilat / Ödeme başlığı"), { target: { value: "QA DEMO Test" } });
    fireEvent.change(document.body.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: "2026-08-10" } });
    fireEvent.change(document.getElementById("entry-amount") as HTMLInputElement, { target: { value: "1000" } });

    fireEvent.click(screen.getByText("Kaydet"));

    expect(screen.queryByText("Başlık zorunludur.")).not.toBeInTheDocument();
  });
});
