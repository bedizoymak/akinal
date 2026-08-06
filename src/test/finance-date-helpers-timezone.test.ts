import { afterEach, describe, expect, it, vi } from "vitest";
import { daysUntil, derivePlanStatus, todayIsoLocal } from "@/lib/finance";

// AKINAL-QA-C-001 timezone day-shift regression: `new Date().toISOString().slice(0, 10)`
// reads the UTC calendar day, which lags the Europe/Istanbul (UTC+3) local calendar day
// by one during the 00:00-03:00 local window (e.g. 01:00 local Aug 6 is still 22:00 UTC
// Aug 5). Any "today" computed that way — used as the default date for a brand-new
// income/expense/collection entry, or as the comparison baseline for Gecikmiş/Planlanan
// classification — would silently land one day in the past during that window.
// todayIsoLocal()/daysUntil() must use the browser's local calendar day instead.

const ORIGINAL_TZ = process.env.TZ;

function restoreTz() {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
}

describe("todayIsoLocal / daysUntil timezone day-shift prevention", () => {
  afterEach(() => {
    vi.useRealTimers();
    restoreTz();
  });

  it("todayIsoLocal returns the Europe/Istanbul local calendar day, not the lagging UTC day, just after local midnight", () => {
    process.env.TZ = "Europe/Istanbul"; // UTC+3, no DST since 2016
    vi.useFakeTimers();
    // 2026-08-05T22:00:00Z is 01:00 local time on 2026-08-06 in Istanbul.
    vi.setSystemTime(new Date("2026-08-05T22:00:00Z"));

    expect(todayIsoLocal()).toBe("2026-08-06");
  });

  it("daysUntil treats a same-local-day due date as 0, not -1, just after local midnight", () => {
    process.env.TZ = "Europe/Istanbul";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T22:00:00Z")); // 01:00 local Aug 6

    expect(daysUntil("2026-08-06")).toBe(0);
  });

  it("daysUntil correctly classifies a date exactly one local day in the past just after local midnight", () => {
    process.env.TZ = "Europe/Istanbul";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T22:00:00Z")); // 01:00 local Aug 6

    expect(daysUntil("2026-08-05")).toBe(-1);
  });

  it("daysUntil correctly classifies a future date just after local midnight", () => {
    process.env.TZ = "Europe/Istanbul";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T22:00:00Z")); // 01:00 local Aug 6

    expect(daysUntil("2026-08-07")).toBe(1);
  });

  it("todayIsoLocal and daysUntil agree with the UTC calendar day in a UTC-hosted environment (e.g. CI)", () => {
    process.env.TZ = "UTC";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T01:00:00Z"));

    expect(todayIsoLocal()).toBe("2026-08-06");
    expect(daysUntil("2026-08-06")).toBe(0);
    expect(daysUntil("2026-08-05")).toBe(-1);
    expect(daysUntil("2026-08-07")).toBe(1);
  });
});

describe("AKINAL-QA-C-001 past/future status classification", () => {
  afterEach(() => {
    vi.useRealTimers();
    restoreTz();
  });

  it("classifies a past-due unpaid plan as Vadesi Geçti", () => {
    process.env.TZ = "Europe/Istanbul";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T09:00:00Z")); // midday local

    const status = derivePlanStatus({ amount: 1000, due_date: "2026-07-15", status: "Bekliyor" }, 0);
    expect(status).toBe("Vadesi Geçti");
  });

  it("classifies a future-dated unpaid plan as Bekliyor (Planlanan)", () => {
    process.env.TZ = "Europe/Istanbul";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T09:00:00Z"));

    const status = derivePlanStatus({ amount: 1000, due_date: "2026-09-15", status: "Bekliyor" }, 0);
    expect(status).toBe("Bekliyor");
  });

  it("classifies a fully paid plan as Ödendi regardless of due date", () => {
    process.env.TZ = "Europe/Istanbul";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T09:00:00Z"));

    const status = derivePlanStatus({ amount: 1000, due_date: "2026-07-15", status: "Ödendi" }, 1000);
    expect(status).toBe("Ödendi");
  });
});
