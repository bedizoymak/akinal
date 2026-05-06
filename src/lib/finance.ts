export const CUSTOMER_TYPES = ["Bireysel", "Firma", "Arsa Sahibi", "Daire Sahibi", "Yatırımcı", "Diğer"] as const;
export const CUSTOMER_STATUSES = ["Aktif", "Beklemede", "Tamamlandı", "Pasif"] as const;
export const PAYMENT_PLAN_STATUSES = ["Bekliyor", "Kısmi Ödendi", "Ödendi", "Gecikti", "İptal"] as const;
export const PAYMENT_METHODS = ["Nakit", "Havale / EFT", "Kredi Kartı", "Çek", "Senet", "Diğer"] as const;
export const EXPENSE_CATEGORIES = [
  "Malzeme", "İşçilik", "Ruhsat / Resmi İşlemler", "Mimari / Proje",
  "Taşeron", "Nakliye", "Şantiye Gideri", "Ofis Gideri", "Diğer",
] as const;
export const DOCUMENT_TYPES = ["Sözleşme", "Dekont", "Fatura", "Makbuz", "Ruhsat", "Tapu", "Kimlik", "Diğer"] as const;

export const FINANCE_COLORS = {
  received: "hsl(145, 55%, 25%)",
  receivable: "hsl(142, 48%, 50%)",
  expense: "hsl(220, 9%, 35%)",
  overdue: "hsl(0, 72%, 51%)",
  partial: "hsl(38, 92%, 50%)",
  pending: "hsl(220, 9%, 55%)",
  paid: "hsl(145, 55%, 25%)",
};

export function formatTRY(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(v);
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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
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
  const total = paymentsForPlan.reduce((s, p) => s + Number(p.amount), 0);
  return Math.max(0, Number(plan.amount) - total);
}

export function derivePlanStatus(plan: { amount: number | string; due_date: string; status: string }, paid: number): string {
  if (plan.status === "İptal") return "İptal";
  if (paid <= 0) {
    if (daysUntil(plan.due_date) < 0) return "Gecikti";
    return "Bekliyor";
  }
  if (paid >= Number(plan.amount)) return "Ödendi";
  return "Kısmi Ödendi";
}
