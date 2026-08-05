import { beforeEach, describe, expect, it, vi } from "vitest";

// QA-B OBS-03 regression: clicking "Dışa Aktar" while the admin project list was filtered
// (e.g. to just the draft QA demo project) silently exported EVERY project in the database
// instead of the filtered subset the admin was looking at, because exportProjectsWithImages()
// always called getAdminProjects() with no scoping. It now accepts an optional project-id
// list — AdminProjects.tsx's handleExport() passes the currently filtered rows' ids.

const apiMocks = vi.hoisted(() => ({
  getAdminProjects: vi.fn(),
  getAdminProjectImages: vi.fn(),
  createAdminProject: vi.fn(),
  updateAdminProject: vi.fn(),
  createAdminProjectImage: vi.fn(),
  updateAdminProjectImage: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => apiMocks);

import { exportProjectsWithImages } from "@/features/admin/projects/projectImportExport";

const projectA = { id: "proj-a", title: "QA DEMO Draft Project", slug: "qa-demo-draft", is_published: false };
const projectB = { id: "proj-b", title: "Published Project", slug: "published-project", is_published: true };
const imageA = { id: "img-a", project_id: "proj-a", image_url: "a.jpg" };
const imageB = { id: "img-b", project_id: "proj-b", image_url: "b.jpg" };

describe("QA-B OBS-03 scoped project export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.getAdminProjects.mockResolvedValue([projectA, projectB]);
    apiMocks.getAdminProjectImages.mockResolvedValue([imageA, imageB]);
  });

  it("exports every project when no id filter is given (unchanged default behavior)", async () => {
    const data = await exportProjectsWithImages();
    expect(data.projects.map((p) => p.project.id)).toEqual(["proj-a", "proj-b"]);
  });

  it("exports only the requested project ids when the list is filtered", async () => {
    const data = await exportProjectsWithImages(["proj-a"]);
    expect(data.projects).toHaveLength(1);
    expect(data.projects[0].project.id).toBe("proj-a");
    expect(data.projects[0].images.map((i) => i.id)).toEqual(["img-a"]);
  });

  it("returns no projects when the filtered id list matches nothing", async () => {
    const data = await exportProjectsWithImages(["does-not-exist"]);
    expect(data.projects).toHaveLength(0);
  });
});
