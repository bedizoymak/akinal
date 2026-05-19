import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Edit, Eye, EyeOff, Copy, Trash2, ExternalLink, GripVertical, Star, Search, Plus, FolderKanban, Download, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resolveImageUrl, statusBadgeVariant, PROJECT_STATUSES, PROJECT_TYPES, turkishSlugify } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { downloadJsonFile, exportProjectsWithImages, importProjectsWithImages } from "@/features/admin/projects/projectImportExport";

function Row({ p, onChange }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-card border border-border rounded-md">
      <button {...attributes} {...listeners} className="text-muted-foreground hover:text-foreground cursor-grab"><GripVertical className="h-5 w-5" /></button>
      <div className="h-14 w-20 rounded bg-muted overflow-hidden shrink-0">
        {p.cover_image_url && <img src={resolveImageUrl(p.cover_image_url)} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="font-semibold truncate">{p.title}</div>
          {p.is_featured && <Star className="h-3.5 w-3.5 text-accent fill-accent" />}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
          <span className={cn("px-2 py-0.5 rounded-md border", statusBadgeVariant(p.project_status))}>{p.project_status}</span>
          <span className="text-muted-foreground">{p.project_type} · {p.location}</span>
          <span className={cn("px-2 py-0.5 rounded-md", p.is_published ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
            {p.is_published ? "Yayında" : "Taslak"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button asChild size="sm" variant="ghost" title="Önizle"><Link to={`/projelerimiz/${p.slug}`} target="_blank"><ExternalLink className="h-4 w-4" /></Link></Button>
        <Button asChild size="sm" variant="ghost" title="Finans"><Link to={`/admin/projeler/${p.id}/finans`}><BarChart3 className="h-4 w-4" /></Link></Button>
        <Button asChild size="sm" variant="ghost" title="Düzenle"><Link to={`/admin/projeler/${p.id}`}><Edit className="h-4 w-4" /></Link></Button>
        <Button size="sm" variant="ghost" title={p.is_published ? "Yayından Kaldır" : "Yayınla"} onClick={() => onChange("toggle", p)}>{p.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        <Button size="sm" variant="ghost" title="Çoğalt" onClick={() => onChange("duplicate", p)}><Copy className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" title="Sil" onClick={() => onChange("delete", p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    </div>
  );
}

export default function AdminProjects() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [pub, setPub] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("projects").select("*").order("sort_order").order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function onChange(action: string, p: any) {
    if (action === "toggle") {
      await supabase.from("projects").update({ is_published: !p.is_published }).eq("id", p.id);
      toast({ title: p.is_published ? "Yayından kaldırıldı" : "Yayınlandı" });
    } else if (action === "duplicate") {
      const { id, created_at, updated_at, ...rest } = p;
      const newSlug = `${p.slug}-kopya-${Date.now().toString(36)}`;
      await supabase.from("projects").insert({ ...rest, title: `${p.title} (Kopya)`, slug: newSlug, is_published: false });
      toast({ title: "Proje çoğaltıldı" });
    } else if (action === "delete") {
      if (!confirm(`"${p.title}" projesini silmek istediğinize emin misiniz?`)) return;
      await supabase.from("projects").delete().eq("id", p.id);
      toast({ title: "Proje silindi" });
    }
    load();
  }

  async function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldI = items.findIndex((i) => i.id === e.active.id);
    const newI = items.findIndex((i) => i.id === e.over!.id);
    const reordered = arrayMove(items, oldI, newI);
    setItems(reordered);
    await Promise.all(reordered.map((it, idx) => supabase.from("projects").update({ sort_order: idx + 1 }).eq("id", it.id)));
    toast({ title: "Sıralama kaydedildi" });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportProjectsWithImages();
      if (data.projects.length === 0) {
        toast({ title: "Dışa aktarılacak proje bulunamadı." });
        return;
      }
      downloadJsonFile(data);
      toast({ title: "Projeler başarıyla dışa aktarıldı." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
      toast({ title: "Projeler dışa aktarılamadı.", description: message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!confirm("Bu işlem JSON dosyasındaki projeleri mevcut veritabanına aktaracak. Aynı ID veya slug varsa kayıtlar güncellenecek.")) {
      return;
    }

    setImporting(true);
    try {
      const result = await importProjectsWithImages(file);
      const description = result.errors.length > 0 ? result.errors.slice(0, 4).join("\n") : undefined;
      toast({
        title: `${result.projectCount} proje ve ${result.imageCount} görsel içe aktarıldı.`,
        description,
        variant: result.errors.length > 0 ? "destructive" : "default",
      });
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
      toast({ title: "Projeler içe aktarılamadı.", description: message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  const filtered = items.filter((p) => {
    if (q && !`${p.title} ${p.location} ${p.project_type}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (type !== "all" && p.project_type !== type) return false;
    if (status !== "all" && p.project_status !== status) return false;
    if (pub === "published" && !p.is_published) return false;
    if (pub === "draft" && p.is_published) return false;
    return true;
  });

  const projectStats = {
    total: items.length,
    active: items.filter((p) => p.project_status !== "Tamamlandı").length,
    published: items.filter((p) => p.is_published).length,
    draft: items.filter((p) => !p.is_published).length,
  };

  return (
    <div>
      <AdminPageHeader
        eyebrow="Proje Yönetimi"
        title="Projeler"
        description="Proje portföyünü yönetin, yayın durumlarını takip edin ve her proje için finans kontrol merkezine ulaşın."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handleExport} disabled={exporting || importing}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Dışa Aktar
            </Button>
            <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()} disabled={exporting || importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              İçe Aktar
            </Button>
            <input ref={importInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
            <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to="/admin/projeler/yeni"><Plus className="h-4 w-4" /> Yeni Proje</Link></Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Toplam Proje" value={projectStats.total} description="Sistemdeki tüm projeler" icon={FolderKanban} tone="accent" />
        <AdminMetricCard label="Aktif Projeler" value={projectStats.active} description="Tamamlanmamış proje sayısı" icon={BarChart3} tone="success" />
        <AdminMetricCard label="Yayındaki Projeler" value={projectStats.published} description="Public sitede görünür" icon={Eye} tone="success" />
        <AdminMetricCard label="Taslak Projeler" value={projectStats.draft} description="Yayına hazır olmayanlar" icon={EyeOff} tone="warning" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 p-4 bg-card border border-border rounded-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Ara..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Türler</SelectItem>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Durumlar</SelectItem>{PROJECT_STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={pub} onValueChange={setPub}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Hepsi</SelectItem><SelectItem value="published">Yayında</SelectItem><SelectItem value="draft">Taslak</SelectItem></SelectContent></Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title="Proje bulunamadı"
          description="Filtreleri temizleyerek tekrar deneyebilir veya yeni proje kaydı oluşturabilirsiniz."
          icon={FolderKanban}
          action={<Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to="/admin/projeler/yeni">Yeni Proje Ekle</Link></Button>}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={filtered.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {filtered.map((p) => <Row key={p.id} p={p} onChange={onChange} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
