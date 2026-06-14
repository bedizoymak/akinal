export const CANONICAL_EVENT_TYPES = [
  "customer_receipt", "customer_refund", "personnel_payment", "supplier_payment",
  "general_expense", "expense_refund", "forecast_income", "forecast_expense",
  "adjustment", "reversal", "transfer", "opening_balance", "currency_difference",
] as const;
export const CANONICAL_DIRECTIONS = ["income", "expense", "transfer"] as const;
export const CANONICAL_STATUSES = ["draft", "forecast", "posted", "canceled", "reversed", "archived"] as const;
export const CANONICAL_ACCOUNT_TYPES = ["resmi", "gayri_resmi"] as const;
export const CANONICAL_ALLOCATION_SCOPES = ["project", "company_overhead", "unallocated"] as const;
export const CANONICAL_COUNTERPARTY_TYPES = ["customer", "employee", "supplier", "government", "internal", "other", "none"] as const;
export const CANONICAL_CURRENCIES = ["TRY", "USD", "EUR"] as const;
export const CANONICAL_RECONCILIATION_STATUSES = ["pending", "matched", "ambiguous", "excluded", "approved"] as const;
export const CANONICAL_MIGRATION_CONFIDENCES = ["exact", "probable", "ambiguous", "manual"] as const;

type RecordValue = string | number | boolean | null | undefined;
export type CanonicalRecord = Record<string, RecordValue>;

const has = (values: readonly string[], value: RecordValue) => typeof value === "string" && values.includes(value);
const id = (value: RecordValue) => String(value ?? "").trim() || null;
const date = (value: RecordValue) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const today = (value?: string) => value ?? new Date().toISOString().slice(0, 10);

export function validateCounterparty(record: CanonicalRecord): string[] {
  const type = record.counterparty_type;
  const counterpartyId = id(record.counterparty_id);
  const errors: string[] = [];
  if (["customer", "employee", "supplier"].includes(String(type)) && !counterpartyId) {
    errors.push("The selected counterparty type requires counterparty_id.");
  }
  if (["internal", "none"].includes(String(type)) && counterpartyId) {
    errors.push("Internal or none counterparty must not have counterparty_id.");
  }
  const legacyField = type === "customer" ? "customer_id" : type === "employee" ? "employee_id" : type === "supplier" ? "expense_card_id" : null;
  if (legacyField && id(record[legacyField]) && counterpartyId && id(record[legacyField]) !== counterpartyId) {
    errors.push("Canonical and compatibility counterparty IDs do not match.");
  }
  return errors;
}

export function validateProjectScope(record: CanonicalRecord): string[] {
  const errors: string[] = [];
  if (record.allocation_scope === "project" && !id(record.project_id)) errors.push("Project scope requires project_id.");
  if (record.allocation_scope === "company_overhead" && id(record.project_id)) errors.push("Company overhead must not carry project_id.");
  if (["company_overhead", "unallocated"].includes(String(record.allocation_scope)) && !String(record.allocation_note ?? "").trim()) {
    errors.push("Company overhead or unallocated scope requires allocation_note.");
  }
  return errors;
}

export function validateInstrumentMaturity(record: CanonicalRecord, asOf?: string): string[] {
  const method = record.payment_method;
  if (method !== "Çek" && method !== "Senet") return [];
  const maturity = method === "Çek" ? record.cheque_maturity_date : record.promissory_maturity_date;
  if (!date(maturity)) return [`${method} requires a valid maturity date.`];
  const realized = record.status === "posted" || ["customer_receipt", "personnel_payment", "supplier_payment", "general_expense"].includes(String(record.event_type));
  const errors: string[] = [];
  if (realized && (String(maturity) > today(asOf) || !["cleared", "paid"].includes(String(record.instrument_status)))) {
    errors.push("Cheque/senet is realized only when cleared or paid at maturity.");
  }
  if (["protested", "returned"].includes(String(record.instrument_status)) && record.status === "posted") {
    errors.push("Protested or returned instrument requires reversal and must not remain posted cash.");
  }
  return errors;
}

