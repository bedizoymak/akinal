export const CANONICAL_CATEGORY_CODES = [
  "demolition",
  "excavation",
  "machine_rental",
  "iron",
  "cement",
  "concrete",
  "construction_stage",
  "permit",
  "government_fee",
  "payroll",
  "subcontractor",
  "supplier_material",
  "logistics",
  "utility",
  "office",
  "other",
] as const;

export type CanonicalAccountType = "resmi" | "gayri_resmi";
export type CanonicalCurrency = "TRY" | "USD" | "EUR";
export type CanonicalDirection = "income" | "expense";
export type CanonicalEntryStatus = "draft" | "forecast" | "posted" | "canceled" | "reversed" | "archived" | "Gerçekleşti" | "Planlandı" | "İptal";
export type CanonicalPlanStatus = "pending" | "partial" | "paid" | "overdue" | "canceled" | "Bekliyor" | "Kısmi Ödendi" | "Ödendi" | "Vadesi Geçti" | "İptal";
export type CanonicalOwnerType = "customer" | "project" | "employee" | "supplier" | "category" | "other";
export type CanonicalCategoryCode = typeof CANONICAL_CATEGORY_CODES[number];
export type CanonicalMetricName =
  | "totalContractedAmount"
  | "totalPlannedReceivable"
  | "totalRealizedCollection"
  | "remainingReceivable"
  | "overdueReceivable"
  | "officialReceivable"
  | "unofficialReceivable"
  | "unallocatedCollections"
  | "realizedIncome"
  | "realizedExpense"
  | "remainingPayable"
  | "realizedNetCash"
  | "forecastCompletionProfit"
  | "officialProfitability"
  | "unofficialProfitability"
  | "plannedPayroll"
  | "realizedPayroll"
  | "overduePayable"
  | "contractedPayable"
  | "realizedPayment"
  | "plannedCategoryCost"
  | "realizedCategoryCost"
  | "remainingCategoryPayable"
  | "overdueCategoryPayable";

export type CanonicalReadPlan = {
  id: string;
  amount: number | string;
  contract_amount?: number | string | null;
  direction: CanonicalDirection;
  owner_type: CanonicalOwnerType;
  owner_id?: string | null;
  project_id?: string | null;
  account_type?: string | null;
  currency?: string | null;
  due_date?: string | null;
  status?: CanonicalPlanStatus | string | null;
  archived_at?: string | null;
  canceled_at?: string | null;
  category_code?: string | null;
  duplicate_risk?: boolean;
  unresolved?: boolean;
};

export type CanonicalReadEntry = {
  id: string;
  amount: number | string;
  direction: CanonicalDirection | "Gelir" | "Gider";
  status: CanonicalEntryStatus | string | null;
  event_type?: string | null;
  owner_type?: CanonicalOwnerType | null;
  owner_id?: string | null;
  counterparty_type?: CanonicalOwnerType | null;
  counterparty_id?: string | null;
  project_id?: string | null;
  account_type?: string | null;
  group_tag?: string | null;
  currency?: string | null;
  currency_tag?: string | null;
  transaction_date?: string | null;
  entry_date?: string | null;
  parent_entry_id?: string | null;
  reversal_entry_id?: string | null;
  archived_at?: string | null;
  canceled_at?: string | null;
  category_code?: string | null;
  duplicate_risk?: boolean;
  unresolved?: boolean;
};

export type CanonicalReadSettlement = {
  id: string;
  payment_plan_id: string;
  financial_entry_id: string;
  allocated_amount: number | string;
  account_type?: string | null;
  currency?: string | null;
  reversed_at?: string | null;
  duplicate_risk?: boolean;
  unresolved?: boolean;
};

export type CanonicalReadModelInput = {
  plans?: CanonicalReadPlan[];
  entries?: CanonicalReadEntry[];
  settlements?: CanonicalReadSettlement[];
  asOfDate: string;
};

export type CanonicalMetricScope = {
  ownerType?: CanonicalOwnerType;
  ownerId?: string;
  projectId?: string;
  accountType?: CanonicalAccountType;
  currency?: CanonicalCurrency;
  categoryCode?: CanonicalCategoryCode;
};

export type CanonicalCardMetrics = Record<CanonicalMetricName, number>;

export type CanonicalParityComparison = {
  metric: string;
  cardType: string;
  ownerId?: string;
  projectId?: string;
  accountType?: CanonicalAccountType;
  currency?: CanonicalCurrency;
  canonicalAmount: number;
  currentAmount: number;
  delta: number;
  mismatchClass: string | null;
  includedRowCount: number;
  excludedDuplicateRiskCount: number;
  unresolvedLegacyCount: number;
};

