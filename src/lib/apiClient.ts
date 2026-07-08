import type {
  AdminUser,
  AdminContactRequest,
  AdminCustomer,
  AdminCustomerDetailResponse,
  AdminCustomerListResponse,
  AdminDashboardResponse,
  AdminPayment,
  AdminPaymentPlan,
  AdminPaymentsResponse,
  AdminExpense,
  AdminExpenseCard,
  AdminExpenseCardsResponse,
  AdminExpensesResponse,
  AdminEmployee,
  AdminEmployeesResponse,
  AdminFinancialEntry,
  AdminFinancialStatementKind,
  AdminFinancialStatementResponse,
  AdminFinanceSummaryResponse,
  AdminMarketRatesResponse,
  AdminNotification,
  AdminNotificationsResponse,
  AdminReportsResponse,
  AdminSqlEditorResult,
  AkRole,
  AkRolesResponse,
  AkEmployeeRole,
  AkEmployeeRolesResponse,
  AkEmployeeCostPeriod,
  AkEmployeeCostPeriodsResponse,
  AkEmployeeProjectAssignment,
  AkEmployeeProjectAssignmentsResponse,
  AkEmployeeProjectAllocation,
  AkEmployeeProjectAllocationsResponse,
  AkExpenseTransaction,
  AkExpenseTransactionsResponse,
  ContactRequestPayload,
  CookieConsentPayload,
  ProjectDetailResponse,
  PublicProject,
  SiteSettings,
  AdminSupplier,
  AdminSuppliersResponse,
  AdminSupplierResponse,
  CustomerFinancialEntry,
  EmployeeFinancialEntry,
  SupplierFinancialEntry,
  ExpenseCardFinancialEntry,
  AdminCustomerEntriesResponse,
  AdminEmployeeEntriesResponse,
  AdminSupplierEntriesResponse,
  AdminExpenseCardEntriesResponse,
  CardFinancialEntryPayload,
  ProjectStatementResponse,
  GelenlerResponse,
  GidenlerResponse,
} from "@/lib/apiTypes";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  details?: unknown;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "API isteği başarısız oldu.");
  }

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`API geçersiz JSON yanıtı döndürdü (${response.status}).`);
  }

  if (!response.ok) {
    throw new ApiError(payload.message || `API isteği ${response.status} durum koduyla başarısız oldu.`, response.status);
  }

  if (!payload.success) {
    throw new Error(payload.message || "API isteği başarılı olmadı.");
  }

  return (payload.data ?? ({} as T)) as T;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  try {
    response = await fetch(path, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "API isteği başarısız oldu.");
  }

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`API geçersiz JSON yanıtı döndürdü (${response.status}).`);
  }

  if (!response.ok) {
    throw new ApiError(payload.message || `API isteği ${response.status} durum koduyla başarısız oldu.`, response.status);
  }

  if (!payload.success) {
    throw new Error(payload.message || "API isteği başarılı olmadı.");
  }

  return (payload.data ?? ({} as T)) as T;
}

function normalizeProject(project: PublicProject): PublicProject {
  return {
    ...project,
    is_published: project.is_published === true || project.is_published === 1 || project.is_published === "1",
    is_featured: project.is_featured === true || project.is_featured === 1 || project.is_featured === "1",
  };
}

function normalizeProjects(projects: PublicProject[]): PublicProject[] {
  return projects.map(normalizeProject);
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const data = await apiGet<{ settings: SiteSettings | null }>("/api/site-settings.php");
  return data.settings || null;
}

export async function getPublishedProjects(): Promise<PublicProject[]> {
  const data = await apiGet<{ projects: PublicProject[] }>("/api/projects.php");
  return data.projects || [];
}

export async function getProjectDetail(slug: string): Promise<ProjectDetailResponse> {
  return apiGet<ProjectDetailResponse>(`/api/project-detail.php?slug=${encodeURIComponent(slug)}`);
}

