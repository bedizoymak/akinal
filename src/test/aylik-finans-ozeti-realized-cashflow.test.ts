import { describe, it, expect } from "vitest";

// Mirrors the "Aylık Finans Özeti" data pipeline on the Genel Bakış dashboard:
//  - dashboard.php fetch_monthly_financials(): SUM(paid_amount_try) grouped by
//    DATE_FORMAT(entry_date, '%Y-%m') across the four canonical financial-entry tables
//    (customer/employee/supplier/expense-card). entry_date is the only date column those
//    tables have — no separate paid/collection-date field exists — so it is the canonical
//    realized date, same basis as the Toplam Tahsilat/Toplam Gider/Net Durum cards.
//  - AdminDashboard.tsx's monthlyFinancials: aligns that aggregate to the last 6 calendar
//    months (oldest → newest), zero-filling any month with no realized activity, and carries
//    both a short axis label and a full Turkish tooltip label per month.

interface Entry {
  entry_date: string;
  paid_amount_try: number;
  direction: "income" | "expense";
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabelOf(date: Date): string {
  return date.toLocaleDateString("tr-TR", { month: "short" }).replace(".", "");
}
function monthLabelFullOf(date: Date): string {
  return date.toLocaleDateString("tr-TR", { month: "long" });
}
function lastSixMonths(referenceDate: Date) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 5 + index, 1);
    return { key: monthKeyOf(date), month: monthLabelOf(date), monthFull: monthLabelFullOf(date) };
  });
}

function aggregateMonthlyRealized(entries: Entry[]): Map<string, { income: number; expense: number }> {
  const map = new Map<string, { income: number; expense: number }>();
  for (const e of entries) {
    const key = e.entry_date.slice(0, 7); // YYYY-MM, mirrors DATE_FORMAT(entry_date,'%Y-%m')
    const bucket = map.get(key) || { income: 0, expense: 0 };
    if (e.direction === "income") bucket.income += e.paid_amount_try;
    else bucket.expense += e.paid_amount_try;
    map.set(key, bucket);
  }
  return map;
}

function buildMonthlyFinancials(entries: Entry[], referenceDate: Date) {
  const months = lastSixMonths(referenceDate);
  const byKey = aggregateMonthlyRealized(entries);
  return months.map((m) => {
    const bucket = byKey.get(m.key) || { income: 0, expense: 0 };
    return { month: m.month, monthFull: m.monthFull, income: bucket.income, expenses: bucket.expense, net: bucket.income - bucket.expense };
  });
}

const REFERENCE_DATE = new Date(2026, 5, 15); // 15 June 2026 → window is Jan..Jun 2026

describe("Aylık Finans Özeti — realized monthly cash flow", () => {
  it("1. A realized collection is grouped into its actual collection month (entry_date)", () => {
    const series = buildMonthlyFinancials(
      [{ entry_date: "2026-03-15", paid_amount_try: 5000, direction: "income" }],
      REFERENCE_DATE,
    );
    const march = series.find((m) => m.monthFull === monthLabelFullOf(new Date(2026, 2, 1)));
    expect(march?.income).toBe(5000);
    expect(series.filter((m) => m.income > 0)).toHaveLength(1);
  });

  it("2. A realized expense is grouped into its actual payment month (entry_date)", () => {
    const series = buildMonthlyFinancials(
      [{ entry_date: "2026-04-02", paid_amount_try: 3000, direction: "expense" }],
      REFERENCE_DATE,
    );
    const april = series.find((m) => m.monthFull === monthLabelFullOf(new Date(2026, 3, 1)));
    expect(april?.expenses).toBe(3000);
    expect(series.filter((m) => m.expenses > 0)).toHaveLength(1);
  });

  it("3. Open/planned/overdue-but-uncollected records are excluded (paid_amount_try = 0 contributes nothing)", () => {
    const series = buildMonthlyFinancials(
      [
        // Planned, future, unpaid — the invoice/amount_try may be large, but paid_amount_try is 0.
        { entry_date: "2026-06-20", paid_amount_try: 0, direction: "income" },
        // Overdue, still uncollected — 0 realized regardless of the open remaining balance.
        { entry_date: "2026-02-01", paid_amount_try: 0, direction: "income" },
      ],
      REFERENCE_DATE,
    );
    expect(series.every((m) => m.income === 0)).toBe(true);
    expect(series.every((m) => m.expenses === 0)).toBe(true);
    expect(series.every((m) => m.net === 0)).toBe(true);
  });

  it("4. Monthly net equals collected minus paid, including negative net", () => {
    const series = buildMonthlyFinancials(
      [
        { entry_date: "2026-05-05", paid_amount_try: 4000, direction: "income" },
        { entry_date: "2026-05-18", paid_amount_try: 9500, direction: "expense" },
      ],
      REFERENCE_DATE,
    );
    const may = series.find((m) => m.monthFull === monthLabelFullOf(new Date(2026, 4, 1)));
    expect(may?.income).toBe(4000);
    expect(may?.expenses).toBe(9500);
    expect(may?.net).toBe(-5500);
  });

  it("5. All six months appear, including zero-value months, oldest to newest", () => {
    const series = buildMonthlyFinancials(
      [{ entry_date: "2026-06-01", paid_amount_try: 1000, direction: "income" }],
      REFERENCE_DATE,
    );
    expect(series).toHaveLength(6);
    const expectedLabels = [1, 2, 3, 4, 5, 6].map((m) => monthLabelOf(new Date(2026, m - 1, 1)));
    expect(series.map((m) => m.month)).toEqual(expectedLabels);
    expect(series.slice(0, 5).every((m) => m.income === 0 && m.expenses === 0 && m.net === 0)).toBe(true);
    expect(series[5].income).toBe(1000);
  });

  it("6. Tooltip month labels are fully spelled-out Turkish month names, not English", () => {
    const series = buildMonthlyFinancials([], REFERENCE_DATE);
    const mayEntry = series.find((m) => m.month === monthLabelOf(new Date(2026, 4, 1)));
    expect(mayEntry?.monthFull).toBe("Mayıs");
    expect(mayEntry?.monthFull).not.toBe("May");
    // Every month in the window should be a real Turkish name distinct from its English one.
    const juneEntry = series[5];
    expect(juneEntry.monthFull).toBe("Haziran");
    expect(juneEntry.monthFull).not.toBe("June");
  });
});
