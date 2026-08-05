import { useParams } from "react-router-dom";
import ProjectDetail from "@/pages/site/ProjectDetail";

// P2-1: authenticated draft preview. Only reachable via /admin/projeler/:id/onizleme,
// which sits inside the admin route tree and therefore requires an admin
// session same as every other admin page — the public site's ProjectDetail
// route and its "only published projects" rule are untouched.
export default function AdminProjectPreview() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <div className="py-12 text-center text-sm text-muted-foreground">Proje bulunamadı.</div>;
  return <ProjectDetail previewProjectId={id} />;
}
