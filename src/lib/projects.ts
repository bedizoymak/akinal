// Helper to resolve image URLs — sample assets shipped with project use /src/assets/* paths,
// while uploaded ones use Supabase Storage URLs.
import sample1 from "@/assets/sample-project-1.jpg";
import sample2 from "@/assets/sample-project-2.jpg";
import sample3 from "@/assets/sample-project-3.jpg";

const sampleMap: Record<string, string> = {
  "/src/assets/sample-project-1.jpg": sample1,
  "/src/assets/sample-project-2.jpg": sample2,
  "/src/assets/sample-project-3.jpg": sample3,
};

export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  return sampleMap[url] || url;
}

export function turkishSlugify(text: string): string {
  const map: Record<string, string> = {
    ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
    ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
  };
  return (text || "")
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export const PROJECT_TYPES = [
  "Kentsel Dönüşüm",
  "Kat Karşılığı İnşaat",
  "Anahtar Teslim İnşaat",
  "Proje Geliştirme",
  "Riskli Yapı Yenileme",
  "Konut Projesi",
  "Ticari Proje",
  "Diğer",
] as const;

export const PROJECT_STATUSES = [
  "Planlama Aşamasında",
  "Projelendirme",
  "Ruhsat Sürecinde",
  "Devam Ediyor",
  "Tamamlandı",
] as const;

export const SERVICE_OPTIONS = [
  "Kentsel Dönüşüm",
  "Kat Karşılığı İnşaat",
  "Anahtar Teslim İnşaat",
  "Proje Geliştirme",
  "Riskli Yapı Danışmanlığı",
  "Diğer",
] as const;

export function statusBadgeVariant(status: string) {
  switch (status) {
    case "Tamamlandı":
      return "bg-emerald-600/15 text-emerald-700 border-emerald-600/30";
    case "Devam Ediyor":
      return "bg-accent/15 text-accent border-accent/30";
    case "Ruhsat Sürecinde":
      return "bg-blue-600/15 text-blue-700 border-blue-600/30";
    case "Projelendirme":
      return "bg-purple-600/15 text-purple-700 border-purple-600/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
