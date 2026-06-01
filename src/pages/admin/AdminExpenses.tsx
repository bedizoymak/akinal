import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { EXPENSE_CATEGORIES, formatTRY, formatDate, customerDisplayName, exportCSV } from "@/lib/finance";
import { Plus, Edit, Trash2, Download, Receipt, FolderKanban, Tags, CalendarDays, Loader2 } from "lucide-react";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { QuickCreateCustomerButton } from "@/components/admin/QuickCreateCustomerButton";
import { QuickCreateExpenseCategoryButton } from "@/components/admin/QuickCreateExpenseCategoryButton";
import { createAdminExpense, deleteAdminExpense, getAdminExpensesData, updateAdminExpense, uploadAdminExpenseDocument } from "@/lib/apiClient";

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
  const [saving, setSaving] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const data = await getAdminExpensesData();
      setItems(data.expenses || []); setCustomers(data.customers || []); setProjects(data.projects || []);
    } catch (error) {
      toast({ title: "Gider verileri alınamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...empty, project_id: filterProject !== "all" ? filterProject : "" }); setEditId(null); setOpen(true); }
  function openEdit(it: any) { setForm({ ...it, project_id: it.project_id || "", customer_id: it.customer_id || "", description: it.description || "", document_url: it.document_url || "", amount: String(it.amount) }); setEditId(it.id); setOpen(true); }
  function handleCustomerCreated(customer: any) {
    setCustomers((current) => [customer, ...current.filter((item) => item.id !== customer.id)]);
    setForm((current: any) => ({ ...current, customer_id: customer.id }));
  }
  function handleCategoryCreated(category: string) {
    setCustomCategories((current) => current.some((item) => item.toLocaleLowerCase("tr-TR") === category.toLocaleLowerCase("tr-TR")) ? current : [...current, category]);
    setForm((current: any) => ({ ...current, category }));
    setFilterCategory((current) => current === "all" ? current : category);
  }

  async function uploadDoc(file: File) {
    setUploading(true);
    try {
      const url = await uploadAdminExpenseDocument(file);
      setForm((f: any) => ({ ...f, document_url: url }));
      toast({ title: "Belge yüklendi" });
    } catch (error) {
      toast({ title: "Belge yüklenemedi", description: error instanceof Error ? error.message : "Belge yüklenirken bir problem oluştu. Lütfen dosyayı kontrol edip tekrar deneyin.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.title || !form.amount || !form.expense_date) { toast({ title: "Başlık, tutar ve tarih zorunludur", variant: "destructive" }); return; }
    setSaving(true);
    const payload: any = { ...form, amount: Number(form.amount), project_id: form.project_id || null, customer_id: form.customer_id || null };
    try {
      if (editId) await updateAdminExpense({ ...payload, id: editId });
      else await createAdminExpense(payload);
      toast({ title: editId ? "Gider güncellendi" : "Gider eklendi" });
      setOpen(false); load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Bu gider kaydını silmek istediğinize emin misiniz?")) return;
    await deleteAdminExpense(id);
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
  const categoryOptions = useMemo(() => Array.from(new Set([
    ...EXPENSE_CATEGORIES,
    ...items.map((item) => item.category).filter(Boolean),
    ...customCategories,
  ])), [customCategories, items]);
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
        <Select value={filterCategory} onValueChange={setFilterCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Kategoriler</SelectItem>{categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading ? <div className="text-center text-muted-foreground py-12">Yükleniyor...</div> : (
        <>
        {filtered.length === 0 ? (
          <div className="md:hidden">
            <AdminEmptyState title={items.length === 0 ? "Henüz gider kaydı yok" : "Gider kaydı bulunamadı"} description={items.length === 0 ? "İlk gider kaydını oluşturarak proje maliyetlerini takip etmeye başlayın." : "Filtreleri temizleyebilir veya yeni gider kaydı oluşturabilirsiniz."} icon={Receipt} />
          </div>
        ) : (
        <div className="space-y-3 md:hidden">
          {filtered.map((it) => (
            <div key={it.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{it.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{it.category} · {it.project?.title || "Proje yok"}</div>
                </div>
                <div className="shrink-0 text-right font-bold text-red-600">{formatTRY(it.amount)}</div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{formatDate(it.expense_date)} · {it.customer ? customerDisplayName(it.customer) : "Müşteri bağlantısı yok"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {it.document_url && <Button asChild size="sm" variant="outline"><a href={it.document_url} target="_blank" rel="noreferrer">Görüntüle</a></Button>}
                <Button size="sm" variant="outline" onClick={() => openEdit(it)}><Edit className="h-4 w-4" /> Düzenle</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /> Sil</Button>
              </div>
            </div>
          ))}
        </div>
        )}
        <div className="hidden bg-card border border-border rounded-md overflow-x-auto md:block">
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
                  <td className="p-3 text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" title="Düzenle" onClick={() => openEdit(it)}><Edit className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Düzenle</span></Button><Button size="sm" variant="ghost" title="Sil" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only xl:not-sr-only xl:ml-1">Sil</span></Button></div></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-8"><AdminEmptyState title={items.length === 0 ? "Henüz gider kaydı yok" : "Gider kaydı bulunamadı"} description={items.length === 0 ? "İlk gider kaydını oluşturarak proje maliyetlerini takip etmeye başlayın." : "Filtreleri temizleyebilir veya yeni gider kaydı oluşturabilirsiniz."} icon={Receipt} /></td></tr>}
            </tbody>
          </table>
        </div>
        </>
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
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <Label>Müşteri (opsiyonel)</Label>
                <QuickCreateCustomerButton onCreated={handleCustomerCreated} />
              </div>
              <Select value={form.customer_id || "none"} onValueChange={(v) => setForm((f: any) => ({ ...f, customer_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">— Seçilmedi —</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Gider Başlığı *</Label><Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} /></div>
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <Label>Gider Kategorisi</Label>
                <QuickCreateExpenseCategoryButton existingCategories={categoryOptions} onCreated={handleCategoryCreated} />
              </div>
              <Select value={form.category} onValueChange={(v) => setForm((f: any) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>İptal</Button>
            <Button onClick={save} disabled={saving || uploading} className="bg-accent hover:bg-accent-glow text-accent-foreground">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
