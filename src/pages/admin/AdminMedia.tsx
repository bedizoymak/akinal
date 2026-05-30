import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, Search, Image as ImageIcon } from "lucide-react";
import { resolveImageUrl } from "@/lib/projects";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import { deleteAdminMediaImage, getAdminMedia } from "@/lib/apiClient";

export default function AdminMedia() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const { toast } = useToast();

  async function load() {
    setItems(await getAdminMedia());
  }
  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => {
    if (!q) return true;
    const haystack = [
      i.title,
      i.alt_text,
      i.file_name,
      i.image_url,
      i.project_title,
      i.projects?.title,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(q.toLowerCase());
  });

  async function remove(img: any) {
    if (!confirm("Bu görseli silmek istediğinize emin misiniz?")) return;
    await deleteAdminMediaImage(img.id);
    toast({ title: "Görsel silindi" });
    load();
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Proje Yönetimi"
        title="Medya"
        description="Projelerde kullanılan görselleri merkezi olarak inceleyin, URL kopyalayın veya gereksiz görselleri temizleyin."
      />
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Ara..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <AdminEmptyState title="Görsel bulunamadı" description="Proje düzenleme ekranından görsel yüklediğinizde medya kayıtları burada görünür." icon={ImageIcon} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((img) => (
            <div key={img.id} className="group relative rounded-md overflow-hidden border border-border bg-muted aspect-square">
              <img src={resolveImageUrl(img.image_url)} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 to-transparent text-white text-[10px]">
                <div className="truncate">{img.projects?.title || "—"}</div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => { navigator.clipboard.writeText(img.image_url); toast({ title: "URL kopyalandı" }); }}><Copy className="h-3 w-3 mr-1" /> Kopyala</Button>
                {img.can_delete !== false && <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={() => remove(img)}><Trash2 className="h-3 w-3" /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
