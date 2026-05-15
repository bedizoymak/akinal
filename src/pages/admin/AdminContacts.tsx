import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Phone, Mail, Search, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";

const STATUSES = ["Yeni", "Arandı", "Teklif Verildi", "Tamamlandı"];
const COLORS: Record<string, string> = {
  "Yeni": "bg-blue-100 text-blue-800",
  "Arandı": "bg-amber-100 text-amber-800",
  "Teklif Verildi": "bg-purple-100 text-purple-800",
  "Tamamlandı": "bg-emerald-100 text-emerald-800",
};

export default function AdminContacts() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const { toast } = useToast();

  async function load() {
    const { data } = await supabase.from("contact_requests").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  }
  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    await supabase.from("contact_requests").update({ status }).eq("id", id);
    toast({ title: "Durum güncellendi" });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Talebi silmek istediğinize emin misiniz?")) return;
    await supabase.from("contact_requests").delete().eq("id", id);
    toast({ title: "Talep silindi" });
    load();
  }

  const filtered = items.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (q && !`${r.full_name} ${r.phone} ${r.email || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <AdminPageHeader
        eyebrow="Operasyon"
        title="İletişim Talepleri"
        description="Web sitesinden gelen talepleri takip edin, durumlandırın ve hızlıca geri dönüş yapın."
      />
      <div className="grid md:grid-cols-2 gap-3 mb-5 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="all">Tüm Durumlar</SelectItem>
          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent></Select>
      </div>

      {filtered.length === 0 ? (
        <AdminEmptyState title="Talep bulunamadı" description="Filtreye uygun iletişim talebi yok. Yeni talepler web sitesi formundan geldiğinde burada görünür." icon={Inbox} />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-md">
              <button onClick={() => setOpen(open === r.id ? null : r.id)} className="w-full p-4 text-left flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.full_name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.phone} · {r.service_type || "—"} · {new Date(r.created_at).toLocaleString("tr-TR")}</div>
                </div>
                <span className={cn("px-2.5 py-1 text-[11px] font-semibold rounded", COLORS[r.status] || "bg-muted")}>{r.status}</span>
              </button>
              {open === r.id && (
                <div className="border-t border-border p-4 space-y-3">
                  {r.email && <div className="text-sm"><strong>E-posta:</strong> {r.email}</div>}
                  <div className="text-sm whitespace-pre-line bg-muted/40 p-3 rounded">{r.message}</div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <a href={`tel:${r.phone}`}><Button size="sm" variant="outline"><Phone className="h-3 w-3 mr-1" /> Ara</Button></a>
                    {r.email && <a href={`mailto:${r.email}`}><Button size="sm" variant="outline"><Mail className="h-3 w-3 mr-1" /> E-posta</Button></a>}
                    <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                      <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="destructive" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3 mr-1" /> Sil</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
