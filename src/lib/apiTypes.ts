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
  amount: number | string;
  date: string | null;
  direction: string | null;
  card_type: string | null;
  currency: string | null;
  group: string | null;
  status: string | null;
  project_title: string | null;
}

export interface AdminDashboardMonthlyFinancial {
  month_key: string;
  income: number | string;
  expenses: number | string;
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
  employee_id?: string | null;
  expense_card_id?: string | null;
  project_id: string | null;
  title: string | null;
  description: string | null;
  amount: number | string;
  paid_amount?: number | string | null;
  payment_method?: string | null;
  transaction_reference?: string | null;
  card_note?: string | null;
  cheque_maturity_date?: string | null;
  cheque_no?: string | null;
  bank_name?: string | null;
  promissory_maturity_date?: string | null;
  account_type?: "resmi" | "gayri_resmi" | string | null;
  due_date: string | null;
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
  category: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
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

export interface AdminCustomerDetailResponse {
  customer: AdminCustomer | null;
  links: AdminCustomerProjectLink[];
  projects: Pick<PublicProject, "id" | "title" | "slug">[];
  payment_plans: AdminPaymentPlan[];
  payments: AdminPayment[];
  financial_entries: AdminFinancialEntry[];
  expenses: Record<string, unknown>[];
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
  expense_cards: AdminExpenseCard[];
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

export interface CookieConsentPayload {
  consent_status: ConsentStatus;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}
