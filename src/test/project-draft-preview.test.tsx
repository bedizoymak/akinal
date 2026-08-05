import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetail from "@/pages/site/ProjectDetail";
import AdminProjectPreview from "@/pages/admin/AdminProjectPreview";

// P2-1 regression: an authenticated admin preview of a DRAFT (is_published:
// false) must render its content via the admin-only endpoints, while the
// public route must keep refusing to show it (project-detail.php only ever
// returns published projects — untouched by this feature).

const apiMocks = vi.hoisted(() => ({
  getProjectDetail: vi.fn(),
  getPublishedProjects: vi.fn(),
  getAdminProject: vi.fn(),
  getAdminProjectImages: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => apiMocks);
vi.mock("@/hooks/useSiteSettings", () => ({
  useSiteSettings: () => ({ settings: {} }),
  getWhatsAppLink: () => "#",
}));

const draftProject = {
  id: "draft-1",
  title: "QA UAT Taslak Proje",
  slug: "qa-uat-taslak-proje",
  is_published: false,
  cover_image_url: null,
  short_description: "",
};

describe("P2-1 authenticated draft preview vs public route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin preview route loads and renders an unpublished draft via admin-authenticated endpoints", async () => {
    apiMocks.getAdminProject.mockResolvedValueOnce(draftProject);
    apiMocks.getAdminProjectImages.mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={["/admin/projeler/draft-1/onizleme"]}>
        <Routes>
          <Route path="/admin/projeler/:id/onizleme" element={<AdminProjectPreview />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("QA UAT Taslak Proje")).toBeInTheDocument();
    expect(screen.getByText(/Taslak Önizleme/)).toBeInTheDocument();
    expect(apiMocks.getAdminProject).toHaveBeenCalledWith("draft-1");
    expect(apiMocks.getProjectDetail).not.toHaveBeenCalled();
  });

  it("public route still rejects a draft (project-detail.php returns nothing published) with no preview banner", async () => {
    apiMocks.getProjectDetail.mockRejectedValueOnce(new Error("not found"));
    apiMocks.getPublishedProjects.mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={["/projelerimiz/qa-uat-taslak-proje"]}>
        <Routes>
          <Route path="/projelerimiz/:slug" element={<ProjectDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Proje bulunamadı")).toBeInTheDocument());
    expect(screen.queryByText(/Taslak Önizleme/)).not.toBeInTheDocument();
    expect(apiMocks.getAdminProject).not.toHaveBeenCalled();
  });
});
