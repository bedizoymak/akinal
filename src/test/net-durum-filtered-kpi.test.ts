import { describe, expect, it } from "vitest";
import { computeNetDurumTotals } from "@/pages/admin/AdminNetDurum";

// QA-B OBS-01 regression: Net Durum's "Toplam Gelir / Toplam Gider / Net Bakiye" KPI cards were
// always computed from the full unfiltered movement list even while the table below was
// correctly narrowed by search/filters — e.g. searching "QA DEMO" listed only the seven matching
// demo movements but the KPI cards kept showing the global totals. computeNetDurumTotals() must
// be a pure function of whatever row list it's given, so the fix is wiring it to the filtered
// list (AdminNetDurum.tsx) rather than the raw merged movement list — this test locks the
// calculation itself, mirroring the equivalent GPP fix in government-progress-filtered-kpi.test.ts.

describe("QA-B OBS-01 Net Durum filtered KPI", () => {
  const income1 = { direction: "gelir" as const, amount_try: 250000 };
  const income2 = { direction: "gelir" as const, amount_try: 220000 };
  const expense1 = { direction: "gider" as const, amount_try: 200000 };
  const expense2 = { direction: "gider" as const, amount_try: 120000 };
  const allRows = [income1, income2, expense1, expense2];

  it("computes global totals from the full row list", () => {
    const totals = computeNetDurumTotals(allRows);
    expect(totals.income).toBe(470000);
    expect(totals.expense).toBe(320000);
    expect(totals.net).toBe(150000);
  });

  it("computes scoped totals when given only a filtered subset", () => {
    const totals = computeNetDurumTotals([income1, expense1]);
    expect(totals.income).toBe(250000);
    expect(totals.expense).toBe(200000);
    expect(totals.net).toBe(50000);
  });

  it("returns zeroed totals for an empty (no-match search) subset", () => {
    const totals = computeNetDurumTotals([]);
    expect(totals).toEqual({ income: 0, expense: 0, net: 0 });
  });
});
