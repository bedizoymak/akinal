import { describe, it, expect } from "vitest";
import type {
  CardFinancialEntry,
  CardEntryStatus,
  CardEntryCurrency,
  CustomerFinancialEntry,
  EmployeeFinancialEntry,
  SupplierFinancialEntry,
  ExpenseCardFinancialEntry,
  ProjectStatementRow,
  GidenlerEntry,
} from "@/lib/apiTypes";

// ── Status derivation rules (mirrored from server fe_auto_status) ──────────────

function deriveStatus(amount: number, paidAmount: number, entryDate: string): CardEntryStatus {
  const today = new Date().toISOString().slice(0, 10);
  const paid = paidAmount;
  const total = amount;
  if (paid <= 0) {
    return entryDate < today ? "Gecikmiş" : "Planlanan";
  }
  if (paid >= total) {
    return paid > total ? "Fazla Ödendi" : "Gerçekleşti";
  }
  // Partial payment: status is always "Kısmi Ödendi" regardless of date.
  // Overdue state (past due + partial) is conveyed separately via is_overdue flag,
  // NOT by replacing the status — this preserves the partial-payment signal.
  return "Kısmi Ödendi";
}

function isOverdue(amount: number, paidAmount: number, entryDate: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return entryDate < today && paidAmount < amount;
}

// ── TRY equivalent conversion ──────────────────────────────────────────────────

function toTRY(amount: number, rate: number): number {
  return amount * rate;
}

// ── Profit calculation ─────────────────────────────────────────────────────────

function computePlannedProfit(
  customerEntries: { amount_try: number }[],
  expenseEntries: { amount_try: number }[],
): number {
  const income = customerEntries.reduce((s, e) => s + e.amount_try, 0);
  const cost = expenseEntries.reduce((s, e) => s + e.amount_try, 0);
  return income - cost;
}

function computeRealizedProfit(
  customerEntries: { paid_amount_try: number }[],
  expenseEntries: { paid_amount_try: number }[],
): number {
  const income = customerEntries.reduce((s, e) => s + e.paid_amount_try, 0);
  const cost = expenseEntries.reduce((s, e) => s + e.paid_amount_try, 0);
  return income - cost;
}

// ── UNION ALL row shape ────────────────────────────────────────────────────────