type NormalizedPlan = CanonicalReadPlan & { amountNumber: number; account: CanonicalAccountType; curr: CanonicalCurrency };
type NormalizedEntry = CanonicalReadEntry & { amountNumber: number; account: CanonicalAccountType; curr: CanonicalCurrency; normalizedDirection: CanonicalDirection };

function safeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const emptyMetrics = (): CanonicalCardMetrics => ({
  totalContractedAmount: 0,
  totalPlannedReceivable: 0,
  totalRealizedCollection: 0,
  remainingReceivable: 0,
  overdueReceivable: 0,
  officialReceivable: 0,
  unofficialReceivable: 0,
  unallocatedCollections: 0,
  realizedIncome: 0,
  realizedExpense: 0,
  remainingPayable: 0,
  realizedNetCash: 0,
  forecastCompletionProfit: 0,
  officialProfitability: 0,
  unofficialProfitability: 0,
  plannedPayroll: 0,
  realizedPayroll: 0,
  overduePayable: 0,
  contractedPayable: 0,
  realizedPayment: 0,
  plannedCategoryCost: 0,
  realizedCategoryCost: 0,
  remainingCategoryPayable: 0,
  overdueCategoryPayable: 0,
});

export function canonicalAccountType(value: unknown): CanonicalAccountType {
  if (value === "gayri_resmi" || value === "Gayri Resmi") return "gayri_resmi";
  return "resmi";
}

export function canonicalCurrency(value: unknown): CanonicalCurrency {
  return value === "USD" || value === "EUR" ? value : "TRY";
}

export function canonicalDirection(value: unknown): CanonicalDirection {
  return value === "expense" || value === "Gider" ? "expense" : "income";
}

export function isActivePlan(plan: CanonicalReadPlan): boolean {
  return !plan.duplicate_risk
    && !plan.unresolved
    && !plan.archived_at
    && !plan.canceled_at
    && plan.status !== "İptal"
    && plan.status !== "canceled"
    && plan.status !== "archived";
}

export function isPostedEntry(entry: CanonicalReadEntry): boolean {
  return !entry.duplicate_risk
    && !entry.unresolved
    && !entry.archived_at
    && !entry.canceled_at
    && !entry.reversal_entry_id
    && (entry.status === "posted" || entry.status === "Gerçekleşti");
}

export function isForecastEntry(entry: CanonicalReadEntry): boolean {
  return !entry.duplicate_risk
    && !entry.unresolved
    && !entry.archived_at
    && !entry.canceled_at
    && !entry.reversal_entry_id
    && (entry.status === "forecast" || entry.status === "Planlandı");
}

export function isActiveSettlement(settlement: CanonicalReadSettlement): boolean {
  return !settlement.duplicate_risk && !settlement.unresolved && !settlement.reversed_at;
}

function normalizePlan(plan: CanonicalReadPlan): NormalizedPlan {
  return {
    ...plan,
    amountNumber: safeNumber(plan.amount),
    account: canonicalAccountType(plan.account_type),
    curr: canonicalCurrency(plan.currency),
  };
}

function normalizeEntry(entry: CanonicalReadEntry): NormalizedEntry {
  return {
    ...entry,
    amountNumber: safeNumber(entry.amount),
    account: canonicalAccountType(entry.account_type ?? entry.group_tag),
    curr: canonicalCurrency(entry.currency ?? entry.currency_tag),
    normalizedDirection: canonicalDirection(entry.direction),
  };
}

function planMatches(plan: NormalizedPlan, scope: CanonicalMetricScope): boolean {
  if (scope.ownerType && plan.owner_type !== scope.ownerType) return false;
  if (scope.ownerId && plan.owner_id !== scope.ownerId) return false;
  if (scope.projectId && plan.project_id !== scope.projectId) return false;
  if (scope.accountType && plan.account !== scope.accountType) return false;
  if (scope.currency && plan.curr !== scope.currency) return false;
  if (scope.categoryCode && plan.category_code !== scope.categoryCode) return false;
  return true;
}

function entryMatches(entry: NormalizedEntry, scope: CanonicalMetricScope): boolean {
  const ownerType = entry.owner_type ?? entry.counterparty_type ?? undefined;
  const ownerId = entry.owner_id ?? entry.counterparty_id ?? undefined;
  if (scope.ownerType && ownerType !== scope.ownerType) return false;
  if (scope.ownerId && ownerId !== scope.ownerId) return false;
  if (scope.projectId && entry.project_id !== scope.projectId) return false;
  if (scope.accountType && entry.account !== scope.accountType) return false;
  if (scope.currency && entry.curr !== scope.currency) return false;
  if (scope.categoryCode && entry.category_code !== scope.categoryCode) return false;
  return true;
}