export function validateReversalAdjustment(record: CanonicalRecord): string[] {
  if (record.event_type !== "reversal" && record.event_type !== "adjustment") return [];
  const errors: string[] = [];
  if (!id(record.parent_entry_id)) errors.push("Reversal or adjustment requires parent_entry_id.");
  if (!String(record.cancellation_reason ?? record.adjustment_reason ?? "").trim()) errors.push("Reversal or adjustment requires a reason.");
  return errors;
}

export function validateLedgerPayload(record: CanonicalRecord, asOf?: string): string[] {
  const errors: string[] = [];
  const enums: Array<[string, readonly string[]]> = [
    ["event_type", CANONICAL_EVENT_TYPES], ["direction", CANONICAL_DIRECTIONS],
    ["status", CANONICAL_STATUSES], ["account_type", CANONICAL_ACCOUNT_TYPES],
    ["allocation_scope", CANONICAL_ALLOCATION_SCOPES], ["counterparty_type", CANONICAL_COUNTERPARTY_TYPES],
    ["currency", CANONICAL_CURRENCIES],
  ];
  enums.forEach(([field, values]) => { if (!has(values, record[field])) errors.push(`${field} is required and must be canonical.`); });
  if (!(Number(record.amount) > 0)) errors.push("amount must be a positive number.");
  if (!id(record.business_transaction_id)) errors.push("business_transaction_id is required.");
  if (!date(record.transaction_date)) errors.push("transaction_date must be a valid ISO date.");
  if (record.status === "posted" && !(Number(record.base_amount) > 0)) errors.push("Posted entries require base_amount.");
  if (record.status === "posted" && record.currency !== "TRY" && !(Number(record.exchange_rate) > 0)) {
    errors.push("Posted foreign-currency entries require a positive exchange_rate.");
  }
  return [...new Set([...errors, ...validateCounterparty(record), ...validateProjectScope(record), ...validateInstrumentMaturity(record, asOf), ...validateReversalAdjustment(record)])];
}

export function assertSettlementCompatibility(plan: CanonicalRecord, entry: CanonicalRecord, settlement: CanonicalRecord): void {
  if (plan.account_type !== entry.account_type || plan.account_type !== settlement.account_type) throw new Error("Resmi/Gayri Resmi settlement must never cross.");
  if (plan.currency !== entry.currency || plan.currency !== settlement.currency) throw new Error("Plan, entry, and settlement currency must match.");
  const key = (record: CanonicalRecord) => `${record.counterparty_type}:${record.counterparty_id}`;
  if (!id(plan.counterparty_id) || key(plan) !== key(entry)) throw new Error("Plan and entry counterparty must match.");
  if (!settlement.approved_project_exception && (plan.project_id !== entry.project_id || plan.allocation_scope !== entry.allocation_scope)) {
    throw new Error("Plan and entry project scope must match.");
  }
}

export function assertNoOverAllocation(allocation: number, planAmount: number, planSettled: number, entryAmount: number, entrySettled: number): void {
  if (!(allocation > 0)) throw new Error("Settlement allocation must be positive.");
  if (allocation > Math.max(0, planAmount - planSettled)) throw new Error("Settlement exceeds remaining plan amount.");
  if (allocation > Math.max(0, entryAmount - entrySettled)) throw new Error("Settlement exceeds available entry amount.");
}

export function deriveCanonicalPlanStatus(amount: number, settled: number, dueDate: string, asOf?: string) {
  const paid = Math.min(Math.max(0, settled), Math.max(0, amount));
  const remainingAmount = Math.max(0, amount - paid);
  const isOverdue = remainingAmount > 0 && dueDate < today(asOf);
  const status = remainingAmount <= 0 ? "paid" : paid > 0 ? "partial" : isOverdue ? "overdue" : "pending";
  return { status, remainingAmount, isOverdue };
}

export function validatePostedEntryMutation(existing: CanonicalRecord, proposed: CanonicalRecord): string[] {
  if (existing.status !== "posted") return [];
  const immutable = ["business_transaction_id", "event_type", "direction", "amount", "currency", "account_type", "transaction_date", "counterparty_type", "counterparty_id", "project_id", "allocation_scope"];
  const changed = immutable.find((field) => field in proposed && String(existing[field] ?? "") !== String(proposed[field] ?? ""));
  return changed ? [`Posted entry field ${changed} is immutable.`] : [];
}
