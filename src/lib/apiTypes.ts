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

export interface AdminCustomerNote {
  id: string;
  customer_id: string;
  note: string;
  created_at: string;
}

export interface AdminCustomerListResponse {
  customers: AdminCustomer[];
  payment_plans: Pick<AdminPaymentPlan, "customer_id" | "amount">[];
  payments: Pick<AdminPayment, "customer_id" | "amount">[];
  customer_projects: AdminCustomerProjectLink[];
  projects: Pick<PublicProject, "id" | "title">[];
}

export interface AdminCustomerDetailResponse {
  customer: AdminCustomer | null;
  links: AdminCustomerProjectLink[];
  projects: Pick<PublicProject, "id" | "title" | "slug">[];
  payment_plans: AdminPaymentPlan[];
  payments: AdminPayment[];
  expenses: Record<string, unknown>[];
  notes: AdminCustomerNote[];
  documents: Record<string, unknown>[];
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
