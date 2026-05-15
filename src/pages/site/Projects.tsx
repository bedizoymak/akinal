import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/site/Seo";
import ProjectCard, { ProjectCardData } from "@/components/site/ProjectCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@/lib/projects";
import { Search } from "lucide-react";

type ProjectListItem = ProjectCardData & {
  is_featured: boolean | null;
  sort_order: number | null;
  created_at: string;
};

export default function Projects() {
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<string>("custom");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("projects")
      .select("id,title,slug,short_description,project_type,project_status,location,cover_image_url,is_featured,sort_order,created_at")
      .eq("is_published", true)
      .then(({ data }) => {
        setItems((data as ProjectListItem[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    let list = [...items];
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(s) || p.location.toLowerCase().includes(s));
    }
    if (type !== "all") list = list.filter((p) => p.project_type === type);
    if (status !== "all") list = list.filter((p) => p.project_status === status);
    if (sort === "newest") list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else if (sort === "oldest") list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else list.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return list;
  }, [items, q, type, status, sort]);

  return (
    <>
      <Seo
        title="Projelerimiz"
        description="Akınal İnşaat'ın tamamlanan ve süren konut, ticari proje ve kentsel dönüşüm çalışmalarını inceleyin."
        canonical="/projelerimiz"
        breadcrumbs={[
          { name: "Ana Sayfa", path: "/" },
          { name: "Projelerimiz", path: "/projelerimiz" },
        ]}
      />
      <section className="py-16 md:py-20 bg-gradient-dark text-white">
        <div className="container-narrow">
          <div className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">Projelerimiz</div>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight">Tamamlanan ve Süren Projeler</h1>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container-narrow">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-10 p-4 rounded-lg border border-border bg-surface-light">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 bg-background" placeholder="Proje adı veya konum ara..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Proje Türü" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Türler</SelectItem>
                {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-background"><SelectValue placeholder="Proje Durumu" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Durumlar</SelectItem>
                {PROJECT_STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Önerilen Sıralama</SelectItem>
                <SelectItem value="newest">En Yeni</SelectItem>
                <SelectItem value="oldest">En Eski</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground py-16">Yükleniyor...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 border border-dashed border-border rounded-lg">
              Aramanıza uygun proje bulunamadı.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((p) => <ProjectCard key={p.id} project={p} />)}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
