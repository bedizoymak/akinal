import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmployeeRolesPanel } from "@/components/admin/employees/EmployeeRolesPanel";

// QA-C BUG-01 regression: when a personnel endpoint fails (e.g. TABLE_MISSING before the
// migration has been applied), the panel must show a distinct error state with a real
// "Tekrar Dene" action that re-issues the network request — not a page reload, not a dead
// button, and not silently falling back to the empty-state UI (which would hide the failure).

const apiMocks = vi.hoisted(() => ({
  getAdminRoles: vi.fn(),
  getEmployeeRoles: vi.fn(),
  assignEmployeeRole: vi.fn(),
  deleteEmployeeRole: vi.fn(),
  endEmployeeRole: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => apiMocks);

describe("QA-C BUG-01 EmployeeRolesPanel — Tekrar Dene sends a real new request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the error state (not empty state) on failure, and retry re-fetches successfully", async () => {
    apiMocks.getAdminRoles.mockRejectedValueOnce(new Error("HTTP 503: TABLE_MISSING"));
    apiMocks.getEmployeeRoles.mockRejectedValueOnce(new Error("HTTP 503: TABLE_MISSING"));

    render(<EmployeeRolesPanel employeeId="emp-1" />);

    await waitFor(() => expect(screen.getByText("Roller yüklenemedi.")).toBeInTheDocument());
    // Must not be mistaken for the legitimate "no roles yet" empty state.
    expect(screen.queryByText("Henüz rol atanmamış.")).not.toBeInTheDocument();
    expect(apiMocks.getAdminRoles).toHaveBeenCalledTimes(1);
    expect(apiMocks.getEmployeeRoles).toHaveBeenCalledTimes(1);

    apiMocks.getAdminRoles.mockResolvedValueOnce([{ id: "role-1", name: "Usta", normalized_name: "usta", is_active: true, created_at: "" }]);
    apiMocks.getEmployeeRoles.mockResolvedValueOnce([]);

    fireEvent.click(screen.getByText("Tekrar Dene"));

    // A real second network call, not a cached replay.
    await waitFor(() => expect(apiMocks.getAdminRoles).toHaveBeenCalledTimes(2));
    expect(apiMocks.getEmployeeRoles).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByText("Henüz rol atanmamış.")).toBeInTheDocument());
    expect(screen.queryByText("Roller yüklenemedi.")).not.toBeInTheDocument();
  });
});
