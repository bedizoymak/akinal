import type {
  AdminUser,
  AdminContactRequest,
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
