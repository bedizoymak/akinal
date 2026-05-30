import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PAYMENT_METHODS, formatTRY, formatDate, customerDisplayName, exportCSV } from "@/lib/finance";
import { Plus, Edit, Trash2, Download, Wallet, Users, FolderKanban, CalendarDays, Loader2 } from "lucide-react";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { createAdminPayment, deleteAdminPayment, getAdminPaymentsData, updateAdminPayment, uploadAdminPaymentDocument } from "@/lib/apiClient";

const empty = { customer_id: "", project_id: "", payment_plan_id: "", amount: "", payment_date: new Date().toISOString().slice(0, 10), payment_method: "Nakit", description: "", document_url: "" };

export default function AdminCollections() {
  const [params] = useSearchParams();
  const preCustomer = params.get("musteri") || "";
  const shouldOpenNew = params.get("yeni") === "1";
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...empty, customer_id: preCustomer });
  const [editId, setEditId] = useState<string | null>(null);
  const [filterCustomer, setFilterCustomer] = useState(preCustomer || "all");
  const [filterProject, setFilterProject] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const data = await getAdminPaymentsData();
      setItems(data.payments || []); setCustomers(data.customers || []);
      setProjects(data.projects || []); setPlans(data.payment_plans || []);
    } catch (error) {
      toast({ title: "Tahsilat verileri alınamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (preCustomer || shouldOpenNew) {
      setForm((f: any) => ({ ...f, customer_id: preCustomer || f.customer_id }));
      setEditId(null);
      setOpen(true);
    }
  }, [preCustomer, shouldOpenNew]);

  function openNew() { setForm({ ...empty, customer_id: filterCustomer !== "all" ? filterCustomer : "" }); setEditId(null); setOpen(true); }
  function openEdit(it: any) { setForm({ ...it, project_id: it.project_id || "", payment_plan_id: it.payment_plan_id || "", description: it.description || "", document_url: it.document_url || "", amount: String(it.amount) }); setEditId(it.id); setOpen(true); }

  async function uploadDoc(file: File) {
    setUploading(true);
    try {
      const url = await uploadAdminPaymentDocument(file);
      setForm((f: any) => ({ ...f, document_url: url }));
      toast({ title: "Belge yüklendi" });
    } catch (error) {
      toast({ title: "Belge yüklenemedi", description: error instanceof Error ? error.message : "Belge yüklenirken bir problem oluştu. Lütfen dosyayı kontrol edip tekrar deneyin.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.customer_id || !form.amount || !form.payment_date) { toast({ title: "Müşteri, tutar ve tarih zorunludur", variant: "destructive" }); return; }
    setSaving(true);
    const selectedPlan = plans.find((p) => p.id === form.payment_plan_id);
    const payload: any = {
      ...form,
      amount: Number(form.amount),
      project_id: form.project_id || selectedPlan?.project_id || null,
      payment_plan_id: form.payment_plan_id || null,
    };
    try {
      if (editId) await updateAdminPayment({ ...payload, id: editId });
      else await createAdminPayment(payload);
      toast({ title: editId ? "Tahsilat güncellendi" : "Tahsilat eklendi" });
      setOpen(false); load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Bu tahsilat kaydını silmek istediğinize emin misiniz? İlgili ödeme planı durumu yeniden hesaplanacak.")) return;
    await deleteAdminPayment(id);
    toast({ title: "Silindi" }); load();
  }

  const enriched = useMemo(() => items.map((it) => ({
    ...it, customer: customers.find((c) => c.id === it.customer_id),
    project: projects.find((p) => p.id === it.project_id),
    plan: plans.find((p) => p.id === it.payment_plan_id),
  })), [items, customers, projects, plans]);

  const filtered = enriched.filter((it) => {
    if (filterCustomer !== "all" && it.customer_id !== filterCustomer) return false;
    if (filterProject !== "all" && it.project_id !== filterProject) return false;
    if (from && it.payment_date < from) return false;
    if (to && it.payment_date > to) return false;
    return true;
  });

  const customerPlans = plans.filter((p) => p.customer_id === form.customer_id);
  const total = filtered.reduce((s, x) => s + Number(x.amount), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = filtered.filter((x) => String(x.payment_date || "").startsWith(thisMonth)).reduce((s, x) => s + Number(x.amount), 0);
  const customerCount = new Set(filtered.map((x) => x.customer_id).filter(Boolean)).size;
  const projectCount = new Set(filtered.map((x) => x.project_id).filter(Boolean)).size;

  function downloadCSV() {
    exportCSV("tahsilatlar.csv", filtered.map((it) => ({
      "Tarih": it.payment_date, "Müşteri": it.customer ? customerDisplayName(it.customer) : "-",
      "Proje": it.project?.title || "-", "Plan": it.plan?.title || "-",
      "Tutar": it.amount, "Yöntem": it.payment_method, "Açıklama": it.description || "",
    })));
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Cari ve Tahsilat"
        title="Tahsilatlar"
        description="Gerçekleşen gelen ödemeleri takip edin. Ödeme planı seçerseniz ilgili proje bilgisi otomatik tamamlanır."
        actions={
          <>
          <Button variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-1" /> CSV Olarak İndir</Button>
          <Button onClick={openNew} className="bg-accent hover:bg-accent-glow text-accent-foreground"><Plus className="h-4 w-4" /> Yeni Tahsilat</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Toplam Tahsilat" value={formatTRY(total)} description="Seçili filtrelere göre" icon={Wallet} tone="success" />
        <AdminMetricCard label="Bu Ay Tahsilat" value={formatTRY(monthTotal)} description="Geçerli ay içindeki kayıtlar" icon={CalendarDays} tone="success" />
        <AdminMetricCard label="Müşteri Sayısı" value={customerCount} description="Filtrede tahsilatı olan cari" icon={Users} tone="default" />
        <AdminMetricCard label="Proje Sayısı" value={projectCount} description="Filtrede bağlantılı proje" icon={FolderKanban} tone="accent" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 p-4 bg-card border border-border rounded-md">
        <Select value={filterCustomer} onValueChange={setFilterCustomer}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Müşteriler</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}</SelectContent></Select>
        <Select value={filterProject} onValueChange={setFilterProject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Projeler</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Başlangıç" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Bitiş" />
      </div>

      {loading ? <div className="text-center text-muted-foreground py-12">Yükleniyor...</div> : (
        <>
        {filtered.length === 0 ? (
          <div className="md:hidden">
            <AdminEmptyState title={items.length === 0 ? "Henüz tahsilat kaydı yok" : "Tahsilat kaydı bulunamadı"} description={items.length === 0 ? "İlk tahsilatı ekleyerek gerçekleşen ödemeleri takip etmeye başlayın." : "Filtreleri temizleyebilir veya yeni tahsilat kaydı oluşturabilirsiniz."} icon={Wallet} />
          </div>
        ) : (
        <div className="space-y-3 md:hidden">
          {filtered.map((it) => (
            <div key={it.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{it.customer ? customerDisplayName(it.customer) : "Müşteri yok"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{it.project?.title || "Proje yok"} · {it.plan?.title || "Plan bağlantısı yok"}</div>
                </div>
                <div className="shrink-0 text-right font-bold text-emerald-700">{formatTRY(it.amount)}</div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{formatDate(it.payment_date)} · {it.payment_method}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {it.document_url && <Button asChild size="sm" variant="outline"><a href={it.document_url} target="_blank" rel="noreferrer">Görüntüle</a></Button>}
                <Button size="sm" variant="outline" onClick={() => openEdit(it)}><Edit className="h-4 w-4" /> Düzenle</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(it.id, it.payment_plan_id)}><Trash2 className="h-4 w-4 text-destructive" /> Sil</Button>
              </div>
            </div>
          ))}
        </div>
        )}
        <div className="hidden bg-card border border-border rounded-md overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-left">Müşteri</th><th className="p-3 text-left">Proje</th><th className="p-3 text-left">Plan</th><th className="p-3 text-right">Tutar</th><th className="p-3">Yöntem</th><th className="p-3">Belge</th><th className="p-3 text-right">İşlem</th></tr></thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="p-3">{formatDate(it.payment_date)}</td>
                  <td className="p-3">{it.customer ? customerDisplayName(it.customer) : "-"}</td>
                  <td className="p-3 text-xs">{it.project?.title || "-"}</td>
                  <td className="p-3 text-xs">{it.plan?.title || "-"}</td>
                  <td className="p-3 text-right text-emerald-700 font-medium">{formatTRY(it.amount)}</td>
                  <td className="p-3">{it.payment_method}</td>
                  <td className="p-3">{it.document_url ? <a href={it.document_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Görüntüle</a> : "-"}</td>
                  <td className="p-3 text-right"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" title="Düzenle" onClick={() => openEdit(it)}><Edit className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Düzenle</span></Button><Button size="sm" variant="ghost" title="Sil" onClick={() => remove(it.id, it.payment_plan_id)}><Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only xl:not-sr-only xl:ml-1">Sil</span></Button></div></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="p-8"><AdminEmptyState title={items.length === 0 ? "Henüz tahsilat kaydı yok" : "Tahsilat kaydı bulunamadı"} description={items.length === 0 ? "İlk tahsilatı ekleyerek gerçekleşen ödemeleri takip etmeye başlayın." : "Filtreleri temizleyebilir veya yeni tahsilat kaydı oluşturabilirsiniz."} icon={Wallet} /></td></tr>}
            </tbody>
          </table>
        </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? "Tahsilatı Düzenle" : "Yeni Tahsilat"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Müşteri *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm((f: any) => ({ ...f, customer_id: v, payment_plan_id: "" }))}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Proje</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => setForm((f: any) => ({ ...f, project_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">— Seçilmedi —</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>İlgili Ödeme Planı</Label>
              <Select value={form.payment_plan_id || "none"} onValueChange={(v) => {
                const plan = plans.find((p) => p.id === v);
                setForm((f: any) => ({
                  ...f,
                  payment_plan_id: v === "none" ? "" : v,
                  project_id: v === "none" ? f.project_id : plan?.project_id || f.project_id,
                }));
              }}>
                <SelectTrigger><SelectValue placeholder="Plan seçin" /></SelectTrigger>
                <SelectContent><SelectItem value="none">— Yok —</SelectItem>{customerPlans.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} ({formatTRY(p.amount)} - {formatDate(p.due_date)})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tahsilat Tutarı *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Tahsilat Tarihi *</Label><Input type="date" value={form.payment_date} onChange={(e) => setForm((f: any) => ({ ...f, payment_date: e.target.value }))} /></div>
            <div className="md:col-span-2"><Label>Ödeme Yöntemi</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm((f: any) => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Açıklama</Label><Textarea value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="md:col-span-2"><Label>Makbuz / Belge</Label>
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
