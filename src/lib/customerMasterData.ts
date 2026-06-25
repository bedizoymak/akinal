export type CustomerType = "Bireysel" | "Kurumsal";

export const CUSTOMER_MASTER_TYPES: CustomerType[] = ["Bireysel", "Kurumsal"];

export function normalizeCustomerType(value: string | null | undefined): CustomerType {
  return value === "Kurumsal" || value === "Firma" ? "Kurumsal" : "Bireysel";
}

export function normalizeCustomerNames(
  customerType: CustomerType,
  fullName: string | null | undefined,
  companyName: string | null | undefined,
): { full_name: string; company_name: string } {
  return customerType === "Kurumsal"
    ? { full_name: "", company_name: (companyName || "").trim() }
    : { full_name: (fullName || "").trim(), company_name: "" };
}

export function normalizeTurkishPhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("5")) digits = `0${digits}`;
  return /^05\d{9}$/.test(digits) ? digits : null;
}

export function normalizeWhatsApp(value: string): string | null {
  if (!value.trim()) return "";
  const phone = normalizeTurkishPhone(value);
  return phone ? `90${phone.slice(1)}` : null;
}

export function normalizeCustomerContactPayload(
  customerTypeValue: string | null | undefined,
  values: {
    full_name?: string | null;
    company_name?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
  },
) {
  const customer_type = normalizeCustomerType(customerTypeValue);
  return {
    customer_type,
    ...normalizeCustomerNames(customer_type, values.full_name, values.company_name),
    phone: normalizeTurkishPhone(values.phone || ""),
    whatsapp: normalizeWhatsApp(values.whatsapp || ""),
  };
}

export function formatTurkishPhone(value: string | null | undefined): string {
  if (!value) return "";
  const normalized = normalizeTurkishPhone(value);
  if (!normalized) return value;
  return `${normalized.slice(0, 1)}(${normalized.slice(1, 4)}) ${normalized.slice(4, 7)} ${normalized.slice(7, 9)} ${normalized.slice(9, 11)}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidTaxOrIdentityNumber(value: string): boolean {
  return /^\d{10,11}$/.test(value);
}

export function isValidCustomerTaxOrIdentityNumber(customerType: CustomerType, value: string): boolean {
  return customerType === "Kurumsal" ? /^\d{10,11}$/.test(value) : /^\d{11}$/.test(value);
}
