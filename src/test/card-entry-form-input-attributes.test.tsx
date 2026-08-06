import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardEntryForm } from "@/components/admin/finance/CardEntryForm";

// QA-B/C BUG-12 regression: financial title/amount fields lacked autoComplete="off", letting
// the browser inject a previously-typed value from an unrelated record into a new one, and
// amount fields lacked inputMode="decimal" for a proper mobile numeric keypad.

describe("QA-B/C BUG-12 CardEntryForm input attributes", () => {
  it("title field disables browser autofill", () => {
    render(<CardEntryForm open onClose={() => {}} onSave={vi.fn()} projects={[]} direction="income" />);
    expect(screen.getByPlaceholderText("Tahsilat / Ödeme başlığı")).toHaveAttribute("autoComplete", "off");
  });

  it("amount fields use inputMode=decimal and disable autofill", () => {
    render(<CardEntryForm open onClose={() => {}} onSave={vi.fn()} projects={[]} direction="income" />);
    const amount = document.getElementById("entry-amount") as HTMLInputElement;
    expect(amount).toHaveAttribute("inputMode", "decimal");
    expect(amount).toHaveAttribute("autoComplete", "off");

    const amountFields = screen.getAllByPlaceholderText("0.00");
    const paid = amountFields.find((el) => el.id !== "entry-amount");
    expect(paid).toHaveAttribute("inputMode", "decimal");
    expect(paid).toHaveAttribute("autoComplete", "off");
  });
});
