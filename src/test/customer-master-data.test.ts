import { describe, expect, it } from "vitest";
import {
  formatTurkishPhone,
  isValidEmail,
  isValidCustomerTaxOrIdentityNumber,
  isValidTaxOrIdentityNumber,
  normalizeCustomerContactPayload,
  normalizeCustomerNames,
  normalizeTurkishPhone,
  normalizeWhatsApp,
} from "@/lib/customerMasterData";
import { whatsappLink } from "@/lib/finance";

describe("customer master data normalization", () => {
  it("normalizes supported Turkish phone input", () => {
    expect(normalizeTurkishPhone("+90 (532) 123-45-67")).toBe("05321234567");
    expect(normalizeTurkishPhone("532 123 45 67")).toBe("05321234567");
    expect(normalizeTurkishPhone("05321234567")).toBe("05321234567");
    expect(normalizeTurkishPhone("2121234567")).toBeNull();
  });

  it("normalizes WhatsApp for deeplinks and formats display values", () => {
    expect(normalizeWhatsApp("+90 (538) 722-03-72")).toBe("905387220372");
    expect(normalizeWhatsApp("05387220372")).toBe("905387220372");
    expect(normalizeWhatsApp("5387220372")).toBe("905387220372");
    expect(normalizeWhatsApp("0(532) 123 45 67")).toBe("905321234567");
    expect(formatTurkishPhone("905321234567")).toBe("0(532) 123 45 67");
    expect(normalizeWhatsApp("")).toBe("");
    expect(whatsappLink("05387220372", "Merhaba")).toBe("https://wa.me/905387220372?text=Merhaba");
  });

  it("clears the irrelevant customer name field", () => {
    expect(normalizeCustomerNames("Bireysel", " Mustafa Bediz ", "Eclipse Mühendislik")).toEqual({
      full_name: "Mustafa Bediz",
      company_name: "",
    });
    expect(normalizeCustomerNames("Kurumsal", "Mustafa Bediz", " Eclipse Mühendislik ")).toEqual({
      full_name: "",
      company_name: "Eclipse Mühendislik",
    });
  });

  it("builds the normalized storage payload consistently", () => {
    expect(normalizeCustomerContactPayload("Bireysel", {
      full_name: "Mustafa Bediz",
      company_name: "Eclipse Mühendislik",
      phone: "+90 (538) 722-03-72",
      whatsapp: "05387220372",
    })).toEqual({
      customer_type: "Bireysel",
      full_name: "Mustafa Bediz",
      company_name: "",
      phone: "05387220372",
      whatsapp: "905387220372",
    });
  });

  it("validates optional email and tax identity values", () => {
    expect(isValidEmail("musteri@example.com")).toBe(true);
    expect(isValidEmail("musteri@")).toBe(false);
    expect(isValidTaxOrIdentityNumber("1234567890")).toBe(true);
    expect(isValidTaxOrIdentityNumber("12345678901")).toBe(true);
    expect(isValidTaxOrIdentityNumber("123-4567890")).toBe(false);
    expect(isValidCustomerTaxOrIdentityNumber("Bireysel", "12345678901")).toBe(true);
    expect(isValidCustomerTaxOrIdentityNumber("Bireysel", "1234567890")).toBe(false);
    expect(isValidCustomerTaxOrIdentityNumber("Kurumsal", "1234567890")).toBe(true);
    expect(isValidCustomerTaxOrIdentityNumber("Kurumsal", "12345678901")).toBe(true);
  });
});