function eventMatches(entry: CanonicalReadEntry, eventTypes: string[]): boolean {
  return eventTypes.length === 0 || eventTypes.includes(String(entry.event_type ?? ""));
}

function settledByPlan(settlements: CanonicalReadSettlement[]): Map<string, number> {
  const totals = new Map<string, number>();
  settlements.filter(isActiveSettlement).forEach((settlement) => {
    totals.set(settlement.payment_plan_id, (totals.get(settlement.payment_plan_id) ?? 0) + safeNumber(settlement.allocated_amount));
  });
  return totals;
}

function settledByEntry(settlements: CanonicalReadSettlement[]): Map<string, number> {
  const totals = new Map<string, number>();
  settlements.filter(isActiveSettlement).forEach((settlement) => {
    totals.set(settlement.financial_entry_id, (totals.get(settlement.financial_entry_id) ?? 0) + safeNumber(settlement.allocated_amount));
  });
  return totals;
}

function remainingForPlan(plan: NormalizedPlan, settled: Map<string, number>): number {
  return Math.max(0, plan.amountNumber - (settled.get(plan.id) ?? 0));
}

function isOverdue(plan: NormalizedPlan, remaining: number, asOfDate: string): boolean {
  return remaining > 0 && Boolean(plan.due_date) && String(plan.due_date) < asOfDate;
}

export function deriveCanonicalReadPlanState(plan: CanonicalReadPlan, settlements: CanonicalReadSettlement[], asOfDate: string) {
  const normalized = normalizePlan(plan);
  if (!isActivePlan(plan)) return { status: "canceled" as const, settledAmount: 0, remainingAmount: normalized.amountNumber, isOverdue: false };
  const settled = settledByPlan(settlements).get(plan.id) ?? 0;
  const remainingAmount = Math.max(0, normalized.amountNumber - settled);
  const overdue = isOverdue(normalized, remainingAmount, asOfDate);
  return {
    status: remainingAmount <= 0 ? "paid" as const : settled > 0 ? "partial" as const : overdue ? "overdue" as const : "pending" as const,
    settledAmount: settled,
    remainingAmount,
    isOverdue: overdue,
  };
}

