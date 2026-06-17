import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminLayout from "@/components/admin/AdminLayout";
import { AuthProvider } from "@/hooks/useAuth";
import AdminDashboard from "@/pages/admin/AdminDashboard";

const apiMocks = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  return {
    ApiError: MockApiError,
    getCurrentAdmin: vi.fn(),
    getAdminDashboard: vi.fn(),
    logoutAdmin: vi.fn(),
    loginAdmin: vi.fn(),
  };
});

vi.mock("@/lib/apiClient", () => apiMocks);

describe("admin dashboard hard null guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects logged-out /admin access after me.php returns 401 without requesting dashboard data", async () => {
    apiMocks.getCurrentAdmin.mockRejectedValueOnce(new apiMocks.ApiError("Authentication required.", 401));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
            </Route>
            <Route path="/admin/giris" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(apiMocks.getAdminDashboard).not.toHaveBeenCalled();
  });

  it("renders a controlled error state when dashboard API resolves undefined", async () => {
    apiMocks.getAdminDashboard.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/giris" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Veriler alınamadı")).toBeInTheDocument());
    expect(screen.getByText("Dashboard API boş veri döndürdü.")).toBeInTheDocument();
  });
});