function makeProjectStatementRow(
  entry: CardFinancialEntry,
  direction: "income" | "expense",
): ProjectStatementRow {
  const sign = direction === "income" ? 1 : -1;
  return {
    ...entry,
    direction,
    sign,
    signed_amount_try: sign * Number(entry.amount_try),
    signed_paid_amount_try: sign * Number(entry.paid_amount_try),
    remaining_amount: Number(entry.amount) - Number(entry.paid_amount),
    remaining_amount_try: Number(entry.amount_try) - Number(entry.paid_amount_try),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("Card finance — status derivation", () => {
  it("Planlanan when unpaid and future date", () => {
    const future = "2099-12-31";
    expect(deriveStatus(1000, 0, future)).toBe("Planlanan");
  });

  it("Gecikmiş when unpaid and past date", () => {
    const past = "2020-01-01";
    expect(deriveStatus(1000, 0, past)).toBe("Gecikmiş");
  });

  it("Gerçekleşti when fully paid", () => {
    expect(deriveStatus(1000, 1000, "2020-01-01")).toBe("Gerçekleşti");
  });

  it("Fazla Ödendi when overpaid", () => {
    expect(deriveStatus(1000, 1500, "2020-01-01")).toBe("Fazla Ödendi");
  });

  it("Kısmi Ödendi when partially paid and future date", () => {
    const future = "2099-12-31";
    expect(deriveStatus(1000, 500, future)).toBe("Kısmi Ödendi");
  });

  it("Kısmi Ödendi even when past date (overdue conveyed via is_overdue flag, not status)", () => {
    const past = "2020-01-01";
    expect(deriveStatus(1000, 500, past)).toBe("Kısmi Ödendi");
  });
});

describe("Card finance — is_overdue", () => {
  it("true when unpaid and past", () => {
    expect(isOverdue(1000, 0, "2020-01-01")).toBe(true);
  });

  it("true when partially paid and past (partial overdue is NOT a status change)", () => {
    expect(isOverdue(1000, 500, "2020-01-01")).toBe(true);
  });

  it("false when fully paid and past", () => {
    expect(isOverdue(1000, 1000, "2020-01-01")).toBe(false);
  });

  it("false when unpaid but future", () => {
    expect(isOverdue(1000, 0, "2099-12-31")).toBe(false);
  });

  it("false when partially paid but future", () => {
    expect(isOverdue(1000, 500, "2099-12-31")).toBe(false);
  });
});

describe("Card finance — TRY conversion", () => {
  it("TRY stays at 1:1", () => {
    expect(toTRY(5000, 1.0)).toBe(5000);
  });

  it("USD conversion at given rate", () => {
    expect(toTRY(100, 32.5)).toBeCloseTo(3250);
  });

  it("Gold gram conversion", () => {
    expect(toTRY(10, 2750)).toBeCloseTo(27500);
  });
});

describe("Card finance — profit calculation", () => {
  it("planned profit = income planned - expense planned (TRY)", () => {
    const income: CustomerFinancialEntry[] = [
      { id: "c1", project_id: "p1", customer_id: "cu1", entry_date: "2026-01-01", title: "T", amount: 100000, paid_amount: 0, currency: "TRY", amount_try: 100000, paid_amount_try: 0, remaining_amount_try: 100000, exchange_rate_to_try: 1, is_exchange_rate_manual: 0, is_overdue: 0, status: "Planlanan", account_type: "resmi", payment_method: "Nakit", created_at: "", updated_at: "" },
    ];
    const expenses: EmployeeFinancialEntry[] = [
      { id: "e1", project_id: "p1", employee_id: "em1", entry_date: "2026-01-01", title: "T", amount: 40000, paid_amount: 0, currency: "TRY", amount_try: 40000, paid_amount_try: 0, remaining_amount_try: 40000, exchange_rate_to_try: 1, is_exchange_rate_manual: 0, is_overdue: 0, status: "Planlanan", account_type: "resmi", payment_method: "Nakit", created_at: "", updated_at: "" },
    ];
    expect(computePlannedProfit(income, expenses)).toBe(60000);
  });

  it("realized profit = income paid - expense paid (TRY)", () => {
    const income = [{ paid_amount_try: 50000 }];
    const expenses = [{ paid_amount_try: 20000 }, { paid_amount_try: 10000 }];
    expect(computeRealizedProfit(income, expenses)).toBe(20000);
  });

  it("negative realized profit when costs exceed income", () => {
    const income = [{ paid_amount_try: 10000 }];
    const expenses = [{ paid_amount_try: 15000 }];
    expect(computeRealizedProfit(income, expenses)).toBe(-5000);
  });
});

describe("Card finance — UNION ALL project statement row shape", () => {
  const base: CardFinancialEntry = {
    id: "x", project_id: "p1", entry_date: "2026-01-01", title: "T",
    amount: 1000, paid_amount: 400, currency: "USD",
    amount_try: 32000, paid_amount_try: 12800, remaining_amount_try: 19200,
    exchange_rate_to_try: 32, is_exchange_rate_manual: 0, is_overdue: 0,
    status: "Kısmi Ödendi", account_type: "resmi", payment_method: "Nakit",
    created_at: "", updated_at: "",
  };

  it("income row has positive sign and signed amounts", () => {
    const row = makeProjectStatementRow(base, "income");
    expect(row.direction).toBe("income");
    expect(row.sign).toBe(1);
    expect(row.signed_amount_try).toBe(32000);
    expect(row.signed_paid_amount_try).toBe(12800);
  });

  it("expense row has negative sign and negative signed amounts", () => {
    const row = makeProjectStatementRow(base, "expense");
    expect(row.direction).toBe("expense");
    expect(row.sign).toBe(-1);
    expect(row.signed_amount_try).toBe(-32000);
    expect(row.signed_paid_amount_try).toBe(-12800);
  });

  it("remaining amounts are computed correctly", () => {
    const row = makeProjectStatementRow(base, "income");
    expect(row.remaining_amount).toBe(600);
    expect(row.remaining_amount_try).toBe(19200);
  });
});

describe("Card finance — Gidenler entry shape", () => {
  it("GidenlerEntry has required fields", () => {
    const entry: GidenlerEntry = {
      id: "g1", project_id: "p1", entry_date: "2026-01-01", title: "İşçilik",
      amount: 5000, paid_amount: 5000, currency: "TRY",
      amount_try: 5000, paid_amount_try: 5000, remaining_amount_try: 0,
      exchange_rate_to_try: 1, is_exchange_rate_manual: 0, is_overdue: 0,
      status: "Gerçekleşti", account_type: "gayri_resmi", payment_method: "Nakit",
      created_at: "", updated_at: "",
      owner_id: "em1", owner_name: "Ahmet Yılmaz",
      source_type: "employee", source_label: "Ahmet Yılmaz", project_title: "Villa A",
    };
    expect(entry.source_type).toBe("employee");
    expect(entry.owner_name).toBe("Ahmet Yılmaz");
    expect(entry.signed_amount_try).toBeUndefined();
  });
});

// Mirrors fe_should_preserve_snapshot() logic from finance-entry-helpers.php
function shouldPreserveSnapshot(
  input: { currency: string; exchange_rate_to_try: number },
  existing: { currency: string; exchange_rate_to_try: number; exchange_rate_snapshot_at: string | null },
): string | null {
  if (
    input.currency === existing.currency &&
    Math.abs(input.exchange_rate_to_try - existing.exchange_rate_to_try) < 0.000001
  ) {
    return existing.exchange_rate_snapshot_at;
  }
  return null;
}

describe("Card finance — FX snapshot preservation on PATCH", () => {
  const existing = { currency: "USD", exchange_rate_to_try: 32.5, exchange_rate_snapshot_at: "2026-01-15 10:00:00" };

  it("preserves snapshot when currency and rate are unchanged", () => {
    expect(shouldPreserveSnapshot({ currency: "USD", exchange_rate_to_try: 32.5 }, existing))
      .toBe("2026-01-15 10:00:00");
  });

  it("refreshes snapshot when currency changes", () => {
    expect(shouldPreserveSnapshot({ currency: "EUR", exchange_rate_to_try: 32.5 }, existing)).toBeNull();
  });

  it("refreshes snapshot when rate changes", () => {
    expect(shouldPreserveSnapshot({ currency: "USD", exchange_rate_to_try: 33.0 }, existing)).toBeNull();
  });

  it("preserves null snapshot_at when existing entry has no snapshot (TRY entries)", () => {
    const tryEntry = { currency: "TRY", exchange_rate_to_try: 1, exchange_rate_snapshot_at: null };
    expect(shouldPreserveSnapshot({ currency: "TRY", exchange_rate_to_try: 1 }, tryEntry)).toBeNull();
  });
});

describe("Card finance — supplier entry type check", () => {
  it("SupplierFinancialEntry has supplier_id field", () => {
    const entry: SupplierFinancialEntry = {
      id: "s1", project_id: "p1", entry_date: "2026-01-01", title: "Malzeme",
      amount: 20000, paid_amount: 10000, currency: "TRY",
      amount_try: 20000, paid_amount_try: 10000, remaining_amount_try: 10000,
      exchange_rate_to_try: 1, is_exchange_rate_manual: 0, is_overdue: 0,
      status: "Kısmi Ödendi", account_type: "resmi", payment_method: "Banka Havalesi/EFT",
      created_at: "", updated_at: "", supplier_id: "sup1",
    };
    expect(entry.supplier_id).toBe("sup1");
    expect(entry.source_type).toBe(undefined);
  });
});
