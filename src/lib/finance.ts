import {
  calculateCanonicalCardMetrics,
  deriveCanonicalReadPlanState,
  type CanonicalReadEntry,
  type CanonicalReadSettlement,
} from "@/lib/canonicalReadModel";

export const CUSTOMER_TYPES = ["Bireysel", "Firma", "Arsa Sahibi", "Daire Sahibi", "Yatırımcı", "Diğer"] as const;
export const CUSTOMER_STATUSES = ["Aktif", "Beklemede", "Tamamlandı", "Pasif"] as const;
export const PAYMENT_PLAN_STATUSES = ["Bekliyor", "Kısmi Ödendi", "Ödendi", "Vadesi Geçti", "İptal"] as const;
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

export const RAW_DISPLAY_LABELS: Record<string, string> = {
  corporate: "Kurumsal",
  individual: "Bireysel",
  active: "Aktif",
  inactive: "Pasif",
  completed: "Tamamlandı",
  ongoing: "Devam Ediyor",
  planned: "Planlandı",
  draft: "Taslak",
  published: "Yayında",
  archived: "Arşivlendi",
};

export type CurrencyTag = typeof CURRENCIES[number];
export type GroupTag = typeof GROUP_TAGS[number];
export type EntryDirection = typeof ENTRY_DIRECTIONS[number];
export type EntryStatus = typeof ENTRY_STATUSES[number];
export type CardType = typeof CARD_TYPES[number];

export type LegacyPaymentLike = {
  amount?: number | string | null;
  payment_plan_id?: string | null;
  customer_id?: string | null;
  account_type?: string | null;
};

export type PaymentPlanLike = {
  id?: string | null;
  amount?: number | string | null;
  paid_amount?: number | string | null;
  due_date?: string | null;
  status?: string | null;
  customer_id?: string | null;
  account_type?: string | null;
};

export type FinancialEntryLike = {
  amount?: number | string | null;
  entry_date?: string | null;
  direction?: string | null;
  status?: string | null;
  currency_tag?: string | null;
  group_tag?: string | null;
  project_id?: string | null;
};

export type LegacyExpenseLike = {
  amount?: number | string | null;
  expense_date?: string | null;
  project_id?: string | null;
  category?: string | null;
};

export type CanonicalPlanSummary = {
  planned: number;
  paid: number;
  remaining: number;
  overdue: number;
  activeCount: number;
};

export type CanonicalAmountSummary = {
  total: number;
  monthTotal: number;
  projectCount: number;
  categoryCount: number;
};

export type FinanceSummaryInput = {
  paymentPlans: PaymentPlanLike[];
  payments: LegacyPaymentLike[];
  expenses: LegacyExpenseLike[];
  financialEntries: FinancialEntryLike[];
  currency?: CurrencyTag;
  group?: GroupTag | "all";
  from?: string;
  to?: string;
};

export type FinanceSummary = {
  realizedIncome: number;
  plannedIncome: number;
  realizedExpense: number;
  plannedExpense: number;
  legacyIncome: number;
  legacyExpense: number;
  receivable: number;
  payable: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  overdueReceivable: number;
};

