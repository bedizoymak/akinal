import type { CardType, CurrencyTag, EntryDirection, EntryStatus, GroupTag } from "@/lib/finance";

export interface SiteSettings {
  id: string;
  company_name: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  address: string | null;
  map_embed_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  footer_description: string | null;
  hero_title: string | null;
  hero_subtitle: string | null;
  favicon_url: string | null;
  whatsapp_message: string | null;
  seo_title: string | null;
  seo_description: string | null;
  updated_at?: string | null;
}

export interface PublicProject {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  detailed_description?: string | null;
  project_type: string | null;
  project_status: string | null;
  location: string | null;
  city: string | null;
  district: string | null;
  start_year?: string | number | null;
  delivery_year?: string | number | null;
  land_area?: string | null;
  construction_area?: string | null;
  apartment_count?: string | number | null;
  floor_count?: string | number | null;
  block_count?: string | number | null;
  cover_image_url: string | null;
  is_featured: boolean | number | null;
  is_published?: boolean | number | null;
  sort_order: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
  contract_total_try?: number | string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface ProjectImage {
  id: string;
  project_id?: string;
  image_url: string;
  thumbnail_url?: string | null;
  title?: string | null;
  alt_text?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

export interface ProjectDetailResponse {
  project: PublicProject;
  images: ProjectImage[];
}

export interface AdminUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
}

export interface ContactRequestPayload {
  full_name: string;
  phone: string;
  email?: string | null;
  service_type?: string | null;
  message: string;
  turnstile_token?: string | null;
}

export interface AdminContactRequest {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  service_type: string | null;
  message: string;
  status: string;
  created_at: string;
}

export interface AdminDashboardSummary {
  total_projects: number;
  active_projects: number;
  published_projects: number;
  draft_projects: number;
  total_contact_requests: number;
  new_contact_requests: number;
  unread_notifications: number;
  total_customers: number;
  total_payments: number;
  total_expenses: number;
  basic_net_balance: number;
  planned_income?: number;
  month_income?: number;
  month_expenses?: number;
  month_net?: number;
  overdue_collections?: number;
  expected_payments?: number;
  overdue_plan_count?: number;
  upcoming_plan_count?: number;
  financial_entry_count?: number;
}

export interface AdminDashboardProject {
  id: string;
  title: string;
  project_status: string | null;
  location: string | null;
  is_published: boolean | number | null;
  slug: string;
  sort_order: number | null;
}

export interface AdminDashboardResponse {
  summary: AdminDashboardSummary;
  active_projects_list: AdminDashboardProject[];
  overdue_plans?: AdminDashboardPaymentPlan[];
  upcoming_plans?: AdminDashboardPaymentPlan[];
  recent_movements?: AdminDashboardMovement[];
  monthly_financials?: AdminDashboardMonthlyFinancial[];
  unified_financial_cards?: AdminUnifiedFinancialCards;
  cashflow_command_center?: AdminCashflowCommandCenter;
  net_cash_forecast?: AdminNetCashForecast;
  cashflow_action_center?: AdminCashflowActionCenter;
  management_decision_dashboard?: AdminManagementDecisionDashboard;
  financial_drilldowns?: AdminFinancialDrilldowns;
  expense_category_intelligence?: AdminExpenseCategoryIntelligence;
}

export interface AdminNetCashForecastWindow {
  window: string;
  label: string;
  days: number;
  expected_collections: number | string;
  expected_payments: number | string;
  overdue_payables: number | string;
  forecast_net_cash: number | string;
  risk_adjusted_forecast: number | string;
  official_expected_collections: number | string;
  unofficial_expected_collections: number | string;
  official_expected_payments: number | string;
  unofficial_expected_payments: number | string;
  negative_forecast_cash: boolean;
}

export interface AdminNetCashForecast {
  available_cash: number | string;
  current_payables: number | string;
  overdue_collections: number | string;
  overdue_payables: number | string;
  official_cash_position: number | string;
  unofficial_cash_position: number | string;
  combined_operational_cash_position: number | string;
  windows: AdminNetCashForecastWindow[];
}

export interface AdminCashflowActionItem {
  id: string;
  name: string;
  label: string;
  amount: number | string;
  score: number;
  reason: string;
  due_date: string | null;
}

export interface AdminCashflowActionCenter {
  critical_collections: {
    highest_overdue_customers: AdminCashflowActionItem[];
    highest_outstanding_balances: AdminCashflowActionItem[];
    collection_risk_scores: AdminCashflowActionItem[];
  };
  critical_payments: {
    upcoming_supplier_payments: AdminCashflowActionItem[];
    upcoming_personnel_payments: AdminCashflowActionItem[];
    highest_payable_balances: AdminCashflowActionItem[];
    overdue_payable_actions?: AdminCashflowActionItem[];
  };
  project_risk_list: {
    lowest_profitability_projects: AdminCashflowActionItem[];
    highest_expense_projects: AdminCashflowActionItem[];
    negative_cashflow_projects: AdminCashflowActionItem[];
  };
  daily_action_queue: {
    customers_to_contact_today: AdminCashflowActionItem[];
    suppliers_requiring_payment_review: AdminCashflowActionItem[];
    projects_requiring_financial_review: AdminCashflowActionItem[];
    payment_priority_queue?: AdminCashflowActionItem[];
  };
}

export interface AdminManagementDecisionDashboard {
  top_risky_customers: AdminCashflowActionItem[];
  top_overdue_collections: AdminCashflowActionItem[];
  top_supplier_liabilities: AdminCashflowActionItem[];
  top_personnel_cost_centers: AdminCashflowActionItem[];
  top_profitable_projects: AdminCashflowActionItem[];
  top_loss_making_projects: AdminCashflowActionItem[];
  cash_shortage_warnings: AdminCashflowActionItem[];
  collection_priority_queue: AdminCashflowActionItem[];
  payment_priority_queue: AdminCashflowActionItem[];
  category_priority_queue?: AdminCashflowActionItem[];
  official_unofficial_actions?: AdminCashflowActionItem[];
  top_spending_categories?: AdminExpenseCategoryIntelligenceRow[];
}

export interface AdminExpenseCategoryIntelligenceRow {
  category: string;
  realized_cost: number | string;
  planned_cost: number | string;
  total_exposure: number | string;
  cash_pressure: number | string;
  profitability_impact: number | string;
  official_realized_cost: number | string;
  unofficial_realized_cost: number | string;
  official_planned_cost: number | string;
  unofficial_planned_cost: number | string;
  project_linked_realized_cost: number | string;
  supplier_related_cost: number | string;
  personnel_related_cost: number | string;
  row_count: number;
}

export interface AdminExpenseCategoryIntelligence {
  categories: AdminExpenseCategoryIntelligenceRow[];
  top_spending_categories: AdminExpenseCategoryIntelligenceRow[];
  uncategorized: AdminExpenseCategoryIntelligenceRow[];
  summary: {
    realized_cost_total: number | string;
    planned_cost_total: number | string;
    cash_pressure_total: number | string;
    profitability_impact_total: number | string;
    uncategorized_count: number;
    category_count: number;
  };
}

export interface AdminFinancialDrilldownRow {
  id: string;
  owner_name: string;
  label: string;
  amount: number | string;
  row_date: string | null;
  row_type: string;
}

export interface AdminFinancialDrilldowns {
  customer: {
    collections: AdminFinancialDrilldownRow[];
    pending_payments: AdminFinancialDrilldownRow[];
    overdue_payments: AdminFinancialDrilldownRow[];
  };
  project: {
    revenue_rows: AdminFinancialDrilldownRow[];
    expense_rows: AdminFinancialDrilldownRow[];
    profit_components: AdminFinancialDrilldownRow[];
  };
  supplier: {
    purchases: AdminFinancialDrilldownRow[];
    payments: AdminFinancialDrilldownRow[];
    remaining_payable_rows: AdminFinancialDrilldownRow[];
  };
  personnel: {
    salary: AdminFinancialDrilldownRow[];
    advances: AdminFinancialDrilldownRow[];
    reimbursements: AdminFinancialDrilldownRow[];
    total_cost_rows: AdminFinancialDrilldownRow[];
  };
}

export interface AdminCashflowCommandCenter {
  current_receivables: number | string;
  current_payables: number | string;
  net_cash_position: number | string;
  overdue_collections: number | string;
  upcoming_collections: number | string;
  upcoming_payments: number | string;
  personnel_cost_total: number | string;
  most_risky_customers: AdminCustomerFinancialCard[];
  most_expensive_projects: AdminProjectFinancialCard[];
  highest_supplier_debt: AdminSupplierFinancialCard[];
}

export interface AdminUnifiedFinancialCards {
  customers: AdminCustomerFinancialCard[];
  projects: AdminProjectFinancialCard[];
  suppliers: AdminSupplierFinancialCard[];
  personnel: AdminPersonnelFinancialCard[];
}

export interface AdminCustomerFinancialCard {
  id: string;
  name: string;
  total_contract_value: number | string;
  total_collected: number | string;
  remaining_receivable: number | string;
  overdue_amount: number | string;
  upcoming_amount: number | string;
  official_contract_value?: number | string;
  unofficial_contract_value?: number | string;
  official_collected?: number | string;
  unofficial_collected?: number | string;
  official_remaining_receivable?: number | string;
  unofficial_remaining_receivable?: number | string;
  payment_performance_summary: string;
}

export interface AdminProjectFinancialCard {
  id: string;
  name: string;
  total_revenue: number | string;
  total_expenses: number | string;
  net_profit: number | string;
  outstanding_receivables: number | string;
  outstanding_payables: number | string;
  current_cash_position: number | string;
  cash_exposure?: number | string;
  official_project_revenue?: number | string;
  unofficial_project_revenue?: number | string;
  official_project_expenses?: number | string;
  unofficial_project_expenses?: number | string;
  official_project_profit?: number | string;
  unofficial_project_profit?: number | string;
  combined_project_profit?: number | string;
  official_project_cash_exposure?: number | string;
  unofficial_project_cash_exposure?: number | string;
  combined_project_cash_exposure?: number | string;
}

export interface AdminSupplierFinancialCard {
  id: string;
  name: string;
  total_purchases: number | string;
  total_paid: number | string;
  remaining_payable: number | string;
  overdue_payable: number | string;
  last_payment_date: string | null;
  official_total_paid?: number | string;
  unofficial_total_paid?: number | string;
  official_remaining_payable?: number | string;
  unofficial_remaining_payable?: number | string;
}

export interface AdminPersonnelFinancialCard {
  id: string;
  name: string;
  salary_paid: number | string;
  advances_paid: number | string;
  expense_reimbursements: number | string;
  total_personnel_cost: number | string;
  remaining_payable?: number | string;
  overdue_payable?: number | string;
  official_total_personnel_cost?: number | string;
  unofficial_total_personnel_cost?: number | string;
  official_remaining_payable?: number | string;
  unofficial_remaining_payable?: number | string;
}

export interface AdminDashboardPaymentPlan {
  id: string;
  title: string | null;
  amount: number | string;
  due_date: string | null;
  status: string | null;
  customer_id: string | null;
  project_id: string | null;
  paid_amount: number | string;
  remaining_amount: number | string;
  customer_name: string | null;
  project_title: string | null;
}

export interface AdminDashboardMovement {
  id: string;
  label: string | null;
  party_name: string | null;
  realized_amount: number | string;
  original_amount: number | string;
  date: string | null;
  direction: string | null;
  card_type: string | null;
  account_type: string | null;
  currency: string | null;
  status: string | null;
  project_title: string | null;
}

// Matches dashboard.php fetch_monthly_financials()'s actual response keys — 'month' and
// 'expense' (singular), not 'month_key'/'expenses'.
export interface AdminDashboardMonthlyFinancial {
  month: string;
  income: number | string;
  expense: number | string;
  net: number | string;
}

export interface AdminCustomer {
  id: string;
  customer_type: string | null;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  tax_or_identity_number: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  status: string | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminCustomerProjectLink {
  customer_id?: string;
  project_id: string;
}

export interface AdminPaymentPlan {
  id: string;
  customer_id: string | null;
  project_id: string | null;
  title: string | null;
  description: string | null;
  type?: string | null;
  amount: number | string;
  paid_amount?: number | string | null;
  currency?: string | null;
  payment_method?: string | null;
  transaction_reference?: string | null;
  card_note?: string | null;
  cheque_maturity_date?: string | null;
  cheque_no?: string | null;
  bank_name?: string | null;
  promissory_maturity_date?: string | null;
  account_type?: "resmi" | "gayri_resmi" | string | null;
  date: string | null;
  due_date?: string | null;
  status: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminPayment {
  id: string;
  customer_id: string | null;
  employee_id?: string | null;
  expense_card_id?: string | null;
  project_id: string | null;
  payment_plan_id: string | null;
  amount: number | string;
  account_type?: "resmi" | "gayri_resmi" | string | null;
  payment_date: string | null;
  payment_method: string | null;
  description: string | null;
  document_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminExpense {
  id: string;
  project_id: string | null;
  customer_id: string | null;
  title: string | null;
  category: string | null;
  amount: number | string;
  expense_date: string | null;
  description: string | null;
  document_url: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminExpenseCard {
  id: string;
  name: string;
  planned_total?: number;
  paid_total?: number;
  remaining_total?: number;
  entry_count?: number;
}

export interface AkExpenseTransaction {
  id: string;
  project_id: string;
  expense_item_id: string | null;
  expense_item_name_snapshot: string;
  amount: number | string;
  currency: string;
  exchange_rate_snapshot: number | string | null;
  exchange_rate_overridden: number | boolean;
  expense_date: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AkExpenseProfitability {
  realized: Record<string, string | number>;
  planned: Record<string, string | number>;
  today: string;
}

export interface AkExpenseTransactionsResponse {
  transactions: AkExpenseTransaction[];
  profitability: AkExpenseProfitability;
  project: { id: string; title: string } | null;
}

export interface AkExpenseItemsResponse {
  expense_items: AdminExpenseCard[];
}

export interface AdminEmployee {
  id: string;
  full_name: string;
  phone: string | null;
  role: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AkRole {
  id: string;
  name: string;
  normalized_name: string;
  is_active: number | boolean;
  created_at: string;
}

export interface AkEmployeeRole {
  employee_id: string;
  role_id: string;
  assigned_at: string;
  ended_at: string | null;
  role_name: string;
  normalized_name?: string;
  role_is_active?: number | boolean;
}

export interface AkEmployeeCostPeriod {
  id: string;
  employee_id: string;
  effective_from: string;
  effective_to: string | null;
  salary: string | number;
  sgk: string | number;
  meal: string | number;
  transportation: string | number;
  bonus: string | number;
  accommodation: string | number;
  other: string | number;
  notes: string | null;
  created_at: string;
}

export interface AkEmployeeProjectAssignment {
  id: string;
  employee_id: string;
  project_id: string;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  project_title?: string;
  employee_name?: string;
}

export interface AkEmployeeProjectAllocation {
  id: string;
  employee_id: string;
  project_id: string;
  allocation_year: number;
  allocation_month: number;
  days_worked: string | number;
  working_days_base: number;
  cost_date: string;
  salary_snapshot: string | number;
  sgk_snapshot: string | number;
  meal_snapshot: string | number;
  transportation_snapshot: string | number;
  bonus_snapshot: string | number;
  accommodation_snapshot: string | number;
  other_snapshot: string | number;
  monthly_cost_snapshot: string | number;
  calculated_cost: string | number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  project_title?: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  related_customer_id: string | null;
  related_project_id: string | null;
  related_payment_plan_id: string | null;
  is_read: boolean | number;
  created_at: string;
  // true only for live-derived upcoming/overdue-collection alerts (P2-3) —
  // computed fresh on every GET, never persisted, so read/delete on these
  // has no lasting effect. Absent/false for real ak_notifications rows.
  synthetic?: boolean;
}

export interface AdminFinancialEntry {
  id: string;
  project_id: string | null;
  entry_date: string;
  due_date?: string | null;
  card_type: CardType;
  customer_id: string | null;
  employee_id: string | null;
  expense_card_id: string | null;
  title: string;
  description: string | null;
  amount: number | string;
  currency_tag: CurrencyTag;
  group_tag: GroupTag;
  direction: EntryDirection;
  status: EntryStatus;
  document_url: string | null;
  is_legacy_expense?: boolean | number | null;
  is_legacy_payment?: boolean | number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type AdminFinancialStatementKind = "project" | "customer" | "employee" | "expense";

export type AdminProjectLookup = Pick<PublicProject, "id" | "title" | "location" | "project_status">;

export type AdminCustomerLookup = Pick<
  AdminCustomer,
  "id" | "customer_type" | "full_name" | "company_name" | "phone" | "email" | "tax_or_identity_number" | "status"
>;

export interface AdminFinancialStatementResponse {
  entity: AdminProjectLookup | AdminCustomerLookup | AdminEmployee | AdminExpenseCard | null;
  entries: AdminFinancialEntry[];
  projects: AdminProjectLookup[];
  customers: AdminCustomerLookup[];
  employees: AdminEmployee[];
  expense_cards: AdminExpenseCard[];
  payment_plans?: AdminPaymentPlan[];
  payments?: AdminPayment[];
}

export interface AdminCustomerListResponse {
  customers: AdminCustomer[];
  payment_plans: Pick<AdminPaymentPlan, "customer_id" | "amount">[];
  payments: Pick<AdminPayment, "customer_id" | "amount">[];
  financial_entries: AdminFinancialEntry[];
  customer_projects: AdminCustomerProjectLink[];
  projects: Pick<PublicProject, "id" | "title">[];
}

export type GovernmentPaymentStage = "Su Basmanı" | "Kaba İnşaat" | "İnce İnşaat" | "İskan" | "Belirtilmemiş";
export type GovernmentPaymentStatus = "planned" | "partial" | "paid" | "cancelled";

export interface GppBreakdown {
  id: string;
  government_progress_payment_id: string;
  stage: string;
  stage_percentage: number;
  planned_amount_try: number;
  paid_amount_try: number;
  due_date: string | null;
  paid_date: string | null;
  status: GovernmentPaymentStatus;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GppCollection {
  id: string;
  government_progress_payment_id: string;
  breakdown_id: string | null;
  project_id: string | null;
  customer_id: string | null;
  title: string;
  collection_date: string;
  amount_try: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  breakdown_stage?: string | null;
}

export interface GovernmentProgressPayment {
  id: string;
  project_id: string | null;
  customer_id: string | null;
  source_customer_financial_entry_id: string | null;
  title: string;
  stage: GovernmentPaymentStage;
  stage_percentage: number | string;
  planned_amount_try: number | string;
  paid_amount_try: number | string;
  due_date: string | null;
  paid_date: string | null;
  status: GovernmentPaymentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  project_title?: string | null;
  breakdowns: GppBreakdown[];
  collections: GppCollection[];
}

export interface GovernmentProgressPaymentPayload {
  project_id?: string | null;
  customer_id?: string | null;
  title: string;
  // Server always hardcodes stage to "Belirtilmemiş" on create/update — real
  // per-stage tracking lives in ak_government_progress_payment_breakdowns.
  // Optional here so callers that only manage plan-level fields (customer
  // detail's Hakediş dialog) don't need to fabricate a value that's ignored.
  stage?: GovernmentPaymentStage;
  stage_percentage?: number;
  planned_amount_try: number | string;
  paid_amount_try?: number | string;
  due_date?: string | null;
  paid_date?: string | null;
  status?: GovernmentPaymentStatus;
  notes?: string | null;
}

export interface AdminCustomerDetailResponse {
  customer: AdminCustomer | null;
  links: AdminCustomerProjectLink[];
  projects: Pick<PublicProject, "id" | "title" | "slug">[];
  payment_plans: AdminPaymentPlan[];
  payments: AdminPayment[];
  financial_entries: AdminFinancialEntry[];
  expenses: Record<string, unknown>[];
  government_progress_payments?: GovernmentProgressPayment[];
}

export interface AdminPaymentsResponse {
  payments: AdminPayment[];
  customers: AdminCustomer[];
  projects: Pick<PublicProject, "id" | "title">[];
  payment_plans: Pick<AdminPaymentPlan, "id" | "title" | "customer_id" | "project_id" | "amount" | "due_date" | "status">[];
}

export interface AdminFinanceSummaryResponse {
  payment_plans: AdminPaymentPlan[];
  payments: AdminPayment[];
  expenses: AdminExpense[];
  financial_entries: AdminFinancialEntry[];
  customers: AdminCustomer[];
  projects: Pick<PublicProject, "id" | "title" | "slug">[];
}

export interface AdminExpensesResponse {
  expenses: AdminExpense[];
  customers: AdminCustomer[];
  projects: Pick<PublicProject, "id" | "title">[];
}

export interface AdminExpenseCardsResponse {
  expense_items: AdminExpenseCard[];
}

export interface AdminEmployeesResponse {
  employees: AdminEmployee[];
}

export interface AkRolesResponse {
  roles: AkRole[];
}

export interface AkEmployeeRolesResponse {
  employee_roles: AkEmployeeRole[];
}

export interface AkEmployeeCostPeriodsResponse {
  cost_periods: AkEmployeeCostPeriod[];
}

export interface AkEmployeeProjectAssignmentsResponse {
  assignments: AkEmployeeProjectAssignment[];
}

export interface AkEmployeeProjectAllocationsResponse {
  allocations: AkEmployeeProjectAllocation[];
}

export interface AdminNotificationsResponse {
  notifications: AdminNotification[];
  unread_count?: number;
  total_count?: number;
}

export interface AdminMarketRate {
  code: "gold" | "usd" | "eur";
  label: string;
  value: number | null;
  change_percent: number | null;
}

export interface AdminMarketRatesResponse {
  rates: AdminMarketRate[];
  source: string;
  stale: boolean;
  fetched_at: string;
}

export interface AdminReportsResponse {
  customers: AdminCustomer[];
  payment_plans: AdminPaymentPlan[];
  payments: AdminPayment[];
  expenses: AdminExpense[];
  financial_entries: AdminFinancialEntry[];
  projects: PublicProject[];
  customer_projects: AdminCustomerProjectLink[];
  contact_requests: AdminContactRequest[];
  aggregates: {
    total_projects: number;
    total_customers: number;
    total_payments: number;
    total_expenses: number;
    total_contact_requests: number;
  };
}

export interface AdminSqlEditorResult {
  statement_type: string;
  is_select: boolean;
  destructive: boolean;
  columns: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  affected_rows: number | null;
  executed_at: string;
}

export type ConsentStatus = "accepted" | "rejected" | "managed";

// ── New card-based finance architecture types ──────────────────────────────────

export type SupplierType =
  | "supplier"
  | "subcontractor"
  | "labor_service"
  | "equipment_rental"
  | "crane_rental"
  | "other";

export interface AdminSupplier {
  id: string;
  name: string;
  supplier_type: SupplierType;
  contact_person: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  tax_no: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  notes: string | null;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
}

export type CardEntryStatus =
  | "Planlanan"
  | "Gecikmiş"
  | "Kısmi Ödendi"
  | "Gerçekleşti"
  | "Fazla Ödendi";

export type CardEntryCurrency = "TRY" | "USD" | "EUR" | "XAU_GRAM";
export type CardEntryAccountType = "resmi" | "gayri_resmi";
export type CardEntryPaymentMethod =
  | "Nakit"
  | "Banka Havalesi/EFT"
  | "Kredi Kartı"
  | "Çek"
  | "Senet"
  | "Diğer";
export type CardEntryRateSource = "api" | "manual" | "default";

export interface InflationPreview {
  enabled: boolean;
  base_period?: string;
  target_period?: string;
  months_used?: string[];
  official_months_count?: number;
  forecast_months_count?: number;
  official_compound_rate_percent?: number;
  forecast_compound_rate_percent?: number;
  total_compound_rate_percent?: number;
  factor?: number;
  rate_percent?: number;
  principal_amount?: number;
  adjusted_amount?: number;
  current_collectible_amount?: number;
  inflation_difference?: number;
  used_forecast?: boolean;
  forecast_method?: string | null;
  forecast_note?: string | null;
  warning?: string | null;
}

export interface CardFinancialEntry {
  id: string;
  project_id: string | null;
  entry_date: string;
  title: string;
  notes: string | null;
  amount: number;
  paid_amount: number;
  remaining_amount?: number;
  currency: CardEntryCurrency;
  exchange_rate_to_try: number;
  exchange_rate_source: CardEntryRateSource;
  exchange_rate_snapshot_at: string | null;
  is_exchange_rate_manual: number | boolean;
  amount_try: number;
  paid_amount_try: number;
  remaining_amount_try?: number;
  account_type: CardEntryAccountType;
  payment_method: CardEntryPaymentMethod;
  status: CardEntryStatus;
  is_overdue: number | boolean;
  created_at: string;
  updated_at: string;
  // Joined fields (may be present depending on query)
  owner_name?: string;
  project_title?: string;
  // Inflation adjustment (customer entries only)
  inflation_enabled?: number;
  inflation_start_date?: string | null;
  inflation_preview?: InflationPreview | null;
}

export interface CustomerFinancialEntry extends CardFinancialEntry {
  customer_id: string;
  source_type?: "customer";
}

export interface EmployeeFinancialEntry extends CardFinancialEntry {
  employee_id: string;
  source_type?: "employee";
}

export interface SupplierFinancialEntry extends CardFinancialEntry {
  supplier_id: string;
  source_type?: "supplier";
}

export interface ExpenseCardFinancialEntry extends CardFinancialEntry {
  expense_card_id: string;
  source_type?: "expense_card";
}

// Normalized union row from project-statement.php and gidenler.php
export type CardEntrySourceType = "customer" | "employee" | "supplier" | "expense_card" | "government";

export interface ProjectStatementRow {
  id: string;
  source_type: CardEntrySourceType;
  source_label: string;
  owner_id: string;
  owner_name: string;
  project_id: string;
  project_name: string;
  entry_date: string;
  title: string;
  notes: string | null;
  direction: "income" | "expense";
  sign: 1 | -1;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  currency: CardEntryCurrency;
  exchange_rate_to_try: number;
  exchange_rate_source: CardEntryRateSource;
  exchange_rate_snapshot_at: string | null;
  is_exchange_rate_manual: number | boolean;
  amount_try: number;
  paid_amount_try: number;
  remaining_amount_try: number;
  signed_amount_try: number;
  signed_paid_amount_try: number;
  account_type: CardEntryAccountType;
  payment_method: CardEntryPaymentMethod;
  status: CardEntryStatus;
  is_overdue: number | boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectStatementSummary {
  total_income_planned: number;
  total_income_paid: number;
  total_income_remaining: number;
  customer_income_planned: number;
  customer_income_paid: number;
  government_income_planned: number;
  government_income_paid: number;
  customer_income_inflation_adjusted?: number | null;
  total_expense_planned: number;
  total_expense_paid: number;
  total_expense_remaining: number;
  realized_profit: number;
  planned_profit: number;
  row_count: number;
}

export interface ProjectStatementResponse {
  project: { id: string; title: string; contract_total_try?: number | null };
  rows: ProjectStatementRow[];
  summary: ProjectStatementSummary;
}

export interface GelenlerSummary {
  total_planned: number;
  total_paid: number;
  total_remaining: number;
  overdue_count: number;
  row_count: number;
}

export interface GelenlerEntry {
  id: string;
  source_type: "customer" | "government";
  source_label: string;
  owner_name: string | null;
  project_title: string | null;
  entry_date: string;
  title: string;
  notes: string | null;
  // null for government progress payments — that table has no account_type column.
  account_type: "resmi" | "gayri_resmi" | null;
  amount_try: number | string;
  paid_amount_try: number | string;
  remaining_amount_try?: number | string;
  status: string;
  is_overdue: number | boolean;
  created_at: string;
  [key: string]: unknown;
}

export interface GelenlerResponse {
  entries: GelenlerEntry[];
  summary: GelenlerSummary;
  projects: { id: string; title: string }[];
  customers: { id: string; name: string }[];
}

export interface GidenlerSummary {
  total_planned: number;
  total_paid: number;
  total_remaining: number;
  by_source_type_paid: { employee: number; supplier: number; expense_card: number };
  overdue_count: number;
  row_count: number;
}

export interface GidenlerEntry extends CardFinancialEntry {
  owner_id: string;
  owner_name: string;
  source_type: "employee" | "supplier" | "expense_card";
  source_label: string;
  project_title: string;
}

export interface GidenlerResponse {
  entries: GidenlerEntry[];
  summary: GidenlerSummary;
  projects: { id: string; title: string }[];
}

// Payload types for creating/updating entries
export interface CardFinancialEntryPayload {
  project_id?: string | null;
  entry_date: string;
  title: string;
  notes?: string | null;
  amount: number | string;
  paid_amount?: number | string;
  currency: CardEntryCurrency;
  exchange_rate_to_try?: number | string;
  exchange_rate_source?: CardEntryRateSource;
  is_exchange_rate_manual?: boolean | number;
  account_type?: CardEntryAccountType;
  payment_method?: CardEntryPaymentMethod;
  inflation_enabled?: number;
  inflation_start_date?: string | null;
}

export interface AdminSuppliersResponse {
  suppliers: AdminSupplier[];
}

export interface AdminSupplierResponse {
  supplier: AdminSupplier;
}

export interface AdminSupplierEntriesResponse {
  entries: SupplierFinancialEntry[];
}

export interface AdminCustomerEntriesResponse {
  entries: CustomerFinancialEntry[];
}

export interface AdminEmployeeEntriesResponse {
  entries: EmployeeFinancialEntry[];
}

export interface AdminExpenseCardEntriesResponse {
  entries: ExpenseCardFinancialEntry[];
}

export interface CookieConsentPayload {
  consent_status: ConsentStatus;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

// ── Backup Center ─────────────────────────────────────────────────────────────

export interface BackupRun {
  id: string;
  run_type: string;
  status: "running" | "success" | "success_with_warnings" | "failed";
  started_at: string;
  finished_at: string | null;
  package_name: string | null;
  site_archive_size: number | null;
  db_archive_size: number | null;
  backend_archive_size: number | null;
  uploads_archive_size: number | null;
  total_size: number | null;
  checksum_site: string | null;
  checksum_db: string | null;
  checksum_backend: string | null;
  checksum_uploads: string | null;
  drive_folder_id: string | null;
  drive_folder_name: string | null;
  db_dump_method: string | null;
  error_message: string | null;
  success_email_sent_at: string | null;
  notification_status: "notification_sent" | "notification_failed" | "notification_not_configured" | "notification_sending" | null;
  notification_detail: string | null;
  created_at: string;
}

export interface BackupAuditLogEntry {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

export interface BackupDriveFile {
  id: string;
  name: string;
  size: number;
}

export interface BackupDriveFolder {
  id: string;
  name: string;
  created_at: string | null;
  size: number;
  file_count: number;
  status: "complete" | "partial" | "incomplete" | "unknown";
  status_label: string;
  db_dump_method: string | null;
  checksums: Record<string, string>;
  files: BackupDriveFile[];
}

export interface BackupCapabilities {
  zip_extension: boolean;
  openssl_extension: boolean;
  curl_extension: boolean;
  exec_available: boolean;
  mysqldump_available: boolean;
  mail_function: boolean;
  encryption_key_configured: boolean;
  gdrive_configured: boolean;
  alert_email_configured: boolean;
  success_email_configured: boolean;
  db_dump_method: string;
}

export type BackupDriveDiagnosticState =
  | "not_configured"
  | "credentials_problem"
  | "auth_failed"
  | "folder_inaccessible"
  | "connected";

export interface BackupDriveDiagnostics {
  state: BackupDriveDiagnosticState;
  message: string;
}

export interface BackupSchedule {
  configured_in_code: boolean;
  expression: string;
  label: string;
  confirmed_by_recent_run: boolean;
  last_run_at: string | null;
}

export interface BackupDashboardResponse {
  capabilities: BackupCapabilities;
  full_recovery_available: boolean;
  drive_diagnostics: BackupDriveDiagnostics;
  schedule: BackupSchedule;
  retention_limit: number;
  retained_count: number;
  last_full_success: BackupRun | null;
  last_partial: BackupRun | null;
  last_failure: BackupRun | null;
  history: BackupRun[];
  audit_log: BackupAuditLogEntry[];
  drive_backups: BackupDriveFolder[];
  drive_error: string | null;
}

export interface BackupChecksumResult {
  file: string;
  status: "match" | "mismatch" | "missing" | "empty";
  expected?: string;
  actual?: string;
  size?: number;
}

export interface BackupValidationReport {
  batch_id: string;
  staged_files: string[];
  manifest_found: boolean;
  manifest_version_ok: boolean;
  checksums_found: boolean;
  checksum_results: BackupChecksumResult[];
  issues: string[];
  valid: boolean;
  manifest: Record<string, unknown> | null;
}

export interface BackupRunNowResult {
  run_id: string;
  status: "success" | "success_with_warnings";
  package_name: string;
  created_at: string;
}
