import {
  createAdminProject,
  createAdminProjectImage,
  getAdminProjectImages,
  getAdminProjects,
  updateAdminProject,
  updateAdminProjectImage,
} from "@/lib/apiClient";
import type { ProjectImage, PublicProject } from "@/lib/apiTypes";

type ProjectRow = PublicProject;
type ProjectInsert = Partial<PublicProject>;
type ProjectImageRow = ProjectImage;
type ProjectImageInsert = Partial<ProjectImage> & { project_id?: string; image_url?: string };

export type ProjectExportItem = {
  project: ProjectRow;
  images: ProjectImageRow[];
};

export type ProjectExportJson = {
  schema: "akinal-projects-export-v1";
  exportedAt: string;
  source: "akinalinsaat.com admin panel";
  projects: ProjectExportItem[];
};

export type ImportResult = {
  projectCount: number;
  imageCount: number;
  errors: string[];
};

const PROJECT_COLUMNS = [
  "id",
  "title",
  "slug",
  "short_description",
  "detailed_description",
  "project_type",
  "project_status",
  "location",
  "city",
  "district",
  "start_year",
  "delivery_year",
  "land_area",
  "construction_area",
  "apartment_count",
  "floor_count",
  "block_count",
  "cover_image_url",
  "is_featured",
  "is_published",
  "sort_order",
  "seo_title",
  "seo_description",
  "created_at",
  "updated_at",
] as const;

const PROJECT_IMAGE_COLUMNS = [
  "id",
  "project_id",
  "image_url",
  "thumbnail_url",
  "title",
  "alt_text",
  "sort_order",
  "created_at",
] as const;

function pickColumns<T extends Record<string, unknown>, K extends readonly string[]>(row: T, columns: K) {
  return columns.reduce<Record<string, unknown>>((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      acc[key] = row[key];
    }
    return acc;
  }, {});
}

function stripGeneratedTimestamps<T extends Record<string, unknown>>(row: T) {
  const { created_at, updated_at, ...rest } = row;
  return rest;
}

function formatExportFileName(date = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}`;
  return `akinal-projeler-export-${stamp}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Exports project (+ image) rows as a downloadable JSON snapshot.
 *
 * When `projectIds` is provided, the export is scoped to just those projects —
 * used by the admin project list's "Dışa Aktar" button so exporting while a
 * filter/search is active exports what's currently shown, not silently every
 * project in the database (see QA-B OBS-03). Omit it (or pass undefined) to
 * export everything.
 */
export async function exportProjectsWithImages(projectIds?: string[]): Promise<ProjectExportJson> {
  const [projects, images] = await Promise.all([
    getAdminProjects(),
    getAdminProjectImages(),
  ]);

  const idFilter = projectIds ? new Set(projectIds) : null;
  const allProjects = idFilter ? projects.filter((project) => idFilter.has(project.id)) : projects;
  const allImages = images;
  const imagesByProject = allImages.reduce<Record<string, ProjectImageRow[]>>((acc, image) => {
    acc[image.project_id] = [...(acc[image.project_id] ?? []), image];
    return acc;
  }, {});

  return {
    schema: "akinal-projects-export-v1",
    exportedAt: new Date().toISOString(),
    source: "akinalinsaat.com admin panel",
    projects: allProjects.map((project) => ({
      project,
      images: imagesByProject[project.id] ?? [],
    })),
  };
}

export function downloadJsonFile(data: ProjectExportJson) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = formatExportFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function validateProjectExportJson(value: unknown): ProjectExportJson {
  if (!isRecord(value)) {
    throw new Error("JSON dosyası geçerli bir nesne değil.");
  }
  if (value.schema !== "akinal-projects-export-v1") {
    throw new Error("JSON şeması desteklenmiyor.");
  }
  if (!Array.isArray(value.projects)) {
    throw new Error("JSON içinde projects dizisi bulunamadı.");
  }

  return {
    schema: value.schema,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : new Date().toISOString(),
    source: "akinalinsaat.com admin panel",
    projects: value.projects.map((item, index) => {
      if (!isRecord(item) || !isRecord(item.project)) {
        throw new Error(`${index + 1}. proje kaydı geçersiz.`);
      }
      return {
        project: item.project as ProjectRow,
        images: Array.isArray(item.images) ? (item.images.filter(isRecord) as ProjectImageRow[]) : [],
      };
    }),
  };
}

async function upsertProject(row: ProjectInsert) {
  const cleaned = stripGeneratedTimestamps(row);
  const existing = (await getAdminProjects()).find((project) => (row.id && project.id === row.id) || (row.slug && project.slug === row.slug));
  if (existing) {
    await updateAdminProject({ ...cleaned, id: existing.id });
    return;
  }
  await createAdminProject(cleaned);
}

async function upsertImage(row: ProjectImageInsert) {
  if (!row.project_id) throw new Error("Görsel project_id alanı olmadan içe aktarılamaz.");
  if (!row.image_url) throw new Error("Görsel image_url alanı olmadan içe aktarılamaz.");

  const cleaned = stripGeneratedTimestamps(row);
  const existing = row.id ? (await getAdminProjectImages()).find((image) => image.id === row.id) : null;
  if (existing) {
    await updateAdminProjectImage({ ...cleaned, id: existing.id });
    return;
  }
  await createAdminProjectImage({ ...cleaned, project_id: row.project_id, image_url: row.image_url });
}

export async function importProjectsWithImages(file: File): Promise<ImportResult> {
  const parsed = validateProjectExportJson(JSON.parse(await file.text()));
  const result: ImportResult = { projectCount: 0, imageCount: 0, errors: [] };

  for (const item of parsed.projects) {
    try {
      const project = pickColumns(item.project, PROJECT_COLUMNS) as ProjectInsert;
      await upsertProject(project);
      result.projectCount += 1;
    } catch (error) {
      result.errors.push(`${item.project?.title ?? item.project?.slug ?? "Proje"}: ${getErrorMessage(error)}`);
    }
  }

  for (const item of parsed.projects) {
    for (const rawImage of item.images ?? []) {
      try {
        const image = pickColumns(rawImage, PROJECT_IMAGE_COLUMNS) as ProjectImageInsert;
        await upsertImage(image);
        result.imageCount += 1;
      } catch (error) {
        result.errors.push(`${rawImage?.title ?? rawImage?.image_url ?? "Görsel"}: ${getErrorMessage(error)}`);
      }
    }
  }

  return result;
}
