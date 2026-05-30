import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { PAYMENT_PLAN_STATUSES, formatTRY, formatDate, statusBadgeClass, customerDisplayName, daysUntil, exportCSV, whatsappLink, derivePlanStatus } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { Plus, Edit, Trash2, Download, MessageCircle, CalendarClock, AlertTriangle, Wallet, CheckCircle2, Loader2 } from "lucide-react";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { createAdminPaymentPlan, deleteAdminPaymentPlan, getAdminPaymentPlansData, updateAdminPaymentPlan } from "@/lib/apiClient";

const empty = { customer_id: "", project_id: "", title: "", description: "", amount: "", due_date: "", status: "Bekliyor", notes: "" };

export default function AdminPaymentPlans() {
  const [params] = useSearchParams();
  const preCustomer = params.get("musteri") || "";
  const [plans, setPlans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...empty, customer_id: preCustomer });
  const [editId, setEditId] = useState<string | null>(null);
  const [filterCustomer, setFilterCustomer] = useState(preCustomer || "all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const data = await getAdminPaymentPlansData();
      setPlans(data.payment_plans || []);
      setCustomers(data.customers || []);
      setProjects(data.projects || []);
      setPays(data.payments || []);
    } catch (error) {
      toast({ title: "Ödeme planı verileri alınamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (preCustomer) { setForm((f: any) => ({ ...f, customer_id: preCustomer })); setOpen(true); } }, [preCustomer]);

  function openNew() { setForm({ ...empty, customer_id: filterCustomer !== "all" ? filterCustomer : "" }); setEditId(null); setOpen(true); }
  function openEdit(p: any) { setForm({ ...p, project_id: p.project_id || "", amount: String(p.amount), notes: p.notes || "", description: p.description || "" }); setEditId(p.id); setOpen(true); }

  async function save() {
    if (!form.customer_id || !form.title || !form.amount || !form.due_date) {
      toast({ title: "Müşteri, başlık, tutar ve vade tarihi zorunludur", variant: "destructive" }); return;
    }
    setSaving(true);
    const payload: any = { ...form, amount: Number(form.amount), project_id: form.project_id || null };
    try {
      if (editId) {
        await updateAdminPaymentPlan({ ...payload, id: editId });
        toast({ title: "Ödeme planı güncellendi" });
      } else {
        await createAdminPaymentPlan(payload);
        toast({ title: "Ödeme planı eklendi" });
      }
      setOpen(false); load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Bu ödeme planını silmek istediğinize emin misiniz? Bağlı tahsilat takibi etkilenebilir.")) return;
    await deleteAdminPaymentPlan(id);
    toast({ title: "Silindi" }); load();
  }

  const enriched = useMemo(() => plans.map((p) => {
    const paid = pays.filter((x) => x.payment_plan_id === p.id).reduce((s, x) => s + Number(x.amount), 0);
    const remain = Math.max(0, Number(p.amount) - paid);
    const computed = derivePlanStatus(p, paid);
    const customer = customers.find((c) => c.id === p.customer_id);
    const project = projects.find((pr) => pr.id === p.project_id);
    return { ...p, paid, remain, computed, customer, project };
  }), [plans, pays, customers, projects]);

  const filtered = enriched.filter((p) => {
    if (filterCustomer !== "all" && p.customer_id !== filterCustomer) return false;
    if (filterProject !== "all" && p.project_id !== filterProject) return false;
    if (filterStatus !== "all" && p.computed !== filterStatus) return false;
    const d = daysUntil(p.due_date);
    if (filterPeriod === "overdue" && !(d < 0 && p.computed !== "Ödendi")) return false;
    if (filterPeriod === "upcoming" && !(d >= 0 && d <= 30 && p.computed !== "Ödendi")) return false;
    return true;
  });

  const summary = {
    total: enriched.reduce((sum, plan) => sum + Number(plan.amount || 0), 0),
    paid: enriched.reduce((sum, plan) => sum + plan.paid, 0),
    remaining: enriched.reduce((sum, plan) => sum + plan.remain, 0),
    overdue: enriched.filter((plan) => plan.computed === "Gecikti").reduce((sum, plan) => sum + plan.remain, 0),
    completed: enriched.filter((plan) => plan.computed === "Ödendi").length,
  };

  function downloadCSV() {
    exportCSV("odeme-planlari.csv", filtered.map((p) => ({
      "Müşteri": p.customer ? customerDisplayName(p.customer) : "-", "Proje": p.project?.title || "-",
      "Başlık": p.title, "Vade": p.due_date, "Tutar": p.amount, "Ödenen": p.paid, "Kalan": p.remain, "Durum": p.computed,
    })));
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Cari ve Tahsilat"
        title="Ödeme Planları"
        description="Beklenen veya vadeli alacakları takip edin. Gerçekleşen ödeme geldiğinde Tahsilatlar ekranından kaydedilir."
        actions={
          <>
          <Button variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-1" /> CSV Olarak İndir</Button>
          <Button onClick={openNew} className="bg-accent hover:bg-accent-glow text-accent-foreground"><Plus className="h-4 w-4" /> Ödeme Planı Ekle</Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Brüt Plan Tutarı" value={formatTRY(summary.total)} description="Planlanan toplam alacak" icon={CalendarClock} tone="accent" />
        <AdminMetricCard label="Ödenen Tutar" value={formatTRY(summary.paid)} description="Planlara bağlı tahsilat" icon={CheckCircle2} tone="success" />
        <AdminMetricCard label="Kalan Tutar" value={formatTRY(summary.remaining)} description="Henüz tahsil edilmemiş" icon={Wallet} tone="warning" />
        <AdminMetricCard label="Geciken Tutar" value={formatTRY(summary.overdue)} description={`${summary.completed} plan tamamlandı`} icon={AlertTriangle} tone={summary.overdue > 0 ? "danger" : "success"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 p-4 bg-card border border-border rounded-md">
        <Select value={filterCustomer} onValueChange={setFilterCustomer}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Müşteriler</SelectItem>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}</SelectContent></Select>
        <Select value={filterProject} onValueChange={setFilterProject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Projeler</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Durumlar</SelectItem>{PAYMENT_PLAN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Select value={filterPeriod} onValueChange={setFilterPeriod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Vadeler</SelectItem><SelectItem value="overdue">Vadesi Geçenler</SelectItem><SelectItem value="upcoming">Yaklaşanlar (30 Gün)</SelectItem></SelectContent></Select>
      </div>

      {loading ? <div className="text-center text-muted-foreground py-12">Yükleniyor...</div> : (
        <>
        {filtered.length === 0 ? (
          <div className="md:hidden">
            <AdminEmptyState title={plans.length === 0 ? "Henüz ödeme planı yok" : "Ödeme planı bulunamadı"} description={plans.length === 0 ? "İlk ödeme planını oluşturarak beklenen tahsilatları takip etmeye başlayın." : "Filtreleri temizleyebilir veya yeni ödeme planı oluşturabilirsiniz."} icon={CalendarClock} />
          </div>
        ) : (
        <div className="space-y-3 md:hidden">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.customer ? customerDisplayName(p.customer) : "Müşteri yok"} · {p.project?.title || "Proje yok"}</div>
                </div>
                <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-xs", statusBadgeClass(p.computed))}>{p.computed}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><div className="text-xs text-muted-foreground">Tutar</div><div className="font-semibold">{formatTRY(p.amount)}</div></div>
                <div><div className="text-xs text-muted-foreground">Ödenen</div><div className="font-semibold text-emerald-700">{formatTRY(p.paid)}</div></div>
                <div><div className="text-xs text-muted-foreground">Kalan</div><div className="font-semibold">{formatTRY(p.remain)}</div></div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">Vade: {formatDate(p.due_date)} · {daysUntil(p.due_date) < 0 ? `${Math.abs(daysUntil(p.due_date))} gün geçti` : `${daysUntil(p.due_date)} gün kaldı`}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.customer?.whatsapp && <Button asChild size="sm" variant="outline"><a href={whatsappLink(p.customer.whatsapp, `Merhaba, Akinal İnşaat ödeme planınıza göre ${formatDate(p.due_date)} tarihli ${formatTRY(p.remain)} ödemeniz bulunmaktadır. Bilginize sunarız.`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 text-emerald-700" /> Hatırlat</a></Button>}
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /> Düzenle</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /> Sil</Button>
              </div>
            </div>
          ))}
        </div>
        )}
        <div className="hidden bg-card border border-border rounded-md overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Müşteri</th><th className="p-3 text-left">Proje</th><th className="p-3 text-left">Başlık</th>
                <th className="p-3">Vade</th><th className="p-3 text-right">Tutar</th><th className="p-3 text-right">Ödenen</th>
                <th className="p-3 text-right">Kalan</th><th className="p-3">Durum</th><th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3">{p.customer ? customerDisplayName(p.customer) : <span className="text-muted-foreground">-</span>}</td>
                  <td className="p-3 text-xs">{p.project?.title || "-"}</td>
                  <td className="p-3"><div className="font-medium">{p.title}</div>{p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}</td>
                  <td className="p-3"><div>{formatDate(p.due_date)}</div><div className="text-xs text-muted-foreground">{daysUntil(p.due_date) < 0 ? `${Math.abs(daysUntil(p.due_date))} gün geçti` : `${daysUntil(p.due_date)} gün kaldı`}</div></td>
                  <td className="p-3 text-right">{formatTRY(p.amount)}</td>
                  <td className="p-3 text-right text-emerald-700">{formatTRY(p.paid)}</td>
                  <td className="p-3 text-right font-bold">{formatTRY(p.remain)}</td>
                  <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass(p.computed))}>{p.computed}</span></td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      {p.customer?.whatsapp && <Button asChild size="sm" variant="ghost" title="WhatsApp ile Hatırlat"><a href={whatsappLink(p.customer.whatsapp, `Merhaba, Akinal İnşaat ödeme planınıza göre ${formatDate(p.due_date)} tarihli ${formatTRY(p.remain)} ödemeniz bulunmaktadır. Bilginize sunarız.`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 text-emerald-700" /></a></Button>}
                      <Button size="sm" variant="ghost" title="Düzenle" onClick={() => openEdit(p)}><Edit className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Düzenle</span></Button>
                      <Button size="sm" variant="ghost" title="Sil" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only xl:not-sr-only xl:ml-1">Sil</span></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={9} className="p-8"><AdminEmptyState title={plans.length === 0 ? "Henüz ödeme planı yok" : "Ödeme planı bulunamadı"} description={plans.length === 0 ? "İlk ödeme planını oluşturarak beklenen tahsilatları takip etmeye başlayın." : "Filtreleri temizleyebilir veya yeni ödeme planı oluşturabilirsiniz."} icon={CalendarClock} /></td></tr>}
            </tbody>
          </table>
        </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? "Ödeme Planını Düzenle" : "Yeni Ödeme Planı"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Müşteri *</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm((f: any) => ({ ...f, customer_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Proje</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => setForm((f: any) => ({ ...f, project_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Proje seçin" /></SelectTrigger>
                <SelectContent><SelectItem value="none">— Seçilmedi —</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Ödeme Başlığı *</Label><Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Örn: 1. Taksit, Peşinat" /></div>
            <div><Label>Tutar *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Vade Tarihi *</Label><Input type="date" value={form.due_date} onChange={(e) => setForm((f: any) => ({ ...f, due_date: e.target.value }))} /></div>
            <div><Label>Durum</Label>
              <p className="mb-1 text-xs text-muted-foreground">Tahsilat girildikçe plan durumu otomatik yeniden hesaplanır.</p>
              <Select value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_PLAN_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Açıklama</Label><Textarea value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="md:col-span-2"><Label>Not</Label><Textarea value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>İptal</Button>
            <Button onClick={save} disabled={saving} className="bg-accent hover:bg-accent-glow text-accent-foreground">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
