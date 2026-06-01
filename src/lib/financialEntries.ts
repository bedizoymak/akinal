import { CURRENCIES, formatMoney, type CardType, type CurrencyTag } from "@/lib/finance";
import type { AdminCustomerLookup, AdminEmployee, AdminExpenseCard, AdminFinancialEntry, AdminProjectLookup } from "@/lib/apiTypes";

export type CurrencyTotals = Record<CurrencyTag, number>;

export type FinanceLookups = {
  projects: Map<string, AdminProjectLookup>;
  customers: Map<string, AdminCustomerLookup>;
  employees: Map<string, AdminEmployee>;
  expenseCards: Map<string, AdminExpenseCard>;
};

export function createCurrencyTotals(): CurrencyTotals {
  return { TRY: 0, USD: 0, EUR: 0 };
}

export function signedEntryAmount(entry: AdminFinancialEntry): number {
  return entry.direction === "Gelir" ? Number(entry.amount) : -Number(entry.amount);
}

export function addToCurrencyTotals(totals: CurrencyTotals, currency: CurrencyTag, amount: number) {
  totals[currency] += amount;
}

export function sumEntriesByCurrency(entries: AdminFinancialEntry[], signed = false): CurrencyTotals {
  return entries.reduce<CurrencyTotals>((totals, entry) => {
    addToCurrencyTotals(totals, entry.currency_tag, signed ? signedEntryAmount(entry) : Number(entry.amount));
    return totals;
  }, createCurrencyTotals());
}

export function subtractCurrencyTotals(left: CurrencyTotals, right: CurrencyTotals): CurrencyTotals {
  return CURRENCIES.reduce<CurrencyTotals>((totals, currency) => {
    totals[currency] = left[currency] - right[currency];
    return totals;
  }, createCurrencyTotals());
}

export function positiveCurrencyDifference(left: CurrencyTotals, right: CurrencyTotals): CurrencyTotals {
  return CURRENCIES.reduce<CurrencyTotals>((totals, currency) => {
    totals[currency] = Math.max(0, left[currency] - right[currency]);
    return totals;
  }, createCurrencyTotals());
}

export function hasCurrencyTotal(totals: CurrencyTotals): boolean {
  return CURRENCIES.some((currency) => Math.abs(totals[currency]) > 0);
}

export function formatCurrencyTotalLines(totals: CurrencyTotals): string[] {
  return CURRENCIES.filter((currency) => Math.abs(totals[currency]) > 0).map((currency) => formatMoney(totals[currency], currency));
}

export function getCustomerName(customer: AdminCustomerLookup | null | undefined): string {
  if (!customer) return "Bilinmeyen kayıt";
  if (customer.customer_type === "Firma" && customer.company_name) return customer.company_name;
  return customer.full_name || customer.company_name || "İsimsiz müşteri";
}

export function getCardTypeLabel(type: CardType): string {
  if (type === "customer") return "Müşteri";
  if (type === "employee") return "Personel";
  return "Gider Kartı";
}

export function getEntryCardName(entry: AdminFinancialEntry, lookups: FinanceLookups): string {
  if (entry.card_type === "customer") {
    if (!entry.customer_id) return "Silinmiş kart";
    return getCustomerName(lookups.customers.get(entry.customer_id)) || "Bilinmeyen kayıt";
  }
  if (entry.card_type === "employee") {
    if (!entry.employee_id) return "Silinmiş kart";
    return lookups.employees.get(entry.employee_id)?.full_name || "Bilinmeyen kayıt";
  }
  if (!entry.expense_card_id) return "Silinmiş kart";
  return lookups.expenseCards.get(entry.expense_card_id)?.name || "Bilinmeyen kayıt";
}

export function getProjectName(projectId: string | null | undefined, lookups: FinanceLookups): string {
  if (!projectId) return "Proje bağlantısı yok";
  return lookups.projects.get(projectId)?.title || "Silinmiş proje";
}

export function chooseChartCurrency(entries: AdminFinancialEntry[]): CurrencyTag {
  const volume = entries.reduce<CurrencyTotals>((totals, entry) => {
    totals[entry.currency_tag] += Math.abs(Number(entry.amount));
    return totals;
  }, createCurrencyTotals());

  return CURRENCIES.reduce<CurrencyTag>((best, currency) => (volume[currency] > volume[best] ? currency : best), "TRY");
}

export function isInCurrentMonth(dateString: string): boolean {
  const date = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
}
