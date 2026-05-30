import type {
  AdminUser,
  AdminContactRequest,
  AdminCustomer,
  AdminCustomerDetailResponse,
  AdminCustomerListResponse,
  AdminDashboardResponse,
  AdminPayment,
  AdminPaymentPlan,
  AdminPaymentPlansResponse,
  AdminPaymentsResponse,
  AdminCustomerNote,
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
  AdminNotification,
  AdminNotificationsResponse,
  AdminReportsResponse,
  ContactRequestPayload,
  CookieConsentPayload,
  ProjectDetailResponse,
  PublicProject,
  SiteSettings,
} from "@/lib/apiTypes";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  details?: unknown;
};

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
    throw new Error(error instanceof Error ? error.message : "API request failed.");
  }

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`API returned an invalid JSON response (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(payload.message || `API request failed with status ${response.status}.`);
  }

  if (!payload.success) {
    throw new Error(payload.message || "API request was not successful.");
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
    throw new Error(error instanceof Error ? error.message : "API request failed.");
  }

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`API returned an invalid JSON response (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(payload.message || `API request failed with status ${response.status}.`);
  }

  if (!payload.success) {
    throw new Error(payload.message || "API request was not successful.");
  }

  return (payload.data ?? ({} as T)) as T;
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

export async function sendAdminPushTest(): Promise<{ sent: number; failed: number; skipped?: boolean; reason?: string }> {
  return apiRequest<{ sent: number; failed: number; skipped?: boolean; reason?: string }>("/api/admin/send-push-test.php", {
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
  return data.projects || [];
}

export async function getAdminProject(id: string): Promise<PublicProject | null> {
  const data = await apiRequest<{ project: PublicProject | null }>(`/api/admin/projects.php?id=${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
  });
  return data.project || null;
}

export async function createAdminProject(payload: Partial<PublicProject>): Promise<PublicProject> {
  const data = await apiRequest<{ project: PublicProject }>("/api/admin/projects.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.project;
}

export async function updateAdminProject(payload: Partial<PublicProject> & { id: string }): Promise<PublicProject> {
  const data = await apiRequest<{ project: PublicProject }>("/api/admin/projects.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.project;
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
};

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

export async function createAdminCustomerNote(customerId: string, note: string): Promise<AdminCustomerNote> {
  const data = await apiRequest<{ note: AdminCustomerNote }>("/api/admin/customers.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify({ action: "note", customer_id: customerId, note }),
  });
  return data.note;
}

export async function deleteAdminCustomerNote(noteId: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/customers.php?note_id=${encodeURIComponent(noteId)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getAdminPaymentPlansData(): Promise<AdminPaymentPlansResponse> {
  return apiRequest<AdminPaymentPlansResponse>("/api/admin/payment-plans.php", {
    method: "GET",
    credentials: "include",
  });
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

export async function getAdminExpenseCards(): Promise<AdminExpenseCard[]> {
  const data = await apiRequest<AdminExpenseCardsResponse>("/api/admin/expense-cards.php", {
    method: "GET",
    credentials: "include",
  });
  return data.expense_cards || [];
}

export async function createAdminExpenseCard(payload: Partial<AdminExpenseCard>): Promise<AdminExpenseCard> {
  const data = await apiRequest<{ expense_card: AdminExpenseCard }>("/api/admin/expense-cards.php", {
    method: "POST",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.expense_card;
}

export async function updateAdminExpenseCard(payload: Partial<AdminExpenseCard> & { id: string }): Promise<AdminExpenseCard> {
  const data = await apiRequest<{ expense_card: AdminExpenseCard }>("/api/admin/expense-cards.php", {
    method: "PATCH",
    credentials: "include",
    body: JSON.stringify(payload),
  });
  return data.expense_card;
}

export async function deleteAdminExpenseCard(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/admin/expense-cards.php?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function getAdminNotifications(): Promise<AdminNotification[]> {
  const data = await apiRequest<AdminNotificationsResponse>("/api/admin/notifications.php", {
    method: "GET",
    credentials: "include",
  });
  return data.notifications || [];
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
