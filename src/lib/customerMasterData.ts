export type CustomerType = "Bireysel" | "Kurumsal";

export const CUSTOMER_MASTER_TYPES: CustomerType[] = ["Bireysel", "Kurumsal"];

export function normalizeCustomerType(value: string | null | undefined): CustomerType {
  return value === "Kurumsal" || value === "Firma" ? "Kurumsal" : "Bireysel";
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
