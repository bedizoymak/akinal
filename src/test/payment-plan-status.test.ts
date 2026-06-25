/**
 * Regression tests for pp_auto_status() logic (payment-plans.php).
 *
 * These cases are owner-approved and must never silently regress.
 * Mirror any changes to pp_auto_status() here.
 */

import { describe, it, expect } from "vitest";

// Mirrors pp_auto_status() from public_html/api/admin/payment-plans.php
function ppAutoStatus(amount: number, paid: number, date: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = date !== "" && date < today;

  if (paid <= 0) {
    return isOverdue ? "Gecikmiş" : "Planlanan";
  }
  if (paid >= amount && amount > 0) {
    return paid > amount ? "Fazla Ödendi" : "Ödendi";
  }
  return isOverdue ? "Kısmi Ödendi + Gecikmiş" : "Kısmi Ödendi";
}

const FUTURE = "2099-01-01";
const PAST   = "2000-01-01";

describe("ppAutoStatus", () => {
  it("Case 1 — unpaid, future date → Planlanan", () => {
    expect(ppAutoStatus(100, 0, FUTURE)).toBe("Planlanan");
  });

  it("Case 2 — unpaid, past date → Gecikmiş", () => {
    expect(ppAutoStatus(100, 0, PAST)).toBe("Gecikmiş");
  });

  it("Case 3 — partially paid, future date → Kısmi Ödendi", () => {
    expect(ppAutoStatus(100, 40, FUTURE)).toBe("Kısmi Ödendi");
  });

  it("Case 4 — partially paid, past date → Kısmi Ödendi + Gecikmiş", () => {
    expect(ppAutoStatus(100, 40, PAST)).toBe("Kısmi Ödendi + Gecikmiş");
  });

  it("Case 5 — fully paid → Ödendi", () => {
    expect(ppAutoStatus(100, 100, FUTURE)).toBe("Ödendi");
  });

  it("Case 6 — overpaid → Fazla Ödendi", () => {
    expect(ppAutoStatus(100, 150, FUTURE)).toBe("Fazla Ödendi");
  });
});
