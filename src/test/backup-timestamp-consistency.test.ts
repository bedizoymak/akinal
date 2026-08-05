import { describe, expect, it } from "vitest";
import { formatDate } from "@/pages/admin/AdminBackupCenter";

// P2-4 regression: after the fix, every backup timestamp for a single run —
// the ledger's started_at, the UTC package name (Z-suffixed), and the audit
// log's created_at — is written in true UTC as a naive "Y-m-d H:i:s" string
// (or an explicit Z string for the package name). formatDate() must treat
// all three identically and produce the exact same Europe/Istanbul display
// for the same underlying instant.

describe("P2-4 backup timestamp consistency", () => {
  it("formats a naive UTC DATETIME string (started_at / audit created_at) and an explicit Z string identically for the same instant", () => {
    const naiveUtc = "2026-08-04 23:05:43"; // as written by gmdate('Y-m-d H:i:s')
    const explicitZ = "2026-08-04T23:05:43Z"; // as embedded in the package name

    expect(formatDate(naiveUtc)).toBe(formatDate(explicitZ));
  });

  it("converts to the correct Europe/Istanbul wall-clock time (+3h, no double conversion)", () => {
    // 23:05 UTC on 2026-08-04 is 02:05 on 2026-08-05 in Türkiye (UTC+3).
    const result = formatDate("2026-08-04 23:05:43");
    expect(result).toContain("05.08.2026");
    expect(result).toContain("02:05");
  });

  it("history (started_at), latest-backup card (created_at), and audit log (created_at) all agree for the same run once all three are true UTC", () => {
    const startedAt = "2026-08-04 23:05:43";
    const packageCreatedAt = "2026-08-04T23:05:43Z";
    const auditCreatedAt = "2026-08-04 23:05:43"; // written via gmdate() after the P2-4 fix, not MySQL CURRENT_TIMESTAMP

    const historyDisplay = formatDate(startedAt);
    const cardDisplay = formatDate(packageCreatedAt);
    const auditDisplay = formatDate(auditCreatedAt);

    expect(historyDisplay).toBe(cardDisplay);
    expect(cardDisplay).toBe(auditDisplay);
  });

  it("handles a day-boundary UTC->Istanbul conversion correctly", () => {
    // 22:30 UTC on 2026-08-04 -> 01:30 on 2026-08-05 in Türkiye.
    const result = formatDate("2026-08-04 22:30:00");
    expect(result).toContain("05.08.2026");
    expect(result).toContain("01:30");
  });
});