export type LedgerFinanceSummaryInput = {
  financialEntries: FinancialEntryLike[];
  currency?: CurrencyTag;
  group?: GroupTag | "all";
  from?: string;
  to?: string;
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

export function displayLabel(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return RAW_DISPLAY_LABELS[raw] ?? RAW_DISPLAY_LABELS[raw.toLowerCase()] ?? raw;
}

export function customerDisplayName(c: { customer_type?: string; full_name?: string | null; company_name?: string | null }): string {
  const type = displayLabel(c.customer_type);
  if ((type === "Firma" || type === "Kurumsal") && c.company_name) return c.company_name;
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
  switch (displayLabel(status)) {
    case "Ödendi": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Bekliyor": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Kısmi Ödendi": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Vadesi Geçti": return "bg-red-100 text-red-700 border-red-200";
    case "Gecikti": return "bg-red-100 text-red-700 border-red-200";
    case "İptal": return "bg-zinc-100 text-zinc-500 border-zinc-200";
    case "Aktif": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Beklemede": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Tamamlandı": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Pasif": return "bg-zinc-100 text-zinc-600 border-zinc-200";
    case "Devam Ediyor": return "bg-accent/15 text-accent border-accent/30";
    case "Planlandı": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Taslak": return "bg-muted text-muted-foreground border-border";
    case "Yayında": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Arşivlendi": return "bg-zinc-100 text-zinc-600 border-zinc-200";
    default: return "bg-muted text-foreground border-border";
  }
}

function datedDownloadName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  const date = new Date().toISOString().slice(0, 10);
  const safeBase = base.trim().replace(/\s+/g, "-").replace(/[\\/:*?"<>|]/g, "-");
  return `${safeBase}-${date}${ext}`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = datedDownloadName(filename);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printCurrentReport(title: string) {
  const previousTitle = document.title;
  document.title = datedDownloadName(`${title}.pdf`).replace(/\.pdf$/i, "");
  window.print();
  window.setTimeout(() => {
    document.title = previousTitle;
  }, 500);
}

export async function exportPDF(filename: string, title: string, dateRange: string, rows: Record<string, unknown>[], fallbackHeaders: string[] = []) {
  const [{ default: pdfMake }, vfsFonts] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const vfs = (vfsFonts as any).default?.pdfMake?.vfs
    ?? (vfsFonts as any).pdfMake?.vfs
    ?? (vfsFonts as any).default?.vfs
    ?? (vfsFonts as any).vfs;
  (pdfMake as any).vfs = vfs;

  const headers = rows.length ? Object.keys(rows[0]) : fallbackHeaders;
  const effectiveRows = rows.length ? rows : [{ Bilgi: "Dışa aktarılacak kayıt bulunmuyor." }];
  const effectiveHeaders = headers.length ? headers : Object.keys(effectiveRows[0]);
  const body = [
    effectiveHeaders.map((header) => ({ text: header, style: "tableHeader" })),
    ...effectiveRows.map((row) => effectiveHeaders.map((header) => String(row[header] ?? ""))),
  ];

  const documentDefinition = {
    pageSize: "A4",
    pageOrientation: effectiveHeaders.length > 5 ? "landscape" : "portrait",
    pageMargins: [24, 28, 24, 28],
    defaultStyle: {
      font: "Roboto",
      fontSize: 8,
    },
    styles: {
      title: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
      meta: { fontSize: 9, color: "#666666", margin: [0, 0, 0, 12] },
      tableHeader: { bold: true, color: "#111111", fillColor: "#eeeeee" },
    },
    content: [
      { text: "Akinal İnşaat", style: "meta" },
      { text: title, style: "title" },
      { text: `Tarih aralığı: ${dateRange}\nOluşturulma: ${formatDate(new Date())}`, style: "meta" },
      {
        table: {
          headerRows: 1,
          widths: effectiveHeaders.map(() => "auto"),
          body,
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? "#eeeeee" : null,
          hLineColor: () => "#dddddd",
          vLineColor: () => "#dddddd",
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
    ],
    footer: (currentPage: number, pageCount: number) => ({
      text: `Akinal İnşaat Yönetim Paneli - ${currentPage} / ${pageCount}`,
      alignment: "center",
      fontSize: 7,
      color: "#777777",
      margin: [0, 8, 0, 0],
    }),
  };

  (pdfMake as any).createPdf(documentDefinition).download(datedDownloadName(filename));
}

export function exportCSV(filename: string, rows: Record<string, unknown>[], fallbackHeaders: string[] = []) {
  const headers = rows.length ? Object.keys(rows[0]) : fallbackHeaders;
  if (!headers.length) {
    rows = [{ Bilgi: "Dışa aktarılacak kayıt bulunmuyor." }];
  }
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const effectiveHeaders = rows.length ? Object.keys(rows[0]) : headers;
  const csv = [effectiveHeaders.join(";"), ...rows.map((r) => effectiveHeaders.map((h) => escape(r[h])).join(";"))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(filename, blob);
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
  return Math.max(0, safeNumber(plan.amount) - effectivePaidForPlan(plan, payments));
}

export function effectivePaidForPlan(
  plan: PaymentPlanLike,
  payments: LegacyPaymentLike[],
  allocatedPaid = paidForPlan(plan.id, payments),
): number {
  const amount = safeNumber(plan.amount);
  const manualPaid = plan.status === "Ödendi"
    ? amount
    : plan.status === "Kısmi Ödendi"
      ? safeNumber(plan.paid_amount)
      : 0;
  const settlementAmount = Math.min(amount, Math.max(manualPaid, safeNumber(allocatedPaid)));
  const syntheticState = deriveCanonicalReadPlanState(
    {
      id: String(plan.id ?? "legacy-plan"),
      amount,
      direction: "income",
      owner_type: "customer",
      owner_id: plan.customer_id,
      account_type: accountType(plan.account_type),
      currency: "TRY",
      due_date: plan.due_date,
      status: plan.status,
    },
    settlementAmount > 0 ? [{
      id: `legacy-settlement-${plan.id ?? "plan"}`,
      payment_plan_id: String(plan.id ?? "legacy-plan"),
      financial_entry_id: "legacy-payment-evidence",
      allocated_amount: settlementAmount,
      account_type: accountType(plan.account_type),
      currency: "TRY",
    }] : [],
    new Date().toISOString().slice(0, 10),
  );

  return Math.min(amount, syntheticState.settledAmount);
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

function ledgerEntriesForReadModel(entries: FinancialEntryLike[]): CanonicalReadEntry[] {
  return entries.map((entry, index) => ({
    id: `ledger-${index}`,
    amount: entry.amount ?? 0,
    direction: entry.direction === "Gider" ? "expense" : "income",
    status: entry.status,
    event_type: entry.direction === "Gider" ? "general_expense" : "customer_receipt",
    owner_type: "other",
    project_id: entry.project_id,
    account_type: entry.group_tag === "Gayri Resmi" ? "gayri_resmi" : "resmi",
    currency: entry.currency_tag,
    transaction_date: entry.entry_date,
  }));
}

function ledgerMetric(entries: FinancialEntryLike[], currency: CurrencyTag, metric: "realizedIncome" | "realizedExpense" | "totalPlannedReceivable" | "plannedCategoryCost"): number {
  return calculateCanonicalCardMetrics({
    entries: ledgerEntriesForReadModel(entries),
    asOfDate: new Date().toISOString().slice(0, 10),
  }, { currency })[metric];
}

export function realizedIncomeFromLedger(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return ledgerMetric(entries, currency, "realizedIncome");
}

export function realizedExpenseFromLedger(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return ledgerMetric(entries, currency, "realizedExpense");
}

export function plannedIncomeFromLedger(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return ledgerMetric(entries, currency, "totalPlannedReceivable");
}

export function plannedExpenseFromLedger(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return ledgerMetric(entries, currency, "plannedCategoryCost");
}

export function netFromLedger(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return realizedIncomeFromLedger(entries, currency) - realizedExpenseFromLedger(entries, currency);
}

export function receivableFromLedger(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return plannedIncomeFromLedger(entries, currency);
}

export function payableFromLedger(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return plannedExpenseFromLedger(entries, currency);
}

export function realizedFinancialIncome(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return realizedIncomeFromLedger(entries, currency);
}

export function realizedFinancialExpense(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return realizedExpenseFromLedger(entries, currency);
}

export function plannedFinancialIncome(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return plannedIncomeFromLedger(entries, currency);
}

export function plannedFinancialExpense(entries: FinancialEntryLike[], currency: CurrencyTag = "TRY"): number {
  return plannedExpenseFromLedger(entries, currency);
}

function isInDateRange(date: string | null | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function filterFinancialEntries(input: LedgerFinanceSummaryInput): FinancialEntryLike[] {
  const currency = input.currency ?? "TRY";
  const group = input.group ?? "all";
  return input.financialEntries.filter((entry) => {
    if (entry.currency_tag !== currency) return false;
    if (group !== "all" && entry.group_tag !== group) return false;
    return isInDateRange(entry.entry_date, input.from, input.to);
  });
}

function filterPayments(input: FinanceSummaryInput): LegacyPaymentLike[] {
  return input.payments.filter((payment) => {
    const datedPayment = payment as LegacyPaymentLike & { payment_date?: string | null };
    return isInDateRange(datedPayment.payment_date, input.from, input.to);
  });
}

function filterExpenses(input: FinanceSummaryInput): LegacyExpenseLike[] {
  return input.expenses.filter((expense) => isInDateRange(expense.expense_date, input.from, input.to));
}

function filterPaymentPlans(input: FinanceSummaryInput): PaymentPlanLike[] {
  return input.paymentPlans.filter((plan) => isInDateRange(plan.due_date, input.from, input.to));
}

export function summarizeLedgerFinance(input: LedgerFinanceSummaryInput): FinanceSummary {
  const currency = input.currency ?? "TRY";
  const entries = filterFinancialEntries(input);
  const today = new Date().toISOString().slice(0, 10);

  const realizedIncome = realizedIncomeFromLedger(entries, currency);
  const plannedIncome = plannedIncomeFromLedger(entries, currency);
  const realizedExpense = realizedExpenseFromLedger(entries, currency);
  const plannedExpense = plannedExpenseFromLedger(entries, currency);
  const overdueReceivable = entries
    .filter((entry) => entry.entry_date && entry.entry_date < today && isPlannedStatus(entry.status) && entry.direction === "Gelir")
    .reduce((sum, entry) => sum + safeNumber(entry.amount), 0);

  return {
    realizedIncome,
    plannedIncome,
    realizedExpense,
    plannedExpense,
    legacyIncome: 0,
    legacyExpense: 0,
    receivable: plannedIncome,
    payable: plannedExpense,
    totalIncome: realizedIncome,
    totalExpense: realizedExpense,
    netBalance: realizedIncome - realizedExpense,
    overdueReceivable,
  };
}

export function summarizeFinance(input: FinanceSummaryInput): FinanceSummary {
  const currency = input.currency ?? "TRY";
  const entries = filterFinancialEntries(input);
  const payments = filterPayments(input);
  const expenses = filterExpenses(input);
  const plans = filterPaymentPlans(input);
  const today = new Date().toISOString().slice(0, 10);

  const realizedIncome = realizedFinancialIncome(entries, currency);
  const plannedIncome = plannedFinancialIncome(entries, currency);
  const realizedExpense = realizedFinancialExpense(entries, currency);
  const plannedExpense = plannedFinancialExpense(entries, currency);
  const legacyIncome = sumBy(payments, (payment) => payment.amount);
  const legacyExpense = sumBy(expenses, (expense) => expense.amount);
  const legacyReceivable = plans
    .filter((plan) => !isPaidStatus(plan.status) && !isCanceledStatus(plan.status))
    .reduce((sum, plan) => sum + paymentPlanRemainingFromPayments(plan, input.payments), 0);
  const overdueReceivable = plans
    .filter((plan) => !!plan.due_date && plan.due_date < today && !isPaidStatus(plan.status) && !isCanceledStatus(plan.status))
    .reduce((sum, plan) => sum + paymentPlanRemainingFromPayments(plan, input.payments), 0);

  return {
    realizedIncome,
    plannedIncome,
    realizedExpense,
    plannedExpense,
    legacyIncome,
    legacyExpense,
    receivable: legacyReceivable + plannedIncome,
    payable: plannedExpense,
    totalIncome: legacyIncome + realizedIncome,
    totalExpense: legacyExpense + realizedExpense,
    netBalance: legacyIncome + realizedIncome - legacyExpense - realizedExpense,
    overdueReceivable,
  };
}

export function derivePlanStatus(plan: { amount: number | string; due_date: string; status: string }, paid: number): string {
  const amount = safeNumber(plan.amount);
  const effectivePaid = plan.status === "Ödendi" ? amount : Math.min(amount, Math.max(0, paid));
  const settlements: CanonicalReadSettlement[] = effectivePaid > 0 ? [{
    id: "legacy-status-settlement",
    payment_plan_id: "legacy-status-plan",
    financial_entry_id: "legacy-payment-evidence",
    allocated_amount: effectivePaid,
    currency: "TRY",
    account_type: "resmi",
  }] : [];
  const state = deriveCanonicalReadPlanState(
    {
      id: "legacy-status-plan",
      amount,
      direction: "income",
      owner_type: "customer",
      currency: "TRY",
      account_type: "resmi",
      due_date: plan.due_date,
      status: plan.status,
    },
    settlements,
    new Date().toISOString().slice(0, 10),
  );

  if (state.status === "canceled") return "İptal";
  if (state.status === "paid") return "Ödendi";
  if (state.status === "partial") return "Kısmi Ödendi";
  if (state.status === "overdue") return "Vadesi Geçti";
  return "Bekliyor";
}

export function summarizePaymentPlansWithCanonicalState(
  plans: PaymentPlanLike[],
  payments: LegacyPaymentLike[],
  allocatedPaidByPlan = new Map<string, number>(),
  asOfDate = new Date().toISOString().slice(0, 10),
): CanonicalPlanSummary {
  return plans.reduce<CanonicalPlanSummary>((summary, plan) => {
    const amount = safeNumber(plan.amount);
    const paid = effectivePaidForPlan(plan, payments, allocatedPaidByPlan.get(String(plan.id)) || 0);
    const state = deriveCanonicalReadPlanState(
      {
        id: String(plan.id ?? `plan-${summary.activeCount}`),
        amount,
        direction: "income",
        owner_type: "customer",
        owner_id: plan.customer_id,
        account_type: accountType(plan.account_type),
        currency: "TRY",
        due_date: plan.due_date,
        status: plan.status,
      },
      paid > 0 ? [{
        id: `settlement-${plan.id ?? summary.activeCount}`,
        payment_plan_id: String(plan.id ?? `plan-${summary.activeCount}`),
        financial_entry_id: "legacy-payment-evidence",
        allocated_amount: paid,
        account_type: accountType(plan.account_type),
        currency: "TRY",
      }] : [],
      asOfDate,
    );

    if (state.status === "canceled") return summary;
    summary.planned += amount;
    summary.paid += paid;
    summary.remaining += state.remainingAmount;
    summary.overdue += state.isOverdue ? state.remainingAmount : 0;
    summary.activeCount += 1;
    return summary;
  }, { planned: 0, paid: 0, remaining: 0, overdue: 0, activeCount: 0 });
}

export function summarizeLegacyExpenseRowsWithCanonicalAdapter(
  expenses: LegacyExpenseLike[],
  options: { from?: string; to?: string; month?: string } = {},
): CanonicalAmountSummary {
  const rows = expenses.filter((expense) => isInDateRange(expense.expense_date, options.from, options.to));
  const entries: CanonicalReadEntry[] = rows.map((expense, index) => ({
    id: `legacy-expense-${index}`,
    amount: expense.amount ?? 0,
    direction: "expense",
    status: "Gerçekleşti",
    event_type: "general_expense",
    owner_type: "other",
    project_id: expense.project_id,
    account_type: "resmi",
    currency: "TRY",
    transaction_date: expense.expense_date,
    category_code: "other",
  }));
  const monthEntries = options.month
    ? entries.filter((entry) => String(entry.transaction_date || "").startsWith(options.month || ""))
    : entries;

  return {
    total: calculateCanonicalCardMetrics({ entries, asOfDate: new Date().toISOString().slice(0, 10) }, { currency: "TRY" }).realizedExpense,
    monthTotal: calculateCanonicalCardMetrics({ entries: monthEntries, asOfDate: new Date().toISOString().slice(0, 10) }, { currency: "TRY" }).realizedExpense,
    projectCount: new Set(rows.map((row) => row.project_id).filter(Boolean)).size,
    categoryCount: new Set(rows.map((row) => row.category).filter(Boolean)).size,
  };
}

export function accountType(value: unknown): "resmi" | "gayri_resmi" {
  return value === "gayri_resmi" ? "gayri_resmi" : "resmi";
}

export function allocateCollectionsToPlans<TPlan extends PaymentPlanLike, TPayment extends LegacyPaymentLike>(
  plans: TPlan[],
  payments: TPayment[],
): Map<string, number> {
  const allocations = new Map<string, number>();
  const activePlans = plans
    .filter((plan) => plan.id && !isCanceledStatus(plan.status))
    .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));

  const activePlanIds = new Set(activePlans.map((plan) => String(plan.id)));
  const linkedCollections = new Map<string, number>();
  let remainingCollection = 0;

  payments.forEach((payment) => {
    const planId = String(payment.payment_plan_id || "");
    if (planId && activePlanIds.has(planId)) {
      linkedCollections.set(planId, (linkedCollections.get(planId) || 0) + safeNumber(payment.amount));
      return;
    }
    if (!planId) {
      remainingCollection += safeNumber(payment.amount);
    }
  });

  for (const plan of activePlans) {
    const planId = String(plan.id);
    const amount = safeNumber(plan.amount);
    const linkedPaid = Math.min(amount, linkedCollections.get(planId) || 0);
    const unlinkedPaid = isPaidStatus(plan.status)
      ? 0
      : Math.min(Math.max(0, amount - linkedPaid), Math.max(0, remainingCollection));
    const paid = linkedPaid + unlinkedPaid;
    allocations.set(planId, paid);
    remainingCollection -= unlinkedPaid;
  }

  return allocations;
}
