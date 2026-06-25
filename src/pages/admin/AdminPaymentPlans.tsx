import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { PAYMENT_METHODS, customerDisplayName, formatDate, formatTRY, exportCSV, accountType } from "@/lib/finance";
import { Plus, Download } from "lucide-react";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";
import {
  createAdminPaymentPlan,
  deleteAdminPaymentPlan,
  getAdminPaymentPlans,
  updateAdminPaymentPlan,
} from "@/lib/apiClient";

const PLAN_TYPES = ["Kapora", "Taksit", "Hakediş", "Diğer"];
const PLAN_CURRENCIES = ["TRY", "USD", "EUR", "XAU_GRAM"];

const emptyForm = {
  customer_id: "",
  project_id: "",
  title: "",
  description: "",
  type: "Diğer",
  amount: "",
  paid_amount: "",
  currency: "TRY",
  payment_method: "Nakit",
  transaction_reference: "",
  card_note: "",
  cheque_maturity_date: "",
  cheque_no: "",
  bank_name: "",
  promissory_maturity_date: "",
  account_type: "resmi",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function statusBadge(status: string | null | undefined) {
  const s = status || "";
  const map: Record<string, string> = {
    "Ödendi": "bg-green-100 text-green-800",
    "Fazla Ödendi": "bg-emerald-100 text-emerald-800",
    "Gecikmiş": "bg-red-100 text-red-800",
    "Kısmi Ödendi + Gecikmiş": "bg-orange-100 text-orange-800",
    "Kısmi Ödendi": "bg-yellow-100 text-yellow-800",
    "Planlanan": "bg-blue-100 text-blue-800",
  };
  return <Badge className={map[s] ?? "bg-gray-100 text-gray-700"}>{s || "—"}</Badge>;
}

export default function AdminPaymentPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAccount, setFilterAccount] = useState("all");
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const data = await getAdminPaymentPlans();
      setPlans(data.payment_plans || []);
      setCustomers(data.customers || []);
      setProjects(data.projects || []);
    } catch {
      toast({ title: "Veriler yüklenemedi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return plans.filter((p) => {
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterAccount !== "all" && accountType(p.account_type) !== filterAccount) return false;
      if (q) {
        const customer = customerMap.get(p.customer_id);
        const name = customerDisplayName(customer) + " " + (p.title || "");
        if (!name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [plans, search, filterStatus, filterAccount, customerMap]);

  function openNew() {
    setEditId(null);
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(plan: any) {
    setEditId(plan.id);
    setForm({
      customer_id: plan.customer_id || "",
      project_id: plan.project_id || "",
      title: plan.title || "",
      description: plan.description || "",
      type: plan.type || "Diğer",
      amount: String(plan.amount || ""),
      paid_amount: String(plan.paid_amount || ""),
      currency: plan.currency || "TRY",
      payment_method: plan.payment_method || "Nakit",
      transaction_reference: plan.transaction_reference || "",
      card_note: plan.card_note || "",
      cheque_maturity_date: plan.cheque_maturity_date || "",
      cheque_no: plan.cheque_no || "",
      bank_name: plan.bank_name || "",
      promissory_maturity_date: plan.promissory_maturity_date || "",
      account_type: accountType(plan.account_type),
      date: plan.date || plan.due_date || "",
      notes: plan.notes || "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.customer_id || !form.title || !form.amount || !form.date) {
      toast({ title: "Müşteri, başlık, tutar ve tarih zorunludur", variant: "destructive" });
      return;
    }
    if (!form.project_id) {
      toast({ title: "Proje seçimi zorunludur", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      amount: Number(form.amount),
      paid_amount: Number(form.paid_amount || 0),
      project_id: form.project_id || null,
    };
    try {
      if (editId) {
        await updateAdminPaymentPlan({ ...payload, id: editId });
        toast({ title: "Tahsilat kalemi güncellendi" });
      } else {
        await createAdminPaymentPlan(payload);
        toast({ title: "Tahsilat kalemi eklendi" });
      }
      setOpen(false);
      await load();
    } catch {
      toast({ title: "Kayıt tamamlanamadı", variant: "destructive" });
    }
  }

  async function remove() {
    if (!editId) return;
    if (!confirm("Bu tahsilat kalemini silmek istediğinize emin misiniz?")) return;
    try {
      await deleteAdminPaymentPlan(editId);
      toast({ title: "Tahsilat kalemi silindi" });
      setOpen(false);
      await load();
    } catch {
      toast({ title: "Silinemedi", variant: "destructive" });
    }
  }

  function doExport() {
    exportCSV(filtered.map((p) => ({
      Müşteri: customerDisplayName(customerMap.get(p.customer_id)),
      Proje: projectMap.get(p.project_id)?.title || "",
      Başlık: p.title,
      Tür: p.type,
      Tutar: p.amount,
      "Ödenen": p.paid_amount,
      "Para Birimi": p.currency,
      Tarih: p.date || p.due_date,
      Durum: p.status,
      "Hesap Türü": p.account_type === "gayri_resmi" ? "Gayri Resmi" : "Resmi",
    })), "gelenler");
  }

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Gelenler"
        description="Tüm müşteri tahsilat kalemleri"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={doExport}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            <Button size="sm" onClick={openNew} className="bg-accent hover:bg-accent-glow text-accent-foreground"><Plus className="h-4 w-4 mr-1" /> Yeni Kalem</Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Müşteri veya başlık ara..." className="max-w-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {["Planlanan","Gecikmiş","Kısmi Ödendi","Kısmi Ödendi + Gecikmiş","Ödendi","Fazla Ödendi"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Hesaplar</SelectItem>
            <SelectItem value="resmi">Resmi</SelectItem>
            <SelectItem value="gayri_resmi">Gayri Resmi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <AdminEmptyState icon="wallet" message="Kayıt bulunamadı." action={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Yeni Kalem</Button>} />
      ) : (
        <div className="rounded-md border border-border bg-card shadow-card-soft overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">Müşteri</th>
                <th className="p-3">Proje</th>
                <th className="p-3">Başlık</th>
                <th className="p-3">Tür</th>
                <th className="p-3">Tutar</th>
                <th className="p-3">Ödenen</th>
                <th className="p-3">Tarih</th>
                <th className="p-3">Durum</th>
                <th className="p-3">Hesap</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/30 cursor-pointer" onClick={() => openEdit(p)}>
                  <td className="p-3">{customerDisplayName(customerMap.get(p.customer_id)) || "—"}</td>
                  <td className="p-3">{projectMap.get(p.project_id)?.title || "—"}</td>
                  <td className="p-3 font-medium">{p.title}</td>
                  <td className="p-3 text-muted-foreground">{p.type || "—"}</td>
                  <td className="p-3">{formatTRY(p.amount)} {p.currency !== "TRY" ? p.currency : ""}</td>
                  <td className="p-3">{formatTRY(p.paid_amount)}</td>
                  <td className="p-3 whitespace-nowrap">{formatDate(p.date || p.due_date)}</td>
                  <td className="p-3">{statusBadge(p.status)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{p.account_type === "gayri_resmi" ? "Gayri Resmi" : "Resmi"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? "Kalemi Düzenle" : "Yeni Tahsilat Kalemi"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div><Label>Müşteri *</Label>
              <Select value={form.customer_id || "none"} onValueChange={(v) => setForm((f: any) => ({ ...f, customer_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Proje *</Label>
              <Select value={form.project_id || "none"} onValueChange={(v) => setForm((f: any) => ({ ...f, project_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Proje seçin" /></SelectTrigger>
                <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Hesap Türü</Label>
              <Select value={form.account_type || "resmi"} onValueChange={(v) => setForm((f: any) => ({ ...f, account_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="resmi">Resmi Hesap</SelectItem><SelectItem value="gayri_resmi">Gayri Resmi Hesap</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Tür</Label>
              <Select value={form.type || "Diğer"} onValueChange={(v) => setForm((f: any) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLAN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Başlık *</Label><Input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Tutar *</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Ödenen Tutar</Label><Input type="number" step="0.01" value={form.paid_amount} onChange={(e) => setForm((f: any) => ({ ...f, paid_amount: e.target.value }))} /></div>
            <div><Label>Para Birimi</Label>
              <Select value={form.currency || "TRY"} onValueChange={(v) => setForm((f: any) => ({ ...f, currency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLAN_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tarih *</Label><Input type="date" value={form.date} onChange={(e) => setForm((f: any) => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>Ödeme Yöntemi</Label>
              <Select value={form.payment_method || "Nakit"} onValueChange={(v) => setForm((f: any) => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.payment_method === "Banka Havalesi / EFT" && <div><Label>İşlem Referansı</Label><Input value={form.transaction_reference} onChange={(e) => setForm((f: any) => ({ ...f, transaction_reference: e.target.value }))} /></div>}
            {form.payment_method === "Kredi Kartı" && <div><Label>Kart Notu</Label><Input value={form.card_note} onChange={(e) => setForm((f: any) => ({ ...f, card_note: e.target.value }))} /></div>}
            {form.payment_method === "Çek" && <>
              <div><Label>Çek Vade Tarihi *</Label><Input type="date" value={form.cheque_maturity_date} onChange={(e) => setForm((f: any) => ({ ...f, cheque_maturity_date: e.target.value }))} /></div>
              <div><Label>Çek No</Label><Input value={form.cheque_no} onChange={(e) => setForm((f: any) => ({ ...f, cheque_no: e.target.value }))} /></div>
              <div><Label>Banka</Label><Input value={form.bank_name} onChange={(e) => setForm((f: any) => ({ ...f, bank_name: e.target.value }))} /></div>
            </>}
            {form.payment_method === "Senet" && <div><Label>Senet Vade Tarihi *</Label><Input type="date" value={form.promissory_maturity_date} onChange={(e) => setForm((f: any) => ({ ...f, promissory_maturity_date: e.target.value }))} /></div>}
            <div className="md:col-span-2"><Label>Açıklama</Label><Textarea value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="md:col-span-2"><Label>Not</Label><Textarea value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            {editId && <Button variant="destructive" onClick={remove}>Sil</Button>}
            <div className="flex flex-1 justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button onClick={save} className="bg-accent hover:bg-accent-glow text-accent-foreground">Kaydet</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