export async function loginAdmin(email: string, password: string): Promise<AdminUser> {
  const data = await apiRequest<{ admin: AdminUser }>("/api/admin/login.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return data.admin;
}

export async function logoutAdmin(): Promise<void> {
  await apiRequest<{ logged_out: boolean }>("/api/admin/logout.php", {
    method: "POST",
    credentials: "include",
  });
}

export async function getCurrentAdmin(): Promise<AdminUser> {
  const data = await apiRequest<{ admin: AdminUser }>("/api/admin/me.php", {
    method: "GET",
    credentials: "include",
  });
  return data.admin;
}

export async function submitContactRequest(payload: ContactRequestPayload): Promise<void> {
  await apiRequest<{ id: string }>("/api/contact-request.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitCookieConsent(payload: CookieConsentPayload): Promise<void> {
  await apiRequest<{ stored: boolean }>("/api/cookie-consent.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitSalesChatbotMessage(payload: { message: string; history: { role: string; text: string }[] }): Promise<{ reply: string | null; fallback?: boolean }> {
  return apiRequest<{ reply: string | null; fallback?: boolean }>("/api/sales-chatbot.php", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminSiteSettings(): Promise<SiteSettings | null> {
  const data = await apiRequest<{ settings: SiteSettings | null }>("/api/admin/site-settings.php", {
    method: "GET",
    credentials: "include",
  });
  return data.settings || null;
}

export async function updateAdminSiteSettings(payload: SiteSettings): Promise<SiteSettings | null> {
  const data = await apiRequest<{ settings: SiteSettings | null }>("/api/admin/site-settings.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.settings || null;
}

export async function uploadAdminSiteAsset(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);

  const data = await apiRequest<{ url: string }>("/api/admin/upload-site-asset.php", {
    method: "POST",
    credentials: "include",
    body: form,
    headers: {},
  });
  return data.url;
}

export async function getAdminPushConfig(): Promise<{ public_key: string; configured: boolean }> {
  return apiRequest<{ public_key: string; configured: boolean }>("/api/admin/push-subscribe.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ action: "config" }),
  });
}

export async function subscribeAdminPush(subscription: PushSubscriptionJSON): Promise<void> {
  await apiRequest<{ subscribed: boolean }>("/api/admin/push-subscribe.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ subscription }),
  });
}

export async function unsubscribeAdminPush(endpoint: string): Promise<void> {
  await apiRequest<{ unsubscribed: boolean }>("/api/admin/push-unsubscribe.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ endpoint }),
  });
}

export async function sendAdminPushTest(): Promise<{ sent: number; failed: number; skipped?: boolean; reason?: string; errors?: Array<{ status?: number; error?: string | null; message?: string | null; response?: string | null }> }> {
  return apiRequest<{ sent: number; failed: number; skipped?: boolean; reason?: string; errors?: Array<{ status?: number; error?: string | null; message?: string | null; response?: string | null }> }>("/api/admin/send-push-test.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({}),
  });
}

export async function getAdminProjects(): Promise<PublicProject[]> {
  const data = await apiRequest<{ projects: PublicProject[] }>("/api/admin/projects.php", {
    method: "GET",
    credentials: "include",
  });
  return normalizeProjects(data.projects || []);
}

export async function getAdminProject(id: string): Promise<PublicProject | null> {
  const data = await apiRequest<{ project: PublicProject | null }>(`/api/admin/projects.php?id=${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
  });
  return data.project ? normalizeProject(data.project) : null;
}

export async function createAdminProject(payload: Partial<PublicProject>): Promise<PublicProject> {
  const data = await apiRequest<{ project: PublicProject }>("/api/admin/projects.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return normalizeProject(data.project);
}

export async function updateAdminProject(payload: Partial<PublicProject> & { id: string }): Promise<PublicProject> {
  const data = await apiRequest<{ project: PublicProject }>("/api/admin/projects.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return normalizeProject(data.project);
}

export async function deleteAdminProject(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/projects.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getAdminProjectImages(projectId?: string): Promise<ProjectImage[]> {
  const path = projectId ? `/api/admin/project-images.php?project_id=${encodeURIComponent(projectId)}` : "/api/admin/project-images.php";
  const data = await apiRequest<{ images: ProjectImage[] }>(path, {
    method: "GET",
    credentials: "include",
  });
  return data.images || [];
}

export async function createAdminProjectImage(payload: Partial<ProjectImage> & { project_id: string; image_url: string }): Promise<ProjectImage> {
  const data = await apiRequest<{ image: ProjectImage }>("/api/admin/project-images.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.image;
}

export async function updateAdminProjectImage(payload: Partial<ProjectImage> & { id: string }): Promise<ProjectImage> {
  const data = await apiRequest<{ image: ProjectImage }>("/api/admin/project-images.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.image;
}

export async function deleteAdminProjectImage(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/project-images.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export type AdminMediaImage = ProjectImage & {
  project_title?: string | null;
  project_slug?: string | null;
  file_name?: string | null;
  source_type?: string | null;
  source_label?: string | null;
  can_delete?: boolean;
  is_protected?: boolean;
  protected_reason?: string | null;
  projects?: { title?: string | null; slug?: string | null };
  album_ids?: string[];
};

export interface MediaAlbum {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_favorite: boolean;
  item_count: number;
  created_at: string;
}

export async function getAdminMedia(): Promise<AdminMediaImage[]> {
  const data = await apiRequest<{ images: AdminMediaImage[] }>("/api/admin/media.php", {
    method: "GET",
    credentials: "include",
  });
  return (data.images || []).map((image) => ({
    ...image,
    projects: {
      title: image.project_title || null,
      slug: image.project_slug || null,
    },
  }));
}

export async function deleteAdminMediaImage(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/media.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function deleteAdminMediaPath(path: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/media.php?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function uploadAdminMediaImage(file: File): Promise<AdminMediaImage> {
  const form = new FormData();
  form.append("file", file, file.name);

  const data = await apiRequest<{ image: AdminMediaImage }>("/api/admin/media-upload.php", {
    method: "POST",
    credentials: "include",
    body: form,
    headers: {},
  });
  return data.image;
}

export async function getAdminMediaAlbums(): Promise<MediaAlbum[]> {
  const data = await apiRequest<{ albums: MediaAlbum[] }>("/api/admin/media-albums.php", {
    method: "GET",
    credentials: "include",
  });
  return data.albums || [];
}

export async function createAdminMediaAlbum(name: string, color?: string): Promise<MediaAlbum> {
  const data = await apiRequest<{ album: MediaAlbum }>("/api/admin/media-albums.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ action: "create", name, color: color ?? null }),
  });
  return data.album;
}

export async function updateAdminMediaAlbum(id: string, patch: { name?: string; color?: string | null }): Promise<MediaAlbum> {
  const data = await apiRequest<{ album: MediaAlbum }>(`/api/admin/media-albums.php?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(patch),
  });
  return data.album;
}

