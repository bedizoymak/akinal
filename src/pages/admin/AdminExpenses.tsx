import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_CATEGORIES, formatTRY, formatDate, customerDisplayName, exportCSV } from "@/lib/finance";
import { Plus, Edit, Trash2, Download, Receipt, FolderKanban, Tags, CalendarDays } from "lucide-react";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";

const empty = { project_id: "", customer_id: "", title: "", category: "Malzeme", amount: "", expense_date: new Date().toISOString().slice(0, 10), description: "", document_url: "" };

export default function AdminExpenses() {
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterProject, setFilterProject] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const [it, c, pr] = await Promise.all([
      (supabase.from("expenses" as any).select("*").order("expense_date", { ascending: false })) as any,
      (supabase.from("customers" as any).select("*")) as any,
      supabase.from("projects").select("id,title"),
    ]);
    setItems((it.data as any[]) || []); setCustomers((c.data as any[]) || []); setProjects((pr.data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...empty, project_id: filterProject !== "all" ? filterProject : "" }); setEditId(null); setOpen(true); }
  function openEdit(it: any) { setForm({ ...it, project_id: it.project_id || "", customer_id: it.customer_id || "", description: it.description || "", document_url: it.document_url || "", amount: String(it.amount) }); setEditId(it.id); setOpen(true); }

  async function uploadDoc(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("expense-documents").upload(path, file);
    if (error) { toast({ title: "Yükleme hatası", description: error.message, variant: "destructive" }); setUploading(false); return; }
    const { data } = await supabase.storage.from("expense-documents").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    setForm((f: any) => ({ ...f, document_url: data?.signedUrl || "" }));
    setUploading(false); toast({ title: "Belge yüklendi" });
  }

  async function save() {
    if (!form.title || !form.amount || !form.expense_date) { toast({ title: "Başlık, tutar ve tarih zorunludur", variant: "destructive" }); return; }
    const payload: any = { ...form, amount: Number(form.amount), project_id: form.project_id || null, customer_id: form.customer_id || null };
    if (editId) await (supabase.from("expenses" as any).update(payload).eq("id", editId)) as any;
    else await (supabase.from("expenses" as any).insert(payload)) as any;
    toast({ title: editId ? "Gider güncellendi" : "Gider eklendi" });
    setOpen(false); load();
  }

  async function remove(id: string) {
    if (!confirm("Gider silinsin mi?")) return;
    await (supabase.from("expenses" as any).delete().eq("id", id)) as any;
    toast({ title: "Silindi" }); load();
  }

  const enriched = useMemo(() => items.map((it) => ({
    ...it, customer: customers.find((c) => c.id === it.customer_id),
    project: projects.find((p) => p.id === it.project_id),
  })), [items, customers, projects]);

  const filtered = enriched.filter((it) => {
    if (filterProject !== "all" && it.project_id !== filterProject) return false;
    if (filterCategory !== "all" && it.category !== filterCategory) return false;
    if (from && it.expense_date < from) return false;
    if (to && it.expense_date > to) return false;
    return true;
  });

  const total = filtered.reduce((s, x) => s + Number(x.amount), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = filtered.filter((x) => String(x.expense_date || "").startsWith(thisMonth)).reduce((s, x) => s + Number(x.amount), 0);
  const projectCount = new Set(filtered.map((x) => x.project_id).filter(Boolean)).size;
  const categoryCount = new Set(filtered.map((x) => x.category).filter(Boolean)).size;

  function downloadCSV() {
    exportCSV("giderler.csv", filtered.map((it) => ({
      "Tarih": it.expense_date, "Proje": it.project?.title || "-", "Müşteri": it.customer ? customerDisplayName(it.customer) : "-",
      "Başlık": it.title, "Kategori": it.category, "Tutar": it.amount, "Açıklama": it.description || "",
    })));
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Finans"
        title="Giderler"
        description="Proje, kategori, müşteri ve belge bağlantılarıyla tüm masrafları kontrol altında tutun."
        actions={
          <>
          <Button variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-1" /> CSV Olarak İndir</Button>
          <Button onClick={openNew} className="bg-accent hover:bg-accent-glow text-accent-foreground"><Plus className="h-4 w-4" /> Yeni Gider</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Toplam Gider" value={formatTRY(total)} description="Seçili filtrelere göre" icon={Receipt} tone="danger" />
        <AdminMetricCard label="Bu Ay Gider" value={formatTRY(monthTotal)} description="Geçerli ay içindeki masraflar" icon={CalendarDays} tone="warning" />
        <AdminMetricCard label="Proje Sayısı" value={projectCount} description="Gider yazılan projeler" icon={FolderKanban} tone="accent" />
        <AdminMetricCard label="Kategori Sayısı" value={categoryCount} description="Kullanılan gider kategorileri" icon={Tags} tone="default" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 p-4 bg-card border border-border rounded-md">
        <Select value={filterProject} onValueChange={setFilterProject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Projeler</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Kategoriler</SelectItem>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading ? <div className="text-center text-muted-foreground py-12">Yükleniyor...</div> : (
        <div className="bg-card border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-left">Başlık</th><th className="p-3">Kategori</th><th className="p-3 text-left">Proje</th><th className="p-3 text-left">Müşteri</th><th className="p-3 text-right">Tutar</th><th className="p-3">Belge</th><th className="p-3 text-right">İşlem</th></tr></thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="p-3">{formatDate(it.expense_date)}</td>
                  <td className="p-3">{it.title}</td>
                  <td className="p-3 text-xs">{it.category}</td>
                  <td className="p-3 text-xs">{it.project?.title || "-"}</td>
                  <td className="p-3 text-xs">{it.customer ? customerDisplayName(it.customer) : "-"}</td>
                  <td className="p-3 text-right text-red-600 font-medium">{formatTRY(it.amount)}</td>
                  <td className="p-3">{it.document_url ? <a href={it.document_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Görüntüle</a> : "-"}</td>
                  <td className="p-3 text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => openEdit(it)}><Edit className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-8"><AdminEmptyState title="Gider kaydı bulunamadı" description="Filtreleri temizleyebilir veya yeni gider kaydı oluşturabilirsiniz." icon={Receipt} /></td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? "Gideri Düzenle" : "Yeni Gider"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Proje</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => setForm((f: any) => ({ ...f, project_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">— Seçilmedi —</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Müşteri (opsiyonel)</Label>
              <Select value={form.customer_id || "none"} onValueChange={(v) => setForm((f: any) => ({ ...f, customer_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">— Seçilmedi —</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Gider Başlığı *</Label><Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Gider Kategorisi</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f: any) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tutar *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Tarih *</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm((f: any) => ({ ...f, expense_date: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Açıklama</Label><Textarea value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="md:col-span-2"><Label>Fatura / Belge</Label>
              <div className="flex gap-2 items-center">
                <Input type="file" accept="image/*,application/pdf" onChange={(e) => e.target.files && uploadDoc(e.target.files[0])} disabled={uploading} />
                {form.document_url && <a href={form.document_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">Yüklü belge</a>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={save} className="bg-accent hover:bg-accent-glow text-accent-foreground">Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