export function calculateCanonicalCardMetrics(input: CanonicalReadModelInput, scope: CanonicalMetricScope = {}): CanonicalCardMetrics {
  const metrics = emptyMetrics();
  const settledPlans = settledByPlan(input.settlements ?? []);
  const settledEntries = settledByEntry(input.settlements ?? []);
  const plans = (input.plans ?? []).map(normalizePlan).filter((plan) => isActivePlan(plan) && planMatches(plan, scope));
  const postedEntries = (input.entries ?? []).map(normalizeEntry).filter((entry) => isPostedEntry(entry) && entryMatches(entry, scope));
  const forecastEntries = (input.entries ?? []).map(normalizeEntry).filter((entry) => isForecastEntry(entry) && entryMatches(entry, scope));
  const receivablePlans = plans.filter((plan) => plan.direction === "income");
  const payablePlans = plans.filter((plan) => plan.direction === "expense");
  const postedIncome = postedEntries.filter((entry) => entry.normalizedDirection === "income");
  const postedExpense = postedEntries.filter((entry) => entry.normalizedDirection === "expense");
  const forecastIncome = forecastEntries.filter((entry) => entry.normalizedDirection === "income");
  const forecastExpense = forecastEntries.filter((entry) => entry.normalizedDirection === "expense");

  const sumRemaining = (items: NormalizedPlan[]) => items.reduce((sum, plan) => sum + remainingForPlan(plan, settledPlans), 0);
  const sumOverdue = (items: NormalizedPlan[]) => items.reduce((sum, plan) => {
    const remaining = remainingForPlan(plan, settledPlans);
    return sum + (isOverdue(plan, remaining, input.asOfDate) ? remaining : 0);
  }, 0);
  const sumEntries = (items: NormalizedEntry[], events: string[] = []) =>
    items.filter((entry) => eventMatches(entry, events)).reduce((sum, entry) => sum + entry.amountNumber, 0);

  metrics.totalContractedAmount = receivablePlans.reduce((sum, plan) => sum + safeNumber(plan.contract_amount ?? plan.amount), 0);
  metrics.totalPlannedReceivable = receivablePlans.reduce((sum, plan) => sum + plan.amountNumber, 0) + sumEntries(forecastIncome);
  metrics.totalRealizedCollection = sumEntries(postedIncome, ["customer_receipt"]) - sumEntries(postedExpense, ["customer_refund"]);
  metrics.remainingReceivable = sumRemaining(receivablePlans);
  metrics.overdueReceivable = sumOverdue(receivablePlans);
  metrics.officialReceivable = scope.accountType
    ? scope.accountType === "resmi" ? metrics.remainingReceivable : 0
    : calculateCanonicalCardMetrics(input, { ...scope, accountType: "resmi" }).remainingReceivable;
  metrics.unofficialReceivable = scope.accountType
    ? scope.accountType === "gayri_resmi" ? metrics.remainingReceivable : 0
    : calculateCanonicalCardMetrics(input, { ...scope, accountType: "gayri_resmi" }).remainingReceivable;
  metrics.unallocatedCollections = postedIncome
    .filter((entry) => eventMatches(entry, ["customer_receipt"]))
    .reduce((sum, entry) => sum + Math.max(0, entry.amountNumber - (settledEntries.get(entry.id) ?? 0)), 0);

  metrics.realizedIncome = sumEntries(postedIncome);
  metrics.realizedExpense = sumEntries(postedExpense);
  metrics.remainingPayable = sumRemaining(payablePlans);
  metrics.realizedNetCash = metrics.realizedIncome - metrics.realizedExpense;
  metrics.forecastCompletionProfit = metrics.realizedIncome + metrics.remainingReceivable - metrics.realizedExpense - metrics.remainingPayable;
  metrics.officialProfitability = scope.accountType
    ? scope.accountType === "resmi" ? metrics.forecastCompletionProfit : 0
    : calculateCanonicalCardMetrics(input, { ...scope, accountType: "resmi" }).forecastCompletionProfit;
  metrics.unofficialProfitability = scope.accountType
    ? scope.accountType === "gayri_resmi" ? metrics.forecastCompletionProfit : 0
    : calculateCanonicalCardMetrics(input, { ...scope, accountType: "gayri_resmi" }).forecastCompletionProfit;

  metrics.plannedPayroll = payablePlans.filter((plan) => plan.owner_type === "employee" || plan.category_code === "payroll").reduce((sum, plan) => sum + plan.amountNumber, 0)
    + sumEntries(forecastExpense.filter((entry) => entry.owner_type === "employee" || entry.category_code === "payroll"));
  metrics.realizedPayroll = sumEntries(postedExpense, ["personnel_payment"]);
  metrics.overduePayable = sumOverdue(payablePlans);

  metrics.contractedPayable = payablePlans.reduce((sum, plan) => sum + safeNumber(plan.contract_amount ?? plan.amount), 0);
  metrics.realizedPayment = sumEntries(postedExpense, ["supplier_payment", "personnel_payment", "general_expense"]);
  metrics.plannedCategoryCost = payablePlans.reduce((sum, plan) => sum + plan.amountNumber, 0) + sumEntries(forecastExpense);
  metrics.realizedCategoryCost = sumEntries(postedExpense);
  metrics.remainingCategoryPayable = metrics.remainingPayable;
  metrics.overdueCategoryPayable = metrics.overduePayable;

  return metrics;
}

export function compareCanonicalParity(args: {
  cardType: string;
  ownerId?: string;
  projectId?: string;
  accountType?: CanonicalAccountType;
  currency?: CanonicalCurrency;
  canonical: Partial<Record<CanonicalMetricName, number>>;
  current: Partial<Record<CanonicalMetricName, number>>;
  includedRowCount?: number;
  excludedDuplicateRiskCount?: number;
  unresolvedLegacyCount?: number;
}): CanonicalParityComparison[] {
  const metricNames = Array.from(new Set([...Object.keys(args.canonical), ...Object.keys(args.current)])) as CanonicalMetricName[];
  return metricNames.map((metric) => {
    const canonicalAmount = safeNumber(args.canonical[metric]);
    const currentAmount = safeNumber(args.current[metric]);
    const delta = Number((currentAmount - canonicalAmount).toFixed(2));
    return {
      metric,
      cardType: args.cardType,
      ownerId: args.ownerId,
      projectId: args.projectId,
      accountType: args.accountType,
      currency: args.currency,
      canonicalAmount,
      currentAmount,
      delta,
      mismatchClass: Math.abs(delta) > 0.005 ? "amount mismatch" : null,
      includedRowCount: args.includedRowCount ?? 0,
      excludedDuplicateRiskCount: args.excludedDuplicateRiskCount ?? 0,
      unresolvedLegacyCount: args.unresolvedLegacyCount ?? 0,
    };
  });
}

export function countExcludedDuplicateRisk(input: CanonicalReadModelInput): number {
  return [
    ...(input.plans ?? []),
    ...(input.entries ?? []),
    ...(input.settlements ?? []),
  ].filter((row) => Boolean(row.duplicate_risk)).length;
}

export function countUnresolvedLegacy(input: CanonicalReadModelInput): number {
  return [
    ...(input.plans ?? []),
    ...(input.entries ?? []),
    ...(input.settlements ?? []),
  ].filter((row) => Boolean(row.unresolved)).length;
}
