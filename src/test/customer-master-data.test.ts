import { describe, expect, it } from "vitest";
import {
  formatTurkishPhone,
  isValidEmail,
  isValidTaxOrIdentityNumber,
  normalizeTurkishPhone,
  normalizeWhatsApp,
} from "@/lib/customerMasterData";

describe("customer master data normalization", () => {
  it("normalizes supported Turkish phone input", () => {
    expect(normalizeTurkishPhone("+90 (532) 123-45-67")).toBe("05321234567");
    expect(normalizeTurkishPhone("532 123 45 67")).toBe("05321234567");
    expect(normalizeTurkishPhone("05321234567")).toBe("05321234567");
    expect(normalizeTurkishPhone("2121234567")).toBeNull();
  });

  it("normalizes WhatsApp for deeplinks and formats display values", () => {
    expect(normalizeWhatsApp("0(532) 123 45 67")).toBe("905321234567");
    expect(formatTurkishPhone("905321234567")).toBe("0(532) 123 45 67");
    expect(normalizeWhatsApp("")).toBe("");
  });

  it("validates optional email and tax identity values", () => {
    expect(isValidEmail("musteri@example.com")).toBe(true);
    expect(isValidEmail("musteri@")).toBe(false);
    expect(isValidTaxOrIdentityNumber("1234567890")).toBe(true);
    expect(isValidTaxOrIdentityNumber("12345678901")).toBe(true);
    expect(isValidTaxOrIdentityNumber("123-4567890")).toBe(false);
  });
});
