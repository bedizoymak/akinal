import { describe, expect, it } from "vitest";
import { mapDashboardMovement, movementSource, normalizeGroup } from "@/pages/admin/AdminDashboard";
import type { AdminDashboardMovement } from "@/lib/apiTypes";

// P2-2 regression: "Son Hareketler" used to label every row "Müşteri"/"Resmi"
// regardless of true source, because the backend never selected card_type
// beyond customer/employee (supplier and expense_card both fell through to
// "Müşteri") nor any account_type at all (so every row defaulted to
// "Resmi"). Locks the corrected source-type and account-classification
// mapping now that dashboard.php returns the real values.

describe("P2-2 dashboard recent-activity source labeling", () => {
  it("maps every real card_type to its own distinct label", () => {
    expect(movementSource("customer")).toBe("Müşteri");
    expect(movementSource("employee")).toBe("Personel");
    expect(movementSource("supplier")).toBe("Tedarikçi");
    expect(movementSource("expense_card")).toBe("Masraf Kartı");
  });

  it("does not collapse supplier/expense_card into Müşteri", () => {
    expect(movementSource("supplier")).not.toBe("Müşteri");
    expect(movementSource("expense_card")).not.toBe("Müşteri");
  });
});

describe("P2-2 dashboard recent-activity account classification", () => {
  it("reflects the row's actual account_type instead of always defaulting to Resmi", () => {
    expect(normalizeGroup("gayri_resmi")).toBe("Gayri Resmi");
    expect(normalizeGroup("resmi")).toBe("Resmi");
  });
});

function row(overrides: Partial<AdminDashboardMovement>): AdminDashboardMovement {
  return {
    id: "row-1",
    label: "Kayıt",
    party_name: null,
    realized_amount: 0,
    original_amount: 0,
    date: "2026-08-01",
    direction: "Gelir",
    card_type: "customer",
    account_type: "resmi",
    currency: "TRY",
    status: "Kısmi Ödendi",
    project_title: null,
    ...overrides,
  };
}

describe("P2-2 mapDashboardMovement — full response shapes", () => {
  it("customer row: Gelir direction, realized (not planned) TRY amount, party name", () => {
    const m = mapDashboardMovement(row({
      card_type: "customer", direction: "Gelir", account_type: "resmi",
      party_name: "Salih Elüstü", realized_amount: 55000, original_amount: 55000, currency: "TRY",
    }));
    expect(m.source).toBe("Müşteri");
    expect(m.direction).toBe("Gelir");
    expect(m.realizedAmountTry).toBe(55000);
    expect(m.group).toBe("Resmi");
    expect(m.partyName).toBe("Salih Elüstü");
  });

  it("unofficial EUR customer row: realized TRY amount is primary, original EUR amount kept separately", () => {
    const m = mapDashboardMovement(row({
      card_type: "customer", direction: "Gelir", account_type: "gayri_resmi",
      realized_amount: 192325, original_amount: 3500, currency: "EUR",
    }));
    expect(m.group).toBe("Gayri Resmi");
    expect(m.currency).toBe("EUR");
    expect(m.realizedAmountTry).toBe(192325); // NOT the planned 549500
    expect(m.originalAmount).toBe(3500); // NOT mislabeled as the TL amount
  });

  it("employee row: Gider direction, Personel source", () => {
    const m = mapDashboardMovement(row({ card_type: "employee", direction: "Gider", realized_amount: 12000, original_amount: 12000 }));
    expect(m.source).toBe("Personel");
    expect(m.direction).toBe("Gider");
  });

  it("supplier row: Gider direction, Tedarikçi source, realized amount only (not the ₺480,000 planned figure)", () => {
    const m = mapDashboardMovement(row({
      card_type: "supplier", direction: "Gider", realized_amount: 180000, original_amount: 180000, currency: "TRY",
    }));
    expect(m.source).toBe("Tedarikçi");
    expect(m.direction).toBe("Gider");
    expect(m.realizedAmountTry).toBe(180000);
  });

  it("expense_card row: Gider direction, Masraf Kartı source", () => {
    const m = mapDashboardMovement(row({ card_type: "expense_card", direction: "Gider", realized_amount: 95000, original_amount: 95000 }));
    expect(m.source).toBe("Masraf Kartı");
    expect(m.direction).toBe("Gider");
  });

  it("falls back to Gelir when direction is missing/unrecognized, never silently Gider", () => {
    const m = mapDashboardMovement(row({ direction: null as unknown as string }));
    expect(m.direction).toBe("Gelir");
  });
});
