import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit, Trash2, Eye, Download, Phone, MessageCircle, Users, Wallet, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CUSTOMER_TYPES, CUSTOMER_STATUSES, customerDisplayName, displayLabel, formatTRY, statusBadgeClass, exportCSV, whatsappLink } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const [c, p, py, l, pr] = await Promise.all([
      (supabase.from("customers" as any).select("*").order("created_at", { ascending: false })) as any,
      (supabase.from("payment_plans" as any).select("customer_id,amount")) as any,
      (supabase.from("payments" as any).select("customer_id,amount")) as any,
      (supabase.from("customer_projects" as any).select("customer_id,project_id")) as any,
      supabase.from("projects").select("id,title").order("sort_order"),
    ]);
    setCustomers((c.data as any[]) || []);
    setPlans((p.data as any[]) || []);
    setPays((py.data as any[]) || []);
    setLinks((l.data as any[]) || []);
    setProjects((pr.data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const enriched = useMemo(() => {
    return customers.map((c) => {
      const totalDue = plans.filter((x) => x.customer_id === c.id).reduce((s, x) => s + Number(x.amount), 0);
      const totalPaid = pays.filter((x) => x.customer_id === c.id).reduce((s, x) => s + Number(x.amount), 0);
      const projectIds = links.filter((x) => x.customer_id === c.id).map((x) => x.project_id);
      const projectNames = projects.filter((p) => projectIds.includes(p.id)).map((p) => p.title);
      return { ...c, totalDue, totalPaid, balance: totalDue - totalPaid, projectIds, projectNames };
    });
  }, [customers, plans, pays, links, projects]);

  const filtered = enriched.filter((c) => {
    const name = customerDisplayName(c).toLowerCase();
    if (q && !`${name} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (type !== "all" && c.customer_type !== type) return false;
    if (status !== "all" && c.status !== status) return false;
    if (projectFilter !== "all" && !c.projectIds.includes(projectFilter)) return false;
    if (balanceFilter === "with" && c.balance <= 0) return false;
    if (balanceFilter === "clear" && c.balance > 0) return false;
    return true;
  });

  const summary = {
    totalCustomers: enriched.length,
    totalCollected: enriched.reduce((sum, customer) => sum + customer.totalPaid, 0),
    pendingBalance: enriched.reduce((sum, customer) => sum + Math.max(0, customer.balance), 0),
    clearAccounts: enriched.filter((customer) => customer.balance <= 0).length,
  };

  async function remove(id: string, name: string) {
    if (!confirm(`"${name}" müşteri kaydını silmek istediğinize emin misiniz? Bu işlem bağlı ödeme planlarını ve tahsilatları da etkileyebilir.`)) return;
    await (supabase.from("customers" as any).delete().eq("id", id) as any);
    toast({ title: "Müşteri silindi" });
    load();
  }

  function downloadCSV() {
    exportCSV("musteriler.csv", filtered.map((c) => ({
      "Müşteri": customerDisplayName(c),
      "Tür": displayLabel(c.customer_type),
      "Telefon": c.phone,
      "E-posta": c.email || "",
      "Şehir": c.city || "",
      "Projeler": c.projectNames.join(", "),
      "Planlanan Alacak": c.totalDue,
      "Tahsil Edilen": c.totalPaid,
      "Kalan Bakiye": c.balance,
      "Durum": displayLabel(c.status),
    })));
  }

  return (
    <div>
      <AdminPageHeader
        eyebrow="Cari ve Tahsilat"
        title="Müşteriler"
        description="Müşteri ilişkilerini, proje bağlantılarını, tahsilatları ve kalan bakiyeleri tek yerden izleyin."
        actions={
          <>
          <Button variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-1" /> CSV Olarak İndir</Button>
          <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to="/admin/musteriler/yeni"><Plus className="h-4 w-4" /> Yeni Müşteri</Link></Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Toplam Müşteri" value={summary.totalCustomers} description="Kayıtlı cari hesap" icon={Users} tone="accent" />
        <AdminMetricCard label="Toplam Tahsilat" value={formatTRY(summary.totalCollected)} description="Müşterilerden alınan toplam" icon={Wallet} tone="success" />
        <AdminMetricCard label="Bekleyen Tahsilat" value={formatTRY(summary.pendingBalance)} description="Kalan müşteri bakiyesi" icon={AlertTriangle} tone={summary.pendingBalance > 0 ? "warning" : "success"} />
        <AdminMetricCard label="Bakiyesi Kapanan" value={summary.clearAccounts} description="Alacağı kalmayan müşteri" icon={CheckCircle2} tone="success" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5 p-4 bg-card border border-border rounded-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Ara..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Türler</SelectItem>{CUSTOMER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Durumlar</SelectItem>{CUSTOMER_STATUSES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Projeler</SelectItem>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent></Select>
        <Select value={balanceFilter} onValueChange={setBalanceFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Bakiyeler</SelectItem><SelectItem value="with">Bakiyesi Olan</SelectItem><SelectItem value="clear">Bakiyesi Sıfır</SelectItem></SelectContent></Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title={customers.length === 0 ? "Henüz müşteri kaydı yok" : "Müşteri bulunamadı"}
          description={customers.length === 0 ? "İlk müşteri kartını oluşturarak cari takibe başlayın." : "Arama veya filtreleri temizleyebilir, yeni müşteri kaydı oluşturabilirsiniz."}
          icon={Users}
          action={<Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to="/admin/musteriler/yeni">Yeni Müşteri Ekle</Link></Button>}
        />
      ) : (
        <div className="overflow-x-auto bg-card border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Müşteri</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Projeler</th>
                <th className="p-3 text-right">Planlanan Alacak</th>
                <th className="p-3 text-right">Tahsil Edilen</th>
                <th className="p-3 text-right">Kalan Bakiye</th>
                <th className="p-3">Durum</th>
                <th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-semibold">{customerDisplayName(c)}</div>
                    <div className="text-xs text-muted-foreground">{displayLabel(c.customer_type)}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" /> {c.phone || "-"}</div>
                    {c.whatsapp && <a href={whatsappLink(c.whatsapp, "Merhaba, Akınal İnşaat")} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-emerald-700"><MessageCircle className="h-3 w-3" /> {c.whatsapp}</a>}
                  </td>
                  <td className="p-3 text-xs">{c.projectNames.join(", ") || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-right font-medium">{formatTRY(c.totalDue)}</td>
                  <td className="p-3 text-right text-emerald-700">{formatTRY(c.totalPaid)}</td>
                  <td className={cn("p-3 text-right font-bold", c.balance > 0 ? "text-red-600" : "text-emerald-700")}>{formatTRY(c.balance)}</td>
                  <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass(c.status))}>{displayLabel(c.status)}</span></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="outline"><Link to={`/admin/musteriler/${c.id}/finans`}><FileText className="h-4 w-4" /> Ekstre</Link></Button>
                      <Button asChild size="sm" variant="ghost"><Link to={`/admin/musteriler/${c.id}`}><Eye className="h-4 w-4" /></Link></Button>
                      <Button asChild size="sm" variant="ghost"><Link to={`/admin/musteriler/${c.id}/duzenle`}><Edit className="h-4 w-4" /></Link></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id, customerDisplayName(c))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
