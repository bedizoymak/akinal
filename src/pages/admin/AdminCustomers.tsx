import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit, Trash2, Eye, Download, Phone, MessageCircle, Users, Wallet, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDelete } from "@/hooks/useConfirmDelete";
import { CUSTOMER_TYPES, accountType, allocateCollectionsToPlans, customerDisplayName, displayLabel, formatTRY, exportCSV, whatsappLink, summarizeCustomerLedgerEntries, summarizePaymentPlansWithCanonicalState } from "@/lib/finance";
import { formatTurkishPhone } from "@/lib/customerMasterData";
import { cn } from "@/lib/utils";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader } from "@/components/admin/AdminPage";
import { deleteAdminCustomer, getAdminCustomersData } from "@/lib/apiClient";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [financialEntries, setFinancialEntries] = useState<any[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const { toast } = useToast();
  const { confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      const data = await getAdminCustomersData();
      setCustomers(data.customers || []);
      setPlans(data.payment_plans || []);
      setPays(data.payments || []);
      setFinancialEntries(data.financial_entries || []);
      setLinks(data.customer_projects || []);
      setProjects(data.projects || []);
    } catch (error) {
      toast({ title: "Müşteri verileri alınamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const enriched = useMemo(() => {
    return customers.map((c) => {
      const customerPlans = plans.filter((plan) => plan.customer_id === c.id);
      const customerEntries = financialEntries.filter((entry) => entry.customer_id === c.id);
      const ledgerSummary = summarizeCustomerLedgerEntries(customerEntries);
      const customerSummary = ["resmi", "gayri_resmi"].reduce((summary, account) => {
        const accountPlans = customerPlans.filter((plan) => accountType(plan.account_type) === account);
        const accountPayments = pays.filter((payment) =>
          payment.customer_id === c.id
          && accountType(payment.account_type) === account
        );
        const allocated = allocateCollectionsToPlans(accountPlans, accountPayments);
        const accountSummary = summarizePaymentPlansWithCanonicalState(accountPlans, accountPayments, allocated);
        return {
          planned: summary.planned + accountSummary.planned,
          paid: summary.paid + accountSummary.paid,
          remaining: summary.remaining + accountSummary.remaining,
        };
      }, { planned: 0, paid: 0, remaining: 0 });
      const totalDue = ledgerSummary.hasEntries ? ledgerSummary.planned : customerSummary.planned;
      const totalPaid = ledgerSummary.hasEntries ? ledgerSummary.paid : customerSummary.paid;
      const balance = ledgerSummary.hasEntries ? ledgerSummary.remaining : customerSummary.remaining;
      const projectIds = links.filter((x) => x.customer_id === c.id).map((x) => x.project_id);
      const projectNames = projects.filter((p) => projectIds.includes(p.id)).map((p) => p.title);
      return { ...c, totalDue, totalPaid, balance, projectIds, projectNames };
    });
  }, [customers, plans, pays, financialEntries, links, projects]);

  const filtered = enriched.filter((c) => {
    const name = customerDisplayName(c).toLowerCase();
    if (q && !`${name} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (type !== "all" && c.customer_type !== type) return false;
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

  function remove(id: string, name: string) {
    confirmDelete({
      title: "Müşteri kaydını sil",
      description: `"${name}" müşteri kaydı silinecek. Bağlı ödeme planları, tahsilat kayıtları ve proje ilişkileri de birlikte silinir. Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        try {
          await deleteAdminCustomer(id);
          toast({ title: "Müşteri silindi" });
          await load();
        } catch (error) {
          toast({ title: "Müşteri silinemedi", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
        }
      },
    });
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5 p-4 bg-card border border-border rounded-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Ara..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tüm Türler</SelectItem>{CUSTOMER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
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
        <>
        <div className="space-y-3 md:hidden">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{customerDisplayName(c)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{displayLabel(c.customer_type)} · {c.phone || "Telefon yok"}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><div className="text-xs text-muted-foreground">Tahsil Edilen</div><div className="font-semibold text-emerald-700">{formatTRY(c.totalPaid)}</div></div>
                <div><div className="text-xs text-muted-foreground">Kalan Bakiye</div><div className={cn("font-semibold", c.balance > 0 ? "text-red-600" : "text-emerald-700")}>{formatTRY(c.balance)}</div></div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{c.projectNames.join(", ") || "Bağlı proje yok"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link to={`/admin/musteriler/${c.id}`}><Eye className="h-4 w-4" /> Görüntüle</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to={`/admin/musteriler/${c.id}/duzenle`}><Edit className="h-4 w-4" /> Düzenle</Link></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(c.id, customerDisplayName(c))}><Trash2 className="h-4 w-4 text-destructive" /> Sil</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto bg-card border border-border rounded-md md:block">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Müşteri</th>
                <th className="p-3">Telefon</th>
                <th className="p-3">Projeler</th>
                <th className="p-3 text-right">Planlanan Alacak</th>
                <th className="p-3 text-right">Tahsil Edilen</th>
                <th className="p-3 text-right">Kalan Bakiye</th>
                <th className="p-3 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="cursor-pointer border-t border-border transition-colors duration-150 hover:bg-emerald-100/70"
                  onClick={() => navigate(`/admin/musteriler/${c.id}`)}
                >
                  <td className="p-3">
                    <div className="font-semibold">{customerDisplayName(c)}</div>
                    <div className="text-xs text-muted-foreground">{displayLabel(c.customer_type)}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" /> {c.phone ? formatTurkishPhone(c.phone) : "-"}</div>
                    {c.whatsapp && <a href={whatsappLink(c.whatsapp, "Merhaba, Akınal İnşaat")} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-emerald-700" onClick={(event) => event.stopPropagation()}><MessageCircle className="h-3 w-3" /> {formatTurkishPhone(c.whatsapp)}</a>}
                  </td>
                  <td className="p-3 text-xs">{c.projectNames.join(", ") || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3 text-right font-medium">{formatTRY(c.totalDue)}</td>
                  <td className="p-3 text-right text-emerald-700">{formatTRY(c.totalPaid)}</td>
                  <td className={cn("p-3 text-right font-bold", c.balance > 0 ? "text-red-600" : "text-emerald-700")}>{formatTRY(c.balance)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                      <Button asChild size="sm" variant="ghost" title="Görüntüle"><Link to={`/admin/musteriler/${c.id}`}><Eye className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Görüntüle</span></Link></Button>
                      <Button asChild size="sm" variant="ghost" title="Düzenle"><Link to={`/admin/musteriler/${c.id}/duzenle`}><Edit className="h-4 w-4" /><span className="sr-only xl:not-sr-only xl:ml-1">Düzenle</span></Link></Button>
                      <Button size="sm" variant="ghost" title="Sil" onClick={() => remove(c.id, customerDisplayName(c))}><Trash2 className="h-4 w-4 text-destructive" /><span className="sr-only xl:not-sr-only xl:ml-1">Sil</span></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {confirmDeleteDialog}
    </div>
  );
}
