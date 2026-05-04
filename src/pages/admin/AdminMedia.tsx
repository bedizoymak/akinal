import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, Search } from "lucide-react";
import { resolveImageUrl } from "@/lib/projects";

export default function AdminMedia() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const { toast } = useToast();

  async function load() {
    const { data } = await supabase.from("project_images").select("*, projects(title,slug)").order("created_at", { ascending: false });
    setItems(data || []);
  }
  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => !q || (i.title || i.image_url || "").toLowerCase().includes(q.toLowerCase()));

  async function remove(img: any) {
    if (!confirm("Bu görseli silmek istediğinize emin misiniz?")) return;
    await supabase.from("project_images").delete().eq("id", img.id);
    toast({ title: "Görsel silindi" });
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-1">Medya Galerisi</h1>
      <p className="text-muted-foreground text-sm mb-6">Tüm proje görsellerinin merkezi listesi.</p>
      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Ara..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-md">Görsel bulunamadı.</div>
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
                <Button size="sm" variant="destructive" className="h-7 w-7 p-0" onClick={() => remove(img)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
