import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Edit, Mail, MapPin, MessageCircle, Phone, Plus, Trash2 } from "lucide-react";
import { accountType, allocateCollectionsToPlans, customerDisplayName, derivePlanStatus, displayLabel, formatTRY, formatDate, statusBadgeClass, daysUntil, safeNumber, whatsappLink } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { createAdminCustomerNote, createAdminPaymentPlan, deleteAdminCustomerNote, deleteAdminPaymentPlan, getAdminCustomerDetail, updateAdminPaymentPlan } from "@/lib/apiClient";

function Stat({ label, value, color }: any) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-card-soft">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 break-words text-2xl font-extrabold leading-tight tabular-nums", color || "text-foreground")}>{value}</div>
    </div>
  );
}

const ACCOUNT_TABS = [
  { value: "resmi", label: "Resmi Hesap" },
  { value: "gayri_resmi", label: "Gayri Resmi Hesap" },
] as const;
const PAYMENT_METHODS = ["Nakit", "Banka Havalesi / EFT", "Kredi Kartı", "Çek", "Senet"] as const;
const defaultPaymentMeta = { payment_method: "Nakit", transaction_reference: "", card_note: "", cheque_maturity_date: "", cheque_no: "", bank_name: "", promissory_maturity_date: "" };

function percentLabel(value: number, total: number): string {
  if (total <= 0) return "%0";
  return `%${((value / total) * 100).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function maturityBadge(plan: any): string | null {
  if (plan.payment_method === "Çek" && plan.cheque_maturity_date) {
    return plan.cheque_maturity_date > new Date().toISOString().slice(0, 10) ? `Çek Beklemede · ${formatDate(plan.cheque_maturity_date)}` : `Çek · ${formatDate(plan.cheque_maturity_date)}`;
  }
  if (plan.payment_method === "Senet" && plan.promissory_maturity_date) {
    return plan.promissory_maturity_date > new Date().toISOString().slice(0, 10) ? `Senet Beklemede · ${formatDate(plan.promissory_maturity_date)}` : `Senet · ${formatDate(plan.promissory_maturity_date)}`;
  }
  return null;
}

function renderChartCallout(props: any) {
  const { cx, cy, midAngle, outerRadius, value, payload } = props;
  if (!value) return null;

  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const startX = cx + outerRadius * cos;
  const startY = cy + outerRadius * sin;
  const midX = cx + (outerRadius + 16) * cos;
  const midY = cy + (outerRadius + 16) * sin;
  const endX = midX + (cos >= 0 ? 26 : -26);
  const endY = midY;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <path d={`M${startX},${startY}L${midX},${midY}L${endX},${endY}`} fill="none" stroke={payload.color} strokeWidth={1.4} />
      <circle cx={startX} cy={startY} r={2.5} fill={payload.color} />
      <text x={endX + (cos >= 0 ? 5 : -5)} y={endY - 4} textAnchor={textAnchor} className="fill-foreground text-[10px] font-semibold">
        {formatTRY(value)}
      </text>
      <text x={endX + (cos >= 0 ? 5 : -5)} y={endY + 10} textAnchor={textAnchor} className="fill-muted-foreground text-[10px]">
        {payload.name} · {payload.percentLabel}
      </text>
    </g>
  );
}

export default function AdminCustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<any>({ account_type: "resmi", project_id: "", title: "", description: "", amount: "", paid_amount: "", due_date: "", status: "Bekliyor", notes: "", ...defaultPaymentMeta });
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const refreshCustomerDetail = async () => {
    await load();
  };
  const clearAccountLocalFinance = (account: "resmi" | "gayri_resmi") => {
    setPlans((current) => current.filter((plan) => accountType(plan.account_type) !== account));
    setPays((current) => current.filter((payment) => accountType(payment.account_type) !== account));
  };

  async function load() {
    if (!id) return;
    try {
      const data = await getAdminCustomerDetail(id);
      setCustomer(data.customer);
      setAllProjects(data.projects || []);
      const linkedIds = (data.links || []).map((l) => l.project_id);
      setProjects((data.projects || []).filter((p) => linkedIds.includes(p.id)));
      setPlans(data.payment_plans || []);
      setPays(data.payments || []);
      setNotes(data.notes || []);
      setDocs(data.documents || []);
    } catch (error) {
      toast({ title: "Müşteri bilgileri alınamadı", description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.", variant: "destructive" });
    }
  }
  useEffect(() => { load(); }, [id]);

  const accountSummaries = useMemo(() => {
    return ACCOUNT_TABS.reduce((result, account) => {
      const accountPlans = plans.filter((plan) => accountType(plan.account_type) === account.value);
      const accountPlanIds = new Set(accountPlans.map((plan) => String(plan.id)));
      const accountPays = pays.filter((payment) => accountType(payment.account_type) === account.value && accountPlanIds.has(String(payment.payment_plan_id || "")));
      const allocatedPaid = allocateCollectionsToPlans(accountPlans, accountPays);
      const enrichedPlans = accountPlans.map((plan) => {
        const amount = safeNumber(plan.amount);
        const allocatedAmount = allocatedPaid.get(plan.id) || 0;
        const partialAmount = safeNumber(plan.paid_amount);
        const paid = plan.status === "Ödendi" ? amount : plan.status === "Kısmi Ödendi" ? Math.min(amount, partialAmount) : Math.min(amount, allocatedAmount);
        const remain = Math.max(0, amount - paid);
        const computed = derivePlanStatus(plan, paid);
        return { ...plan, paid, remain, computed };
      });
      const totalPaid = enrichedPlans.reduce((s, p) => s + safeNumber(p.paid), 0);
      const totalAmount = enrichedPlans.reduce((s, p) => s + safeNumber(p.amount), 0);
      const unpaidPlans = enrichedPlans.filter((plan) => plan.computed !== "Ödendi" && plan.computed !== "İptal" && plan.remain > 0);
      const futureUnpaidPlans = unpaidPlans.filter((plan) => String(plan.due_date || "") > today);
      const balance = unpaidPlans.reduce((s, p) => s + safeNumber(p.remain), 0);
      const totalDue = balance;
      const overdue = enrichedPlans
        .filter((plan) => daysUntil(plan.due_date) < 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal")
        .reduce((sum, plan) => sum + plan.remain, 0);
      const upcomingPlan = futureUnpaidPlans
        .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")))[0];
      const upcoming = upcomingPlan?.remain || 0;
      const accountSummaryPlans = enrichedPlans.filter((plan) => {
        const dueDate = String(plan.due_date || "");
        const paid = safeNumber(plan.paid);
        const isPaid = plan.computed === "Ödendi" || paid > 0;
        const isDueOrPast = dueDate !== "" && dueDate <= today;
        return isPaid || isDueOrPast;
      });
      const futurePlans = enrichedPlans.filter((plan) => {
        const dueDate = String(plan.due_date || "");
        const paid = safeNumber(plan.paid);
        return dueDate > today && paid <= 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal";
      });
      result[account.value] = { totalDue, totalPaid, totalAmount, balance, overdue, upcoming, plans: enrichedPlans, accountSummaryPlans, futurePlans, chartFuturePlans: futureUnpaidPlans, pays: accountPays };
      return result;
    }, {} as Record<string, any>);
  }, [plans, pays, today]);

  const accountPaymentCharts = useMemo(() => {
    const buildChart = (summary: any, accountLabel: string, colors: { paid: string; remaining: string }) => {
      const accountSummaryRows = summary?.accountSummaryPlans || [];
      const futureRows = summary?.chartFuturePlans || [];
      const paid = accountSummaryRows.reduce((sum: number, plan: any) => {
        const paidAmount = plan.computed === "Ödendi" ? safeNumber(plan.amount) : Math.min(safeNumber(plan.amount), safeNumber(plan.paid));
        return sum + Math.max(0, paidAmount);
      }, 0);
      const overdue = accountSummaryRows
        .filter((plan: any) => String(plan.due_date || "") < today && plan.computed !== "Ödendi" && plan.computed !== "İptal")
        .reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
      const currentDue = accountSummaryRows
        .filter((plan: any) => String(plan.due_date || "") === today && plan.computed !== "Ödendi" && plan.computed !== "İptal")
        .reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
      const futureRemaining = futureRows.reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
      const total = paid + futureRemaining + currentDue + overdue;
      return [
        { name: `${accountLabel} ödenen`, value: paid, color: colors.paid },
        { name: `${accountLabel} kalan`, value: futureRemaining, color: colors.remaining },
        { name: "Bugün vadesi gelen", value: currentDue, color: "#f59e0b" },
        { name: "Geciken ödeme", value: overdue, color: "#dc2626" },
      ]
        .filter((item) => item.value > 0)
        .map((item) => ({ ...item, percentLabel: percentLabel(item.value, total) }));
    };
    return {
      resmi: buildChart(accountSummaries.resmi, "Resmi", { paid: "#15803d", remaining: "#2563eb" }),
      gayri_resmi: buildChart(accountSummaries.gayri_resmi, "Gayri resmi", { paid: "#22c55e", remaining: "#60a5fa" }),
    };
  }, [accountSummaries, today]);

  async function addNote() {
    if (!id || !newNote.trim()) return;
    await createAdminCustomerNote(id, newNote.trim());
    setNewNote(""); toast({ title: "Not eklendi" }); load();
  }
  async function deleteNote(nid: string) {
    if (!confirm("Bu müşteri notunu silmek istediğinize emin misiniz?")) return;
    await deleteAdminCustomerNote(nid);
    load();
  }
  function openNewPayment(account: "resmi" | "gayri_resmi") {
    setEditingPlanId(null);
    setPlanForm({ account_type: account, project_id: "", title: "", description: "", amount: "", paid_amount: "", due_date: "", status: "Bekliyor", notes: "", ...defaultPaymentMeta });
    setPlanDialogOpen(true);
  }
  function openEditPayment(plan: any) {
    setEditingPlanId(plan.id);
    setPlanForm({
      account_type: accountType(plan.account_type),
      project_id: plan.project_id || "",
      title: plan.title || "",
      description: plan.description || "",
      amount: String(plan.amount || ""),
      paid_amount: String(plan.paid_amount || ""),
      due_date: plan.due_date || "",
      status: plan.status || "Bekliyor",
      notes: plan.notes || "",
      payment_method: plan.payment_method || "Nakit",
      transaction_reference: plan.transaction_reference || "",
      card_note: plan.card_note || "",
      cheque_maturity_date: plan.cheque_maturity_date || "",
      cheque_no: plan.cheque_no || "",
      bank_name: plan.bank_name || "",
      promissory_maturity_date: plan.promissory_maturity_date || "",
    });
    setPlanDialogOpen(true);
  }
  async function savePaymentPlan() {
    if (!id || !planForm.title || !planForm.amount || !planForm.due_date) {
      toast({ title: "Başlık, tutar ve vade tarihi zorunludur", variant: "destructive" });
      return;
    }
    const amount = Number(planForm.amount);
    const paidAmount = Number(planForm.paid_amount || 0);
    if (planForm.status === "Kısmi Ödendi" && (!(paidAmount > 0) || !(paidAmount < amount))) {
      toast({ title: "Ödenen Tutar, 0'dan büyük ve toplam tutardan küçük olmalıdır", variant: "destructive" });
      return;
    }
    if (planForm.payment_method === "Çek" && !planForm.cheque_maturity_date) {
      toast({ title: "Çek vade tarihi zorunludur", variant: "destructive" });
      return;
    }
    if (planForm.payment_method === "Senet" && !planForm.promissory_maturity_date) {
      toast({ title: "Senet vade tarihi zorunludur", variant: "destructive" });
      return;
    }
    const payload = {
      ...planForm,
      customer_id: id,
      project_id: planForm.project_id || null,
      amount,
      paid_amount: planForm.status === "Kısmi Ödendi" ? paidAmount : 0,
    };
    if (editingPlanId) {
      await updateAdminPaymentPlan({ ...payload, id: editingPlanId });
      toast({ title: "Ödeme güncellendi" });
    } else {
      await createAdminPaymentPlan(payload);
      toast({ title: "Ödeme eklendi" });
    }
    setPlanDialogOpen(false);
    clearAccountLocalFinance(accountType(planForm.account_type));
    await refreshCustomerDetail();
  }
  async function deletePaymentPlanFromModal() {
    if (!editingPlanId) return;
    if (!confirm("Bu ödeme kaydını silmek istediğinize emin misiniz?")) return;
    try {
      await deleteAdminPaymentPlan(editingPlanId);
      toast({ title: "Ödeme kaydı silindi" });
      setPlanDialogOpen(false);
      setEditingPlanId(null);
      clearAccountLocalFinance(accountType(planForm.account_type));
      await refreshCustomerDetail();
    } catch (error) {
      toast({
        title: "Ödeme kaydı silinemedi",
        description: error instanceof Error ? error.message : "Kayıt başka bir yerde kullanılıyor olabilir. Lütfen bağlantılı kayıtları kontrol edin.",
        variant: "destructive",
      });
    }
  }

  if (!customer) return <div className="rounded-md border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-card-soft">Müşteri bilgileri hazırlanıyor...</div>;

  const name = customerDisplayName(customer);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Cari ve Tahsilat"
        title={name}
        description={`${displayLabel(customer.customer_type)} · ${displayLabel(customer.status)} · müşteri bakiyesi, tahsilat planı, notlar ve belgeler.`}
        actions={
          <>
          <Button asChild variant="outline"><Link to="/admin/musteriler"><ArrowLeft className="h-4 w-4" /> Müşterilere Dön</Link></Button>
          {customer.whatsapp && <Button asChild variant="outline"><a href={whatsappLink(customer.whatsapp, `Merhaba ${name},`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</a></Button>}
          <Button asChild className="bg-accent hover:bg-accent-glow text-accent-foreground"><Link to={`/admin/musteriler/${id}/duzenle`}><Edit className="h-4 w-4 mr-1" /> Düzenle</Link></Button>
          </>
        }
      />

      <div className="mb-6">
        <div className="bg-card border border-border rounded-md p-5 space-y-3">
          <h3 className="font-semibold">İletişim Bilgileri</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {customer.phone || "-"}</div>
            <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-muted-foreground" /> {customer.whatsapp || "-"}</div>
            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {customer.email || "-"}</div>
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {[customer.address, customer.district, customer.city].filter(Boolean).join(", ") || "-"}</div>
            <div className="text-muted-foreground text-xs">T.C./Vergi No: {customer.tax_or_identity_number || "-"}</div>
          </div>
          <div>
            <h4 className="font-semibold mt-4 mb-2">İlgili Projeler</h4>
            {projects.length ? (
              <div className="flex flex-wrap gap-2">
                {projects.map((p) => <Link key={p.id} to={`/admin/projeler/${p.id}/finans`} className="text-xs px-2 py-1 rounded-md border border-border bg-muted/50 hover:bg-muted">{p.title}</Link>)}
              </div>
            ) : <div className="text-xs text-muted-foreground">Bu müşteriye bağlı proje bulunmuyor.</div>}
          </div>
          {customer.notes && <div><h4 className="font-semibold mt-4 mb-1">Genel Notlar</h4><p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes}</p></div>}
        </div>

      </div>

      <Tabs defaultValue="resmi">
        <TabsList className="flex flex-wrap">
          {ACCOUNT_TABS.map((account) => (
            <TabsTrigger
              key={account.value}
              value={account.value}
              className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm"
            >
              {account.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {ACCOUNT_TABS.map((account) => {
          const summary = accountSummaries[account.value] || { totalDue: 0, totalPaid: 0, totalAmount: 0, balance: 0, overdue: 0, upcoming: 0, plans: [], accountSummaryPlans: [], futurePlans: [], chartFuturePlans: [], pays: [] };
          const accountPaymentChart = accountPaymentCharts[account.value] || [];
          const renderPlanRows = (rows: any[], emptyMessage: string) => (
            <div className="bg-card border border-border rounded-md overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Başlık</th><th className="p-3 text-left">Vade</th><th className="p-3 text-left">Ödeme Yöntemi</th><th className="p-3 text-right">Tutar</th><th className="p-3 text-right">Ödenen</th><th className="p-3 text-right">Kalan</th><th className="p-3">Durum</th></tr></thead>
                <tbody>
                  {rows.map((p: any) => {
                    const isLate = String(p.due_date || "") < today && p.computed !== "Ödendi" && p.computed !== "İptal" && safeNumber(p.remain) > 0;
                    const label = isLate ? "Geciken Ödeme" : displayLabel(p.computed);
                    return (
                      <tr
                        key={p.id}
                        className="cursor-pointer border-t border-border transition-colors hover:bg-accent/5"
                        onClick={() => openEditPayment(p)}
                        title="Ödemeyi düzenle"
                      >
                        <td className="p-3"><div className="font-medium">{p.title}</div>{p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}</td>
                        <td className="p-3">{formatDate(p.due_date)}</td>
                        <td className="p-3">
                          <div className="font-medium">{p.payment_method || "Nakit"}</div>
                          {maturityBadge(p) && <div className="mt-1 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700" title={maturityBadge(p) || undefined}>{maturityBadge(p)}</div>}
                        </td>
                        <td className="p-3 text-right">{formatTRY(p.amount)}</td>
                        <td className="p-3 text-right text-emerald-700">{formatTRY(p.paid)}</td>
                        <td className="p-3 text-right font-bold">{formatTRY(p.remain)}</td>
                        <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass(isLate ? "Vadesi Geçti" : p.computed))}>{label}</span></td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{emptyMessage}</td></tr>}
                </tbody>
              </table>
            </div>
          );
          return (
            <TabsContent key={account.value} value={account.value} className="mt-4 space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <Stat label="Toplam Alacak" value={formatTRY(summary.totalDue)} />
                <Stat label="Tahsil Edilen" value={formatTRY(summary.totalPaid)} color="text-emerald-700" />
                <Stat label="Müşteri Bakiyesi" value={`${formatTRY(summary.totalPaid)} / ${formatTRY(summary.totalAmount)}`} color={summary.balance > 0 ? "text-red-600" : "text-emerald-700"} />
                <Stat label="Vadesi Geçen Tutar" value={formatTRY(summary.overdue)} color="text-red-600" />
                <Stat label="Yaklaşan Ödeme" value={formatTRY(summary.upcoming)} color="text-amber-600" />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <div className="flex justify-end mb-3">
                      <Button onClick={() => openNewPayment(account.value)} className="bg-accent hover:bg-accent-glow text-accent-foreground"><Plus className="h-4 w-4 mr-1" /> Ödeme Ekle</Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-3 font-semibold">Hesap Özeti</h3>
                    {renderPlanRows(summary.accountSummaryPlans, "Bu hesap türü için hesap özeti kaydı bulunmuyor.")}
                  </div>

                  <div>
                    <h3 className="mb-3 font-semibold">Gelecek Ödemeler</h3>
                    {renderPlanRows(summary.futurePlans, "Bu hesap türü için gelecek ödeme bulunmuyor.")}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-md p-5">
                    <h3 className="font-semibold mb-2">Genel Ödeme Durumu</h3>
                    {accountPaymentChart.length ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={accountPaymentChart}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={82}
                            paddingAngle={2}
                            label={renderChartCallout}
                            labelLine={false}
                          >
                            {accountPaymentChart.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip formatter={(v: any, name: any, item: any) => [`${formatTRY(v)} (${item.payload.percentLabel})`, name]} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <div className="text-sm text-muted-foreground py-12 text-center">Bu müşteri için ödeme verisi bulunmuyor.</div>}
                  </div>

                  <div className="bg-card border border-border rounded-md p-4">
                    <Textarea placeholder={`${account.label} notu...`} value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={3} />
                    <Button onClick={addNote} className="mt-2 bg-accent hover:bg-accent-glow text-accent-foreground"><Plus className="h-4 w-4 mr-1" /> Not Ekle</Button>
                  </div>
                  <div className="space-y-2">
                    {notes.map((n) => (
                      <div key={n.id} className="bg-card border border-border rounded-md p-3 flex justify-between gap-3">
                        <div><div className="text-sm whitespace-pre-wrap">{n.note}</div><div className="text-xs text-muted-foreground mt-1">{formatDate(n.created_at)}</div></div>
                        <Button size="sm" variant="ghost" onClick={() => deleteNote(n.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    ))}
                    {notes.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Henüz müşteri notu eklenmemiş.</div>}
                  </div>

                  <div className="bg-card border border-border rounded-md overflow-x-auto">
                    <table className="min-w-[420px] w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Belge</th><th className="p-3 text-right">İşlem</th></tr></thead>
                      <tbody>
                        {docs.map((d) => (
                          <tr key={d.id} className="border-t border-border">
                            <td className="p-3"><div>{d.title}</div><div className="text-xs text-muted-foreground">{d.document_type} · {formatDate(d.created_at)}</div></td>
                            <td className="p-3 text-right"><a href={d.file_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Görüntüle</a></td>
                          </tr>
                        ))}
                        {docs.length === 0 && <tr><td colSpan={2} className="p-6 text-center text-muted-foreground">Bu müşteri için belge kaydı bulunmuyor.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingPlanId ? "Ödemeyi Düzenle" : "Ödeme Ekle"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div><Label>Hesap Türü</Label>
              <Select value={planForm.account_type || "resmi"} onValueChange={(value) => setPlanForm((form: any) => ({ ...form, account_type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="resmi">Resmi Hesap</SelectItem><SelectItem value="gayri_resmi">Gayri Resmi Hesap</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Proje</Label>
              <Select value={planForm.project_id || "none"} onValueChange={(value) => setPlanForm((form: any) => ({ ...form, project_id: value === "none" ? "" : value }))}>
                <SelectTrigger><SelectValue placeholder="Proje seçin" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Seçilmedi</SelectItem>{allProjects.map((project) => <SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Başlık *</Label><Input value={planForm.title} onChange={(event) => setPlanForm((form: any) => ({ ...form, title: event.target.value }))} /></div>
            <div><Label>Tutar *</Label><Input type="number" step="0.01" value={planForm.amount} onChange={(event) => setPlanForm((form: any) => ({ ...form, amount: event.target.value }))} /></div>
            {planForm.status === "Kısmi Ödendi" && <div><Label>Ödenen Tutar *</Label><Input type="number" step="0.01" value={planForm.paid_amount} onChange={(event) => setPlanForm((form: any) => ({ ...form, paid_amount: event.target.value }))} /></div>}
            <div><Label>Vade Tarihi *</Label><Input type="date" value={planForm.due_date} onChange={(event) => setPlanForm((form: any) => ({ ...form, due_date: event.target.value }))} /></div>
            <div><Label>Durum</Label>
              <Select value={planForm.status || "Bekliyor"} onValueChange={(value) => setPlanForm((form: any) => ({ ...form, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Bekliyor", "Kısmi Ödendi", "Ödendi", "Vadesi Geçti"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ödeme Yöntemi *</Label>
              <Select value={planForm.payment_method || "Nakit"} onValueChange={(value) => setPlanForm((form: any) => ({ ...form, payment_method: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {planForm.payment_method === "Banka Havalesi / EFT" && <div><Label>İşlem Referansı</Label><Input value={planForm.transaction_reference} onChange={(event) => setPlanForm((form: any) => ({ ...form, transaction_reference: event.target.value }))} /></div>}
            {planForm.payment_method === "Kredi Kartı" && <div><Label>Kart Notu</Label><Input value={planForm.card_note} onChange={(event) => setPlanForm((form: any) => ({ ...form, card_note: event.target.value }))} /></div>}
            {planForm.payment_method === "Çek" && (
              <>
                <div><Label>Çek Vade Tarihi *</Label><Input type="date" value={planForm.cheque_maturity_date} onChange={(event) => setPlanForm((form: any) => ({ ...form, cheque_maturity_date: event.target.value }))} /></div>
                <div><Label>Çek No</Label><Input value={planForm.cheque_no} onChange={(event) => setPlanForm((form: any) => ({ ...form, cheque_no: event.target.value }))} /></div>
                <div><Label>Banka</Label><Input value={planForm.bank_name} onChange={(event) => setPlanForm((form: any) => ({ ...form, bank_name: event.target.value }))} /></div>
              </>
            )}
            {planForm.payment_method === "Senet" && <div><Label>Senet Vade Tarihi *</Label><Input type="date" value={planForm.promissory_maturity_date} onChange={(event) => setPlanForm((form: any) => ({ ...form, promissory_maturity_date: event.target.value }))} /></div>}
            <div className="md:col-span-2"><Label>Açıklama</Label><Textarea value={planForm.description} onChange={(event) => setPlanForm((form: any) => ({ ...form, description: event.target.value }))} rows={2} /></div>
            <div className="md:col-span-2"><Label>Not</Label><Textarea value={planForm.notes} onChange={(event) => setPlanForm((form: any) => ({ ...form, notes: event.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            {editingPlanId && <Button variant="destructive" onClick={deletePaymentPlanFromModal}>Sil</Button>}
            <div className="flex flex-1 justify-end gap-2">
              <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>İptal</Button>
              <Button onClick={savePaymentPlan} className="bg-accent hover:bg-accent-glow text-accent-foreground">Kaydet</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
