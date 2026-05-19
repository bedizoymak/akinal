import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type ProjectImageRow = Database["public"]["Tables"]["project_images"]["Row"];
type ProjectImageInsert = Database["public"]["Tables"]["project_images"]["Insert"];

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

function shouldRetryWithoutTimestamps(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("created_at") || lower.includes("updated_at") || lower.includes("generated");
}

export async function exportProjectsWithImages(): Promise<ProjectExportJson> {
  const [{ data: projects, error: projectError }, { data: images, error: imageError }] = await Promise.all([
    supabase.from("projects").select("*").order("sort_order").order("created_at", { ascending: false }),
    supabase.from("project_images").select("*").order("sort_order").order("created_at", { ascending: false }),
  ]);

  if (projectError) throw projectError;
  if (imageError) throw imageError;

  const allProjects = projects ?? [];
  const allImages = images ?? [];
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
  if (row.id) {
    const { error } = await supabase.from("projects").upsert(row, { onConflict: "id" });
    if (!error) return;

    if (shouldRetryWithoutTimestamps(error.message)) {
      const retry = await supabase.from("projects").upsert(stripGeneratedTimestamps(row), { onConflict: "id" });
      if (!retry.error) return;
    }

    if (row.slug) {
      const { id, created_at, updated_at, ...slugUpdate } = row;
      const retryBySlug = await supabase.from("projects").upsert(slugUpdate, { onConflict: "slug" });
      if (!retryBySlug.error) return;
    }

    throw error;
  }

  if (!row.slug) throw new Error("Proje id veya slug alanı olmadan içe aktarılamaz.");
  const { error } = await supabase.from("projects").upsert(row, { onConflict: "slug" });
  if (!error) return;

  if (shouldRetryWithoutTimestamps(error.message)) {
    const retry = await supabase.from("projects").upsert(stripGeneratedTimestamps(row), { onConflict: "slug" });
    if (!retry.error) return;
  }

  throw error;
}

async function upsertImage(row: ProjectImageInsert) {
  if (!row.project_id) throw new Error("Görsel project_id alanı olmadan içe aktarılamaz.");
  if (!row.image_url) throw new Error("Görsel image_url alanı olmadan içe aktarılamaz.");

  if (row.id) {
    const { error } = await supabase.from("project_images").upsert(row, { onConflict: "id" });
    if (!error) return;

    if (shouldRetryWithoutTimestamps(error.message)) {
      const retry = await supabase.from("project_images").upsert(stripGeneratedTimestamps(row), { onConflict: "id" });
      if (!retry.error) return;
    }

    throw error;
  }

  const { error } = await supabase.from("project_images").insert(row);
  if (!error) return;

  if (shouldRetryWithoutTimestamps(error.message)) {
    const retry = await supabase.from("project_images").insert(stripGeneratedTimestamps(row));
    if (!retry.error) return;
  }

  throw error;
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
