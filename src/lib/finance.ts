export const CUSTOMER_TYPES = ["Bireysel", "Firma", "Arsa Sahibi", "Daire Sahibi", "Yatırımcı", "Diğer"] as const;
export const CUSTOMER_STATUSES = ["Aktif", "Beklemede", "Tamamlandı", "Pasif"] as const;
export const PAYMENT_PLAN_STATUSES = ["Bekliyor", "Kısmi Ödendi", "Ödendi", "Gecikti", "İptal"] as const;
export const PAYMENT_METHODS = ["Nakit", "Havale / EFT", "Kredi Kartı", "Çek", "Senet", "Diğer"] as const;
export const CURRENCIES = ["TRY", "USD", "EUR"] as const;
export const GROUP_TAGS = ["Resmi", "Gayri Resmi"] as const;
export const ENTRY_DIRECTIONS = ["Gelir", "Gider"] as const;
export const ENTRY_STATUSES = ["Planlandı", "Gerçekleşti", "İptal"] as const;
export const CARD_TYPES = ["customer", "employee", "expense"] as const;
export const EXPENSE_CATEGORIES = [
  "Malzeme", "İşçilik", "Ruhsat / Resmi İşlemler", "Mimari / Proje",
  "Taşeron", "Nakliye", "Şantiye Gideri", "Ofis Gideri", "Diğer",
] as const;
export const DOCUMENT_TYPES = ["Sözleşme", "Dekont", "Fatura", "Makbuz", "Ruhsat", "Tapu", "Kimlik", "Diğer"] as const;

export type CurrencyTag = typeof CURRENCIES[number];
export type GroupTag = typeof GROUP_TAGS[number];
export type EntryDirection = typeof ENTRY_DIRECTIONS[number];
export type EntryStatus = typeof ENTRY_STATUSES[number];
export type CardType = typeof CARD_TYPES[number];

export type LegacyPaymentLike = {
  amount?: number | string | null;
  payment_plan_id?: string | null;
};

export type PaymentPlanLike = {
  id?: string | null;
  amount?: number | string | null;
  due_date?: string | null;
  status?: string | null;
};

export type FinancialEntryLike = {
  amount?: number | string | null;
  entry_date?: string | null;
  direction?: string | null;
  status?: string | null;
  currency_tag?: string | null;
  project_id?: string | null;
};

export const FINANCE_COLORS = {
  received: "hsl(145, 55%, 25%)",
  receivable: "hsl(142, 48%, 50%)",
  expense: "hsl(220, 9%, 35%)",
  overdue: "hsl(0, 72%, 51%)",
  partial: "hsl(38, 92%, 50%)",
  pending: "hsl(220, 9%, 55%)",
  paid: "hsl(145, 55%, 25%)",
};

export function safeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sumBy<T>(items: T[], pick: (item: T) => number | string | null | undefined): number {
  return items.reduce((sum, item) => sum + safeNumber(pick(item)), 0);
}

export function formatTRY(n: number | string | null | undefined): string {
  const v = safeNumber(n);
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(v);
}

export function formatMoney(amount: number | string | null | undefined, currency: CurrencyTag = "TRY"): string {
  const value = safeNumber(amount);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR");
}

export function customerDisplayName(c: { customer_type?: string; full_name?: string | null; company_name?: string | null }): string {
  if (c.customer_type === "Firma" && c.company_name) return c.company_name;
  return c.full_name || c.company_name || "İsimsiz";
}

export function daysUntil(date: string): number {
  if (!date) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "Ödendi": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Bekliyor": return "bg-slate-100 text-slate-700 border-slate-200";
    case "Kısmi Ödendi": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Gecikti": return "bg-red-100 text-red-700 border-red-200";
    case "İptal": return "bg-zinc-100 text-zinc-500 border-zinc-200";
    case "Aktif": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Beklemede": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Tamamlandı": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Pasif": return "bg-zinc-100 text-zinc-600 border-zinc-200";
    default: return "bg-muted text-foreground border-border";
  }
}

export function exportCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function whatsappLink(phone: string, message: string): string {
  const clean = (phone || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

export function paymentPlanRemaining(plan: { amount: number | string }, paymentsForPlan: { amount: number | string }[]): number {
  const total = sumBy(paymentsForPlan, (payment) => payment.amount);
  return Math.max(0, safeNumber(plan.amount) - total);
}

export function paidForPlan(planId: string | null | undefined, payments: LegacyPaymentLike[]): number {
  if (!planId) return 0;
  return sumBy(payments.filter((payment) => payment.payment_plan_id === planId), (payment) => payment.amount);
}

export function paymentPlanRemainingFromPayments(plan: PaymentPlanLike, payments: LegacyPaymentLike[]): number {
  return Math.max(0, safeNumber(plan.amount) - paidForPlan(plan.id, payments));
}

export function isCanceledStatus(status: string | null | undefined): boolean {
  return status === "İptal";
}

export function isPaidStatus(status: string | null | undefined): boolean {
  return status === "Ödendi";
}

export function isRealizedStatus(status: string | null | undefined): boolean {
  return status === "Gerçekleşti";
}

export function isPlannedStatus(status: string | null | undefined): boolean {
  return status === "Planlandı";
}

export function realizedFinancialIncome(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return sumBy(
    entries.filter((entry) => entry.currency_tag === currency && isRealizedStatus(entry.status) && entry.direction === "Gelir"),
    (entry) => entry.amount,
  );
}

export function realizedFinancialExpense(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return sumBy(
    entries.filter((entry) => entry.currency_tag === currency && isRealizedStatus(entry.status) && entry.direction === "Gider"),
    (entry) => entry.amount,
  );
}

export function plannedFinancialIncome(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return sumBy(
    entries.filter((entry) => entry.currency_tag === currency && isPlannedStatus(entry.status) && entry.direction === "Gelir"),
    (entry) => entry.amount,
  );
}

export function derivePlanStatus(plan: { amount: number | string; due_date: string; status: string }, paid: number): string {
  if (plan.status === "İptal") return "İptal";
  if (paid <= 0) {
    if (daysUntil(plan.due_date) < 0) return "Gecikti";
    return "Bekliyor";
  }
  if (paid >= safeNumber(plan.amount)) return "Ödendi";
  return "Kısmi Ödendi";
}