export async function deleteAdminMediaAlbum(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/media-albums.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function assignMediaToAlbum(albumId: string, mediaId: string): Promise<void> {
  await apiRequest<{ assigned: boolean }>("/api/admin/media-albums.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ action: "assign", album_id: albumId, media_id: mediaId }),
  });
}

export async function removeMediaFromAlbum(albumId: string, mediaId: string): Promise<void> {
  await apiRequest<{ removed: boolean }>("/api/admin/media-albums.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ action: "remove", album_id: albumId, media_id: mediaId }),
  });
}

// ─── Inflation Indices ───────────────────────────────────────────────────────

export interface InflationIndex {
  id: string;
  index_type: string;
  period_year: number;
  period_month: number;
  /** Yearly-base derived index (Jan=100 each year). Kept for backward compatibility
   *  with finance/receivables integrations. NOT used by the calculator. */
  index_value: number | null;
  monthly_change_percent: number | null;
  annual_change_percent: number | null;
  source: string | null;
  created_at: string;
}

/** Result of the compound monthly inflation calculation. */
export interface InflationCalculationResult {
  amount_try: number;
  /** Compound factor: product of (1 + monthly_change_percent/100) for each month in range */
  factor: number;
  /** (factor - 1) × 100 — effective inflation rate over the selected period */
  rate_percent: number;
  adjusted_amount: number;
  difference: number;
  /** Ordered list of YYYY-MM strings for every month compounded (base+1 through target) */
  months_used: string[];
  base_period: string;
  target_period: string;
}

export interface InflationIndicesResponse {
  indices: InflationIndex[];
  sync_warning: string | null;
  last_synced_period: string | null;
  active_index_type: string;
}

export async function getInflationIndices(): Promise<InflationIndicesResponse> {
  return apiRequest<InflationIndicesResponse>(
    "/api/admin/inflation-indices.php",
    { method: "GET", credentials: "include" },
  );
}

export async function calculateInflation(payload: {
  amount_try: number;
  base_year: number;
  base_month: number;
  target_year: number;
  target_month: number;
  index_type?: string;
}): Promise<InflationCalculationResult> {
  return apiRequest<InflationCalculationResult>("/api/admin/inflation-indices.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ action: "calculate", ...payload }),
  });
}


export async function uploadAdminProjectImage(file: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", file, filename);

  const data = await apiRequest<{ url: string }>("/api/admin/upload-project-image.php", {
    method: "POST",
    credentials: "include",
    body: form,
    headers: {},
  });
  return data.url;
}

export async function getAdminContactRequests(filters: { q?: string; status?: string } = {}): Promise<AdminContactRequest[]> {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = await apiRequest<{ requests: AdminContactRequest[] }>(`/api/admin/contact-requests.php${suffix}`, {
    method: "GET",
    credentials: "include",
  });
  return data.requests || [];
}

export async function updateAdminContactRequestStatus(id: string, status: string): Promise<AdminContactRequest> {
  const data = await apiRequest<{ request: AdminContactRequest }>("/api/admin/contact-requests.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify({ id, status }),
  });
  return data.request;
}

export async function deleteAdminContactRequest(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/contact-requests.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getAdminDashboard(): Promise<AdminDashboardResponse> {
  return apiRequest<AdminDashboardResponse>("/api/admin/dashboard.php", {
    method: "GET",
    credentials: "include",
  });
}

export async function getAdminCustomersData(): Promise<AdminCustomerListResponse> {
  return apiRequest<AdminCustomerListResponse>("/api/admin/customers.php", {
    method: "GET",
    credentials: "include",
  });
}

export async function getAdminCustomerDetail(id: string): Promise<AdminCustomerDetailResponse> {
  return apiRequest<AdminCustomerDetailResponse>(`/api/admin/customers.php?id=${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
  });
}

export async function createAdminCustomer(payload: Partial<AdminCustomer> & { project_ids?: string[] }): Promise<AdminCustomer> {
  const data = await apiRequest<{ customer: AdminCustomer }>("/api/admin/customers.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.customer;
}

export async function updateAdminCustomer(payload: Partial<AdminCustomer> & { id: string; project_ids?: string[] }): Promise<AdminCustomer> {
  const data = await apiRequest<{ customer: AdminCustomer }>("/api/admin/customers.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.customer;
}

export async function deleteAdminCustomer(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/customers.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getAdminPaymentPlans(): Promise<{ payment_plans: AdminPaymentPlan[]; customers: any[]; projects: any[] }> {
  return apiRequest("/api/admin/payment-plans.php", { credentials: "include" });
}

export async function createAdminPaymentPlan(payload: Partial<AdminPaymentPlan>): Promise<AdminPaymentPlan> {
  const data = await apiRequest<{ payment_plan: AdminPaymentPlan }>("/api/admin/payment-plans.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.payment_plan;
}

export async function updateAdminPaymentPlan(payload: Partial<AdminPaymentPlan> & { id: string }): Promise<AdminPaymentPlan> {
  const data = await apiRequest<{ payment_plan: AdminPaymentPlan }>("/api/admin/payment-plans.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.payment_plan;
}

export async function deleteAdminPaymentPlan(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/payment-plans.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getAdminPaymentsData(): Promise<AdminPaymentsResponse> {
  return apiRequest<AdminPaymentsResponse>("/api/admin/payments.php", {
    method: "GET",
    credentials: "include",
  });
}

export async function createAdminPayment(payload: Partial<AdminPayment>): Promise<AdminPayment> {
  const data = await apiRequest<{ payment: AdminPayment }>("/api/admin/payments.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.payment;
}

export async function updateAdminPayment(payload: Partial<AdminPayment> & { id: string }): Promise<AdminPayment> {
  const data = await apiRequest<{ payment: AdminPayment }>("/api/admin/payments.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.payment;
}

export async function deleteAdminPayment(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/payments.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function uploadAdminPaymentDocument(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);

  const data = await apiRequest<{ url: string }>("/api/admin/upload-payment-document.php", {
    method: "POST",
    credentials: "include",
    body: form,
    headers: {},
  });
  return data.url;
}

export async function getAdminFinanceSummary(): Promise<AdminFinanceSummaryResponse> {
  return apiRequest<AdminFinanceSummaryResponse>("/api/admin/finance-summary.php", {
    method: "GET",
    credentials: "include",
  });
}

export async function getAdminFinancialStatement(kind: AdminFinancialStatementKind, id: string): Promise<AdminFinancialStatementResponse> {
  const params = new URLSearchParams({ kind, id });
  return apiRequest<AdminFinancialStatementResponse>(`/api/admin/financial-statement.php?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  });
}

