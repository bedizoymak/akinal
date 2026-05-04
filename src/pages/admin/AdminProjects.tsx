import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Eye, EyeOff, Copy, Trash2, ExternalLink, GripVertical, Star, Search, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { resolveImageUrl, statusBadgeVariant, PROJECT_STATUSES, PROJECT_TYPES, turkishSlugify } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

  const filtered = items.filter((p) => {
    if (q && !`${p.title} ${p.location} ${p.project_type}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (type !== "all" && p.project_type !== type) return false;
    if (status !== "all" && p.project_status !== status) return false;
    if (pub === "published" && !p.is_published) return false;
    if (pub === "draft" && p.is_published) return false;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Projeler</h1>
          <p className="text-muted-foreground text-sm">Sürükle-bırak ile sıralayın.</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to="/admin/projeler/yeni"><Plus className="h-4 w-4 mr-1" /> Yeni Proje Ekle</Link></Button>
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
        <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-md">Proje bulunamadı.</div>
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
