import type {
  AdminUser,
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

  try {
    response = await fetch(path, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
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