export async function createAdminFinancialEntry(payload: Partial<AdminFinancialEntry>): Promise<AdminFinancialEntry> {
  const data = await apiRequest<{ entry: AdminFinancialEntry }>("/api/admin/financial-statement.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.entry;
}

export async function updateAdminFinancialEntry(payload: Partial<AdminFinancialEntry> & { id: string }): Promise<AdminFinancialEntry> {
  const data = await apiRequest<{ entry: AdminFinancialEntry }>("/api/admin/financial-statement.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.entry;
}

export async function deleteAdminFinancialEntry(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/financial-statement.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getAdminExpensesData(): Promise<AdminExpensesResponse> {
  return apiRequest<AdminExpensesResponse>("/api/admin/expenses.php", {
    method: "GET",
    credentials: "include",
  });
}

export async function createAdminExpense(payload: Partial<AdminExpense>): Promise<AdminExpense> {
  const data = await apiRequest<{ expense: AdminExpense }>("/api/admin/expenses.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.expense;
}

export async function updateAdminExpense(payload: Partial<AdminExpense> & { id: string }): Promise<AdminExpense> {
  const data = await apiRequest<{ expense: AdminExpense }>("/api/admin/expenses.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.expense;
}

export async function deleteAdminExpense(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/expenses.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function uploadAdminExpenseDocument(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name);

  const data = await apiRequest<{ url: string }>("/api/admin/upload-expense-document.php", {
    method: "POST",
    credentials: "include",
    body: form,
    headers: {},
  });
  return data.url;
}

export async function getAdminExpenseItems(q?: string): Promise<AdminExpenseCard[]> {
  const params = q ? `?q=${encodeURIComponent(q)}` : "";
  const data = await apiRequest<AdminExpenseCardsResponse>(`/api/admin/expense-cards.php${params}`, {
    method: "GET",
    credentials: "include",
  });
  return data.expense_items || [];
}

export async function createAdminExpenseItem(payload: { name: string }): Promise<AdminExpenseCard> {
  const data = await apiRequest<{ expense_item: AdminExpenseCard }>("/api/admin/expense-cards.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.expense_item;
}

export async function updateAdminExpenseItem(payload: { id: string; name: string }): Promise<AdminExpenseCard> {
  const data = await apiRequest<{ expense_item: AdminExpenseCard }>("/api/admin/expense-cards.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.expense_item;
}

export async function deleteAdminExpenseItem(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/expense-cards.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

// ── Project Expense Transactions ───────────────────────────────────────────────

export async function getProjectExpenseTransactions(projectId: string): Promise<AkExpenseTransactionsResponse> {
  return apiRequest<AkExpenseTransactionsResponse>(
    `/api/admin/project-expense-transactions.php?project_id=${encodeURIComponent(projectId)}`,
    { method: "GET", credentials: "include" }
  );
}

export async function createProjectExpenseTransaction(payload: {
  project_id: string;
  expense_item_id: string | null;
  expense_item_name_snapshot: string;
  amount: number;
  currency: string;
  exchange_rate_snapshot?: number | null;
  exchange_rate_overridden?: boolean;
  expense_date: string;
}): Promise<AkExpenseTransaction> {
  const data = await apiRequest<{ transaction: AkExpenseTransaction }>("/api/admin/project-expense-transactions.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.transaction;
}

export async function updateProjectExpenseTransaction(payload: {
  id: string;
  project_id: string;
  expense_item_id: string | null;
  expense_item_name_snapshot: string;
  amount: number;
  currency: string;
  exchange_rate_snapshot?: number | null;
  exchange_rate_overridden?: boolean;
  expense_date: string;
}): Promise<AkExpenseTransaction> {
  const data = await apiRequest<{ transaction: AkExpenseTransaction }>("/api/admin/project-expense-transactions.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.transaction;
}

export async function deleteProjectExpenseTransaction(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/project-expense-transactions.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

// Legacy aliases kept for components that still reference old names (will be removed when those components are updated)
export const getAdminExpenseCards = getAdminExpenseItems;
export const createAdminExpenseCard = (p: Partial<AdminExpenseCard>) => createAdminExpenseItem({ name: p.name ?? "" });
export const updateAdminExpenseCard = (p: Partial<AdminExpenseCard> & { id: string }) => updateAdminExpenseItem({ id: p.id, name: p.name ?? "" });
export const deleteAdminExpenseCard = deleteAdminExpenseItem;

export async function getAdminNotifications(limit?: number): Promise<AdminNotificationsResponse> {
  const params = new URLSearchParams({ generate: "1" });
  if (limit) {
    params.set("limit", String(limit));
  }
  const data = await apiRequest<AdminNotificationsResponse>(`/api/admin/notifications.php?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  return {
    notifications: data.notifications || [],
    unread_count: data.unread_count || 0,
    total_count: data.total_count || 0,
  };
}

export async function getAdminMarketRates(): Promise<AdminMarketRatesResponse> {
  return apiRequest<AdminMarketRatesResponse>(`/api/admin/market-rates.php?t=${Date.now()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
}

export async function updateAdminNotificationRead(id: string, isRead = true): Promise<AdminNotification> {
  const data = await apiRequest<{ notification: AdminNotification }>("/api/admin/notifications.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify({ id, is_read: isRead }),
  });
  return data.notification;
}

export async function markAllAdminNotificationsRead(): Promise<void> {
  await apiRequest<{ updated: boolean }>("/api/admin/notifications.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify({ all: true }),
  });
}

export async function deleteAdminNotification(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/notifications.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function deleteAllAdminNotifications(): Promise<void> {
  await apiRequest<{ deleted: boolean; deleted_all?: boolean }>("/api/admin/notifications.php?all=1", {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getAdminEmployees(): Promise<AdminEmployee[]> {
  const data = await apiRequest<AdminEmployeesResponse>("/api/admin/employees.php", {
    method: "GET",
    credentials: "include",
  });
  return data.employees || [];
}

export async function createAdminEmployee(payload: Partial<AdminEmployee>): Promise<AdminEmployee> {
  const data = await apiRequest<{ employee: AdminEmployee }>("/api/admin/employees.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.employee;
}

export async function updateAdminEmployee(payload: Partial<AdminEmployee> & { id: string }): Promise<AdminEmployee> {
  const data = await apiRequest<{ employee: AdminEmployee }>("/api/admin/employees.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.employee;
}

export async function deleteAdminEmployee(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/employees.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getAdminReportsData(): Promise<AdminReportsResponse> {
  return apiRequest<AdminReportsResponse>("/api/admin/reports.php", {
    method: "GET",
    credentials: "include",
  });
}

export async function executeAdminSql(payload: { sql: string; confirmed?: boolean; destructive_confirmation?: string }): Promise<AdminSqlEditorResult> {
  const data = await apiRequest<{ result: AdminSqlEditorResult }>("/api/admin/sql-editor.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.result;
}

// ── Roles ─────────────────────────────────────────────────────────────────────

export async function getAdminRoles(activeOnly = false): Promise<AkRole[]> {
  const data = await apiRequest<AkRolesResponse>(
    `/api/admin/roles.php${activeOnly ? "?active_only=1" : ""}`,
    { method: "GET", credentials: "include" }
  );
  return data.roles || [];
}

export async function createAdminRole(payload: { name: string }): Promise<AkRole> {
  const data = await apiRequest<{ role: AkRole }>("/api/admin/roles.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.role;
}

export async function updateAdminRole(payload: { id: string; name?: string; is_active?: boolean }): Promise<AkRole> {
  const data = await apiRequest<{ role: AkRole }>("/api/admin/roles.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.role;
}

export async function deactivateAdminRole(id: string): Promise<void> {
  await apiRequest<{ deactivated: boolean }>(`/api/admin/roles.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

// ── Employee Roles ─────────────────────────────────────────────────────────────

export async function getEmployeeRoles(employeeId: string): Promise<AkEmployeeRole[]> {
  const data = await apiRequest<AkEmployeeRolesResponse>(
    `/api/admin/employee-roles.php?employee_id=${encodeURIComponent(employeeId)}`,
    { method: "GET", credentials: "include" }
  );
  return data.employee_roles || [];
}

export async function assignEmployeeRole(payload: { employee_id: string; role_id: string; assigned_at: string }): Promise<AkEmployeeRole> {
  const data = await apiRequest<{ employee_role: AkEmployeeRole }>("/api/admin/employee-roles.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.employee_role;
}

export async function endEmployeeRole(payload: { employee_id: string; role_id: string; assigned_at: string; ended_at: string | null }): Promise<void> {
  await apiRequest<{ updated: boolean }>("/api/admin/employee-roles.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export async function deleteEmployeeRole(payload: { employee_id: string; role_id: string; assigned_at: string }): Promise<void> {
  await apiRequest<{ deleted: boolean }>("/api/admin/employee-roles.php", {
    method: "DELETE",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

// ── Employee Cost Periods ──────────────────────────────────────────────────────

export async function getEmployeeCostPeriods(employeeId: string): Promise<AkEmployeeCostPeriod[]> {
  const data = await apiRequest<AkEmployeeCostPeriodsResponse>(
    `/api/admin/employee-cost-periods.php?employee_id=${encodeURIComponent(employeeId)}`,
    { method: "GET", credentials: "include" }
  );
  return data.cost_periods || [];
}

export async function createEmployeeCostPeriod(payload: {
  employee_id: string;
  effective_from: string;
  salary?: number;
  sgk?: number;
  meal?: number;
  transportation?: number;
  bonus?: number;
  accommodation?: number;
  other?: number;
  notes?: string | null;
}): Promise<AkEmployeeCostPeriod> {
  const data = await apiRequest<{ cost_period: AkEmployeeCostPeriod }>("/api/admin/employee-cost-periods.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.cost_period;
}

export async function updateEmployeeCostPeriodNotes(id: string, notes: string | null): Promise<void> {
  await apiRequest<{ updated: boolean }>("/api/admin/employee-cost-periods.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify({ id, notes }),
  });
}

export async function deleteEmployeeCostPeriod(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/employee-cost-periods.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

// ── Employee Project Assignments ───────────────────────────────────────────────

export async function getEmployeeAssignments(employeeId: string): Promise<AkEmployeeProjectAssignment[]> {
  const data = await apiRequest<AkEmployeeProjectAssignmentsResponse>(
    `/api/admin/employee-project-assignments.php?employee_id=${encodeURIComponent(employeeId)}`,
    { method: "GET", credentials: "include" }
  );
  return data.assignments || [];
}

export async function getProjectAssignments(projectId: string): Promise<AkEmployeeProjectAssignment[]> {
  const data = await apiRequest<AkEmployeeProjectAssignmentsResponse>(
    `/api/admin/employee-project-assignments.php?project_id=${encodeURIComponent(projectId)}`,
    { method: "GET", credentials: "include" }
  );
  return data.assignments || [];
}

export async function createEmployeeAssignment(payload: {
  employee_id: string;
  project_id: string;
  start_date: string;
  notes?: string | null;
}): Promise<AkEmployeeProjectAssignment> {
  const data = await apiRequest<{ assignment: AkEmployeeProjectAssignment }>("/api/admin/employee-project-assignments.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.assignment;
}

export async function updateEmployeeAssignment(payload: { id: string; end_date?: string | null; notes?: string | null }): Promise<void> {
  await apiRequest<{ updated: boolean }>("/api/admin/employee-project-assignments.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export async function deleteEmployeeAssignment(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/employee-project-assignments.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

// ── Employee Project Allocations ───────────────────────────────────────────────

export async function getProjectAllocations(projectId: string): Promise<AkEmployeeProjectAllocation[]> {
  const data = await apiRequest<AkEmployeeProjectAllocationsResponse>(
    `/api/admin/employee-project-allocations.php?project_id=${encodeURIComponent(projectId)}`,
    { method: "GET", credentials: "include" }
  );
  return data.allocations || [];
}

export async function getEmployeeAllocations(employeeId: string): Promise<AkEmployeeProjectAllocation[]> {
  const data = await apiRequest<AkEmployeeProjectAllocationsResponse>(
    `/api/admin/employee-project-allocations.php?employee_id=${encodeURIComponent(employeeId)}`,
    { method: "GET", credentials: "include" }
  );
  return data.allocations || [];
}

export async function createEmployeeAllocation(payload: {
  employee_id: string;
  project_id: string;
  allocation_year: number;
  allocation_month: number;
  days_worked: number;
  working_days_base: number;
  notes?: string | null;
}): Promise<AkEmployeeProjectAllocation> {
  const data = await apiRequest<{ allocation: AkEmployeeProjectAllocation }>("/api/admin/employee-project-allocations.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.allocation;
}

export async function updateEmployeeAllocation(payload: {
  id: string;
  days_worked?: number;
  working_days_base?: number;
  notes?: string | null;
}): Promise<AkEmployeeProjectAllocation> {
  const data = await apiRequest<{ allocation: AkEmployeeProjectAllocation }>("/api/admin/employee-project-allocations.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.allocation;
}

export async function deleteEmployeeAllocation(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/employee-project-allocations.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

// ── Suppliers ─────────────────────────────────────────────────────────────────

export async function getAdminSuppliers(params: { q?: string; active_only?: boolean } = {}): Promise<AdminSupplier[]> {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.active_only) p.set("active_only", "1");
  const data = await apiRequest<AdminSuppliersResponse>(`/api/admin/suppliers.php${p.toString() ? "?" + p.toString() : ""}`, { method: "GET", credentials: "include" });
  return data.suppliers || [];
}

export async function getAdminSupplier(id: string): Promise<AdminSupplier> {
  const data = await apiRequest<AdminSupplierResponse>(`/api/admin/suppliers.php?id=${encodeURIComponent(id)}`, { method: "GET", credentials: "include" });
  return data.supplier;
}

export async function createAdminSupplier(payload: Omit<AdminSupplier, "id" | "created_at" | "updated_at">): Promise<AdminSupplier> {
  const data = await apiRequest<AdminSupplierResponse>("/api/admin/suppliers.php", { method: "POST", credentials: "include", body: JSON.stringify(payload) });
  return data.supplier;
}

export async function updateAdminSupplier(payload: Partial<AdminSupplier> & { id: string }): Promise<AdminSupplier> {
  const data = await apiRequest<AdminSupplierResponse>("/api/admin/suppliers.php", { method: "PATCH", credentials: "include", body: JSON.stringify(payload) });
  return data.supplier;
}

export async function deleteAdminSupplier(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/suppliers.php?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
}

// ── Customer financial entries ─────────────────────────────────────────────────

export async function getCustomerFinancialEntries(params: { customer_id?: string; project_id?: string; id?: string } = {}): Promise<CustomerFinancialEntry[]> {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v as string]));
  const data = await apiRequest<AdminCustomerEntriesResponse & { entry?: CustomerFinancialEntry }>(`/api/admin/customer-financial-entries.php${p.toString() ? "?" + p.toString() : ""}`, { method: "GET", credentials: "include" });
  return data.entries || (data.entry ? [data.entry] : []);
}

export async function createCustomerFinancialEntry(payload: CardFinancialEntryPayload & { customer_id: string }): Promise<CustomerFinancialEntry> {
  const data = await apiRequest<{ entry: CustomerFinancialEntry }>("/api/admin/customer-financial-entries.php", { method: "POST", credentials: "include", body: JSON.stringify(payload) });
  return data.entry;
}

export async function updateCustomerFinancialEntry(payload: Partial<CardFinancialEntryPayload> & { id: string; customer_id: string }): Promise<CustomerFinancialEntry> {
  const data = await apiRequest<{ entry: CustomerFinancialEntry }>("/api/admin/customer-financial-entries.php", { method: "PATCH", credentials: "include", body: JSON.stringify(payload) });
  return data.entry;
}

export async function deleteCustomerFinancialEntry(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/customer-financial-entries.php?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
}

// ── Government progress payments ───────────────────────────────────────────────

export async function getGovernmentProgressPayments(params: { customer_id?: string; project_id?: string; id?: string } = {}): Promise<import("./apiTypes").GovernmentProgressPayment[]> {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v as string]));
  const data = await apiRequest<{ payments?: import("./apiTypes").GovernmentProgressPayment[]; payment?: import("./apiTypes").GovernmentProgressPayment }>(`/api/admin/government-progress-payments.php${p.toString() ? "?" + p.toString() : ""}`, { method: "GET", credentials: "include" });
  return data.payments || (data.payment ? [data.payment] : []);
}

export async function createGovernmentProgressPayment(payload: import("./apiTypes").GovernmentProgressPaymentPayload): Promise<import("./apiTypes").GovernmentProgressPayment> {
  const data = await apiRequest<{ payment: import("./apiTypes").GovernmentProgressPayment }>("/api/admin/government-progress-payments.php", { method: "POST", credentials: "include", body: JSON.stringify(payload) });
  return data.payment;
}

export async function updateGovernmentProgressPayment(payload: Partial<import("./apiTypes").GovernmentProgressPaymentPayload> & { id: string }): Promise<import("./apiTypes").GovernmentProgressPayment> {
  const data = await apiRequest<{ payment: import("./apiTypes").GovernmentProgressPayment }>("/api/admin/government-progress-payments.php", { method: "PATCH", credentials: "include", body: JSON.stringify(payload) });
  return data.payment;
}

export async function deleteGovernmentProgressPayment(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/government-progress-payments.php?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
}

export async function createGppCollection(payload: {
  government_progress_payment_id: string;
  breakdown_id?: string | null;
  title: string;
  collection_date: string;
  amount_try: number;
  notes?: string | null;
}): Promise<import("./apiTypes").GovernmentProgressPayment> {
  const data = await apiRequest<{ payment: import("./apiTypes").GovernmentProgressPayment }>("/api/admin/government-progress-payments.php", { method: "POST", credentials: "include", body: JSON.stringify({ action: "create_collection", ...payload }) });
  return data.payment;
}

export async function updateGppCollection(payload: {
  collection_id: string;
  breakdown_id?: string | null;
  title?: string;
  collection_date?: string;
  amount_try?: number;
  notes?: string | null;
}): Promise<import("./apiTypes").GovernmentProgressPayment> {
  const data = await apiRequest<{ payment: import("./apiTypes").GovernmentProgressPayment }>("/api/admin/government-progress-payments.php", { method: "PATCH", credentials: "include", body: JSON.stringify({ action: "update_collection", ...payload }) });
  return data.payment;
}

export async function deleteGppCollection(collectionId: string): Promise<import("./apiTypes").GovernmentProgressPayment> {
  const data = await apiRequest<{ payment: import("./apiTypes").GovernmentProgressPayment }>("/api/admin/government-progress-payments.php", { method: "DELETE", credentials: "include", body: JSON.stringify({ action: "delete_collection", collection_id: collectionId }) });
  return data.payment;
}

export async function updateGppBreakdown(payload: {
  breakdown_id: string;
  planned_amount_try?: number;
  paid_amount_try?: number;
  due_date?: string | null;
  paid_date?: string | null;
  status?: import("./apiTypes").GovernmentPaymentStatus;
  notes?: string | null;
}): Promise<import("./apiTypes").GovernmentProgressPayment> {
  const data = await apiRequest<{ payment: import("./apiTypes").GovernmentProgressPayment }>("/api/admin/government-progress-payments.php", { method: "PATCH", credentials: "include", body: JSON.stringify(payload) });
  return data.payment;
}

// ── Employee financial entries ─────────────────────────────────────────────────

export async function getEmployeeFinancialEntries(params: { employee_id?: string; project_id?: string } = {}): Promise<EmployeeFinancialEntry[]> {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v as string]));
  const data = await apiRequest<AdminEmployeeEntriesResponse>(`/api/admin/employee-financial-entries.php${p.toString() ? "?" + p.toString() : ""}`, { method: "GET", credentials: "include" });
  return data.entries || [];
}

export async function createEmployeeFinancialEntry(payload: CardFinancialEntryPayload & { employee_id: string }): Promise<EmployeeFinancialEntry> {
  const data = await apiRequest<{ entry: EmployeeFinancialEntry }>("/api/admin/employee-financial-entries.php", { method: "POST", credentials: "include", body: JSON.stringify(payload) });
  return data.entry;
}

export async function updateEmployeeFinancialEntry(payload: Partial<CardFinancialEntryPayload> & { id: string; employee_id: string }): Promise<EmployeeFinancialEntry> {
  const data = await apiRequest<{ entry: EmployeeFinancialEntry }>("/api/admin/employee-financial-entries.php", { method: "PATCH", credentials: "include", body: JSON.stringify(payload) });
  return data.entry;
}

export async function deleteEmployeeFinancialEntry(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/employee-financial-entries.php?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
}

// ── Supplier financial entries ─────────────────────────────────────────────────

export async function getSupplierFinancialEntries(params: { supplier_id?: string; project_id?: string } = {}): Promise<SupplierFinancialEntry[]> {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v as string]));
  const data = await apiRequest<AdminSupplierEntriesResponse>(`/api/admin/supplier-financial-entries.php${p.toString() ? "?" + p.toString() : ""}`, { method: "GET", credentials: "include" });
  return data.entries || [];
}

export async function createSupplierFinancialEntry(payload: CardFinancialEntryPayload & { supplier_id: string }): Promise<SupplierFinancialEntry> {
  const data = await apiRequest<{ entry: SupplierFinancialEntry }>("/api/admin/supplier-financial-entries.php", { method: "POST", credentials: "include", body: JSON.stringify(payload) });
  return data.entry;
}

export async function updateSupplierFinancialEntry(payload: Partial<CardFinancialEntryPayload> & { id: string; supplier_id: string }): Promise<SupplierFinancialEntry> {
  const data = await apiRequest<{ entry: SupplierFinancialEntry }>("/api/admin/supplier-financial-entries.php", { method: "PATCH", credentials: "include", body: JSON.stringify(payload) });
  return data.entry;
}

export async function deleteSupplierFinancialEntry(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/supplier-financial-entries.php?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
}

// ── Expense card financial entries ────────────────────────────────────────────

export async function getExpenseCardFinancialEntries(params: { expense_card_id?: string; project_id?: string } = {}): Promise<ExpenseCardFinancialEntry[]> {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v as string]));
  const data = await apiRequest<AdminExpenseCardEntriesResponse>(`/api/admin/expense-card-financial-entries.php${p.toString() ? "?" + p.toString() : ""}`, { method: "GET", credentials: "include" });
  return data.entries || [];
}

export async function createExpenseCardFinancialEntry(payload: CardFinancialEntryPayload & { expense_card_id: string }): Promise<ExpenseCardFinancialEntry> {
  const data = await apiRequest<{ entry: ExpenseCardFinancialEntry }>("/api/admin/expense-card-financial-entries.php", { method: "POST", credentials: "include", body: JSON.stringify(payload) });
  return data.entry;
}

export async function updateExpenseCardFinancialEntry(payload: Partial<CardFinancialEntryPayload> & { id: string; expense_card_id: string }): Promise<ExpenseCardFinancialEntry> {
  const data = await apiRequest<{ entry: ExpenseCardFinancialEntry }>("/api/admin/expense-card-financial-entries.php", { method: "PATCH", credentials: "include", body: JSON.stringify(payload) });
  return data.entry;
}

export async function deleteExpenseCardFinancialEntry(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/expense-card-financial-entries.php?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
}

// ── Project statement ──────────────────────────────────────────────────────────

export async function getProjectStatement(projectId: string): Promise<ProjectStatementResponse> {
  return apiRequest<ProjectStatementResponse>(`/api/admin/project-statement.php?project_id=${encodeURIComponent(projectId)}`, { method: "GET", credentials: "include" });
}

// ── Gelenler (global income view) ─────────────────────────────────────────────

export async function getGelenler(params: { project_id?: string; customer_id?: string; status?: string; date_from?: string; date_to?: string; q?: string } = {}): Promise<GelenlerResponse> {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v as string]));
  return apiRequest<GelenlerResponse>(`/api/admin/gelenler.php${p.toString() ? "?" + p.toString() : ""}`, { method: "GET", credentials: "include" });
}

// ── Gidenler (global expense view) ────────────────────────────────────────────

export async function getGidenler(params: { project_id?: string; source_type?: string; status?: string; date_from?: string; date_to?: string; q?: string } = {}): Promise<GidenlerResponse> {
  const p = new URLSearchParams(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, v as string]));
  return apiRequest<GidenlerResponse>(`/api/admin/gidenler.php${p.toString() ? "?" + p.toString() : ""}`, { method: "GET", credentials: "include" });
}
