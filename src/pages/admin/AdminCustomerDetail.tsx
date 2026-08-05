import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CardStatementTable } from "@/components/admin/finance/CardStatementTable";
import type { CardEntryFormValues } from "@/components/admin/finance/CardEntryForm";
import {
  getCustomerFinancialEntries,
  createCustomerFinancialEntry,
  updateCustomerFinancialEntry,
  deleteCustomerFinancialEntry,
  getAdminProjects,
  getGovernmentProgressPayments,
  createGovernmentProgressPayment,
  updateGovernmentProgressPayment,
  deleteGovernmentProgressPayment,
} from "@/lib/apiClient";
import type { GovernmentProgressPayment, GovernmentPaymentStage, GovernmentProgressPaymentPayload } from "@/lib/apiTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Edit, Mail, MapPin, MessageCircle, Phone, Plus, Trash2 } from "lucide-react";
import { accountType, allocateCollectionsToPlans, customerDisplayName, derivePlanStatus, displayLabel, formatTRY, daysUntil, safeNumber, summarizeCustomerLedgerEntries, whatsappLink } from "@/lib/finance";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { getAdminCustomerDetail } from "@/lib/apiClient";
import { formatTurkishPhone } from "@/lib/customerMasterData";

// ── Government Progress Payment helpers ───────────────────────────────────────

const GPP_STAGES: GovernmentPaymentStage[] = ["Su Basmanı", "Kaba İnşaat", "İnce İnşaat", "İskan", "Belirtilmemiş"];
const GPP_STAGE_LABELS: Record<string, string> = {
  "Su Basmanı": "Su Basmanı (%30)",
  "Kaba İnşaat": "Kaba İnşaat (%30)",
  "İnce İnşaat": "İnce İnşaat (%30)",
  "İskan": "İskan (%10)",
  "Belirtilmemiş": "Belirtilmemiş",
};
const GPP_STATUS_LABELS: Record<string, string> = {
  planned: "Planlandı",
  partial: "Kısmi Ödendi",
  paid: "Ödendi",
  cancelled: "İptal",
};
const GPP_STATUS_COLOR: Record<string, string> = {
  planned: "text-amber-600 bg-amber-50 border-amber-200",
  partial: "text-blue-600 bg-blue-50 border-blue-200",
  paid: "text-emerald-700 bg-emerald-50 border-emerald-200",
  cancelled: "text-gray-500 bg-gray-50 border-gray-200",
};

// Stage, paid amount, and payment date are never accepted from the client on
// card create/update (see government-progress-payments.php: gpp_payload()
// hardcodes stage to "Belirtilmemiş" and paid_amount_try/paid_date are always
// derived from ak_government_progress_payment_breakdowns/collections). This
// dialog therefore only edits the plan-level fields that actually persist;
// real stage tracking and collections are managed on the global Hakedişler
// page's stage-collection flow (P0-4).
export type GppFormState = {
  title: string;
  planned_amount_try: string;
  due_date: string;
  notes: string;
  project_id: string;
};

const GppFormEmpty = (projectId = ""): GppFormState => ({
  title: "",
  planned_amount_try: "",
  due_date: "",
  notes: "",
  project_id: projectId,
});

function GppDialog({
  open,
  onClose,
  onSave,
  initial,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: GppFormState) => Promise<void>;
  initial: GppFormState;
  projects: { id: string; title: string }[];
}) {
  const [form, setForm] = useState<GppFormState>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setForm(initial); }, [open, initial]);
  const set = (k: keyof GppFormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Hakediş Kaydı</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label>Başlık *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Proje</Label>
              <Select value={form.project_id} onValueChange={(v) => set("project_id", v)}>
                <SelectTrigger><SelectValue placeholder="Proje (opsiyonel)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Vade Tarihi</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Planlanan Tutar (TL) *</Label>
            <Input type="number" min="0" step="0.01" value={form.planned_amount_try} onChange={(e) => set("planned_amount_try", e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Notlar</Label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Aşama seçimi ve tahsilat kaydı, doğrulanmış ödeme tarihi ve tutar için "Hakedişler" ana sayfasındaki tahsilat akışından yapılır.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>İptal</Button>
            <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GppFormToPayload(form: GppFormState, customerId: string): GovernmentProgressPaymentPayload {
  return {
    customer_id: customerId,
    project_id: form.project_id && form.project_id !== "__none" ? form.project_id : null,
    title: form.title,
    planned_amount_try: parseFloat(form.planned_amount_try) || 0,
    due_date: form.due_date || null,
    notes: form.notes || null,
  };
}

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

const ALL_TABS = [...ACCOUNT_TABS, { value: "hakedisler", label: "Hakedişler" }] as const;

function percentLabel(value: number, total: number): string {
  if (total <= 0) return "%0";
  return `%${((value / total) * 100).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
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
  const [financialEntries, setFinancialEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const { data: customerEntries = [] } = useQuery({
    queryKey: ["customer-financial-entries", id],
    queryFn: () => getCustomerFinancialEntries({ customer_id: id }),
    enabled: !!id,
  });
  const { data: allProjectsForEntries = [] } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: getAdminProjects,
  });
  const { data: govtPayments = [], refetch: refetchGovt } = useQuery({
    queryKey: ["government-progress-payments", id],
    queryFn: () => getGovernmentProgressPayments({ customer_id: id }),
    enabled: !!id,
  });

  const [gppDialogOpen, setGppDialogOpen] = useState(false);
  const [gppEditing, setGppEditing] = useState<GovernmentProgressPayment | null>(null);
  const gppInitial = useMemo(
    () => gppEditing
      ? {
          title: gppEditing.title,
          planned_amount_try: String(gppEditing.planned_amount_try),
          due_date: gppEditing.due_date || "",
          notes: gppEditing.notes || "",
          project_id: gppEditing.project_id || "",
        }
      : GppFormEmpty(projects[0]?.id || ""),
    [gppEditing, projects]
  );

  async function handleGppSave(form: GppFormState) {
    const payload = GppFormToPayload(form, id!);
    if (gppEditing) {
      await updateGovernmentProgressPayment({ id: gppEditing.id, ...payload });
      toast({ title: "Hakediş güncellendi." });
    } else {
      await createGovernmentProgressPayment(payload);
      toast({ title: "Hakediş eklendi." });
    }
    await refetchGovt();
  }

  async function handleGppDelete(gpp: GovernmentProgressPayment) {
    if (!confirm(`"${gpp.title}" hakediş kaydını silmek istiyor musunuz?`)) return;
    await deleteGovernmentProgressPayment(gpp.id);
    toast({ title: "Hakediş silindi." });
    await refetchGovt();
  }

  const gppSummary = useMemo(() => {
    const planned = (govtPayments as GovernmentProgressPayment[]).reduce((s, g) => s + (Number(g.planned_amount_try) || 0), 0);
    const paid    = (govtPayments as GovernmentProgressPayment[]).reduce((s, g) => s + (Number(g.paid_amount_try) || 0), 0);
    return { planned, paid, remaining: Math.max(0, planned - paid) };
  }, [govtPayments]);

  async function handleEntryAdd(values: CardEntryFormValues) {
    await createCustomerFinancialEntry({
      customer_id: id!,
      project_id: values.project_id,
      entry_date: values.entry_date,
      title: values.title,
      notes: values.notes || null,
      amount: values.amount,
      paid_amount: values.paid_amount,
      currency: values.currency,
      exchange_rate_to_try: values.exchange_rate_to_try,
      is_exchange_rate_manual: values.is_exchange_rate_manual,
      account_type: values.account_type,
      payment_method: values.payment_method,
      inflation_enabled: values.inflation_enabled ? 1 : 0,
      inflation_start_date: values.inflation_start_date || null,
    });
    await qc.invalidateQueries({ queryKey: ["customer-financial-entries", id] });
    toast({ title: "Kayıt eklendi." });
  }
  async function handleEntryEdit(entryId: string, values: CardEntryFormValues) {
    await updateCustomerFinancialEntry({
      id: entryId,
      customer_id: id!,
      project_id: values.project_id,
      entry_date: values.entry_date,
      title: values.title,
      notes: values.notes || null,
      amount: values.amount,
      paid_amount: values.paid_amount,
      currency: values.currency,
      exchange_rate_to_try: values.exchange_rate_to_try,
      is_exchange_rate_manual: values.is_exchange_rate_manual,
      account_type: values.account_type,
      payment_method: values.payment_method,
      inflation_enabled: values.inflation_enabled ? 1 : 0,
      inflation_start_date: values.inflation_start_date || null,
    });
    await qc.invalidateQueries({ queryKey: ["customer-financial-entries", id] });
    toast({ title: "Kayıt güncellendi." });
  }
  async function handleEntryDelete(entryId: string) {
    await deleteCustomerFinancialEntry(entryId);
    await qc.invalidateQueries({ queryKey: ["customer-financial-entries", id] });
    toast({ title: "Kayıt silindi." });
  }
  async function handleInflationSave(entryId: string, enabled: boolean, startDate: string | null) {
    const entry = (customerEntries as any[]).find((e: any) => e.id === entryId);
    if (!entry) return;
    await updateCustomerFinancialEntry({
      id: entryId,
      customer_id: id!,
      project_id: entry.project_id,
      entry_date: entry.entry_date,
      title: entry.title,
      notes: entry.notes ?? null,
      amount: entry.amount,
      paid_amount: entry.paid_amount,
      currency: entry.currency,
      exchange_rate_to_try: entry.exchange_rate_to_try,
      is_exchange_rate_manual: entry.is_exchange_rate_manual,
      account_type: entry.account_type,
      payment_method: entry.payment_method,
      inflation_enabled: enabled ? 1 : 0,
      inflation_start_date: startDate,
    });
    await qc.invalidateQueries({ queryKey: ["customer-financial-entries", id] });
    toast({ title: enabled ? "Vade farkı etkinleştirildi." : "Vade farkı devre dışı bırakıldı." });
  }


  async function load() {
    if (!id) return;
    setLoadError("");
    try {
      const data = await getAdminCustomerDetail(id);
      if (!data.customer) {
        setCustomer(null);
        setLoadError("Müşteri kaydı bulunamadı.");
        return;
      }
      setCustomer(data.customer);
      setAllProjects(data.projects || []);
      const linkedIds = (data.links || []).map((l) => l.project_id);
      setProjects((data.projects || []).filter((p) => linkedIds.includes(p.id)));
      setPlans(data.payment_plans || []);
      setPays(data.payments || []);
      setFinancialEntries(data.financial_entries || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lütfen tekrar deneyin.";
      setLoadError(message);
      toast({ title: "Müşteri bilgileri alınamadı", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [id]);

  const effectivePlans = useMemo(() => {
    if ((customerEntries as any[]).length === 0) return plans;
    return (customerEntries as any[]).map((e) => {
      const status =
        e.status === "Gerçekleşti" || e.status === "Fazla Ödendi" ? "Ödendi"
        : e.status === "Kısmi Ödendi" ? "Kısmi Ödendi"
        : "Bekliyor";
      return {
        id: e.id,
        account_type: e.account_type,
        due_date: e.entry_date,
        title: e.title,
        description: e.notes || "",
        payment_method: e.payment_method || "-",
        amount: Number(e.amount_try ?? 0),
        paid_amount: Number(e.paid_amount_try ?? 0),
        status,
      };
    });
  }, [customerEntries, plans]);

  const accountSummaries = useMemo(() => {
    const usingNewEntries = (customerEntries as any[]).length > 0;
    const sourcePlans = usingNewEntries ? effectivePlans : plans;
    const sourcePays  = usingNewEntries ? [] : pays;
    return ACCOUNT_TABS.reduce((result, account) => {
      const accountPlans = sourcePlans.filter((plan: any) => accountType(plan.account_type) === account.value);
      const accountPays = sourcePays.filter((payment: any) => accountType(payment.account_type) === account.value);
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
        .filter((plan) => safeNumber(plan.paid) <= 0 && daysUntil(plan.due_date) < 0 && plan.computed !== "İptal")
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
      const ledgerSummary = summarizeCustomerLedgerEntries(financialEntries, {
        group: account.value === "resmi" ? "Resmi" : "Gayri Resmi",
        today,
      });
      result[account.value] = {
        totalDue: ledgerSummary.hasEntries ? ledgerSummary.planned : totalDue,
        totalPaid: ledgerSummary.hasEntries ? ledgerSummary.paid : totalPaid,
        totalAmount: ledgerSummary.hasEntries ? ledgerSummary.totalAmount : totalAmount,
        balance: ledgerSummary.hasEntries ? ledgerSummary.remaining : balance,
        overdue: ledgerSummary.hasEntries ? ledgerSummary.overdue : overdue,
        upcoming: ledgerSummary.hasEntries ? ledgerSummary.upcoming : upcoming,
        plans: enrichedPlans,
        accountSummaryPlans,
        futurePlans,
        chartFuturePlans: futureUnpaidPlans,
        pays: accountPays,
      };
      return result;
    }, {} as Record<string, any>);
  }, [effectivePlans, customerEntries, plans, pays, financialEntries, today]);

  const accountPaymentCharts = useMemo(() => {
    const buildChart = (summary: any, accountLabel: string, colors: { paid: string; remaining: string }) => {
      const accountSummaryRows = summary?.accountSummaryPlans || [];
      const futureRows = summary?.chartFuturePlans || [];
      const paid = accountSummaryRows.reduce((sum: number, plan: any) => {
        const paidAmount = plan.computed === "Ödendi" ? safeNumber(plan.amount) : Math.min(safeNumber(plan.amount), safeNumber(plan.paid));
        return sum + Math.max(0, paidAmount);
      }, 0);
      const overdue = accountSummaryRows
        .filter((plan: any) => safeNumber(plan.paid) <= 0 && String(plan.due_date || "") < today && plan.computed !== "İptal")
        .reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
      const currentDue = accountSummaryRows
        .filter((plan: any) => safeNumber(plan.paid) <= 0 && String(plan.due_date || "") === today && plan.computed !== "İptal")
        .reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
      const paidRemaining = accountSummaryRows
        .filter((plan: any) => safeNumber(plan.paid) > 0 && plan.computed !== "Ödendi" && plan.computed !== "İptal")
        .reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0);
      const futureRemaining = futureRows.reduce((sum: number, plan: any) => sum + Math.max(0, safeNumber(plan.remain)), 0) + paidRemaining;
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

  const combinedAccountSummary = useMemo(() => {
    const summaries = ACCOUNT_TABS.map((account) => accountSummaries[account.value] || {});
    const totalDue = summaries.reduce((sum, summary) => sum + safeNumber(summary.totalDue), 0);
    const totalPaid = summaries.reduce((sum, summary) => sum + safeNumber(summary.totalPaid), 0);
    const totalAmount = summaries.reduce((sum, summary) => sum + safeNumber(summary.totalAmount), 0);
    const balance = summaries.reduce((sum, summary) => sum + safeNumber(summary.balance), 0);
    const overdue = summaries.reduce((sum, summary) => sum + safeNumber(summary.overdue), 0);
    const upcoming = summaries.reduce((sum, summary) => sum + safeNumber(summary.upcoming), 0);
    const remainingReceivable = Math.max(0, totalDue - totalPaid);

    // Recompute chart segments from raw entries so paid rows are never counted as overdue.
    // A row is overdue only if it has remaining > 0 AND due_date is strictly before today.
    const entries = customerEntries as any[];
    let chartCollected = 0;
    let chartOverdue = 0;
    let chartNotYetDue = 0;
    if (entries.length > 0) {
      for (const e of entries) {
        const planned = safeNumber(e.amount_try);
        const paid = safeNumber(e.paid_amount_try);
        const remaining = Math.max(0, planned - paid);
        const due = String(e.entry_date || "");
        chartCollected += paid;
        if (remaining > 0 && due < today) {
          chartOverdue += remaining;
        } else if (remaining > 0) {
          chartNotYetDue += remaining;
        }
      }
    } else {
      chartCollected = totalPaid;
      const overdueSegment = Math.min(overdue, remainingReceivable);
      chartOverdue = overdueSegment;
      chartNotYetDue = Math.max(0, remainingReceivable - overdueSegment);
    }

    return {
      totalDue,
      totalPaid,
      totalAmount,
      balance,
      overdue,
      upcoming,
      remainingReceivable,
      chart: [{ name: "Genel", paid: chartCollected, overdue: chartOverdue, remaining: chartNotYetDue }],
    };
  }, [accountSummaries, customerEntries, today]);


  if (loading) return <div className="rounded-md border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-card-soft">Müşteri bilgileri hazırlanıyor...</div>;
  if (loadError || !customer) return <div className="rounded-md border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-card-soft">{loadError || "Müşteri kaydı bulunamadı."}</div>;

  const name = customerDisplayName(customer);

  return (
    <div>
      <AdminPageHeader
        eyebrow="Cari ve Tahsilat"
        title={name}
        description={`${displayLabel(customer.customer_type)} · müşteri bakiyesi, tahsilat planı, notlar ve belgeler.`}
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
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {customer.phone ? formatTurkishPhone(customer.phone) : "-"}</div>
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

      <section className="mb-6 rounded-md border border-border bg-card p-5 shadow-card-soft">
        <div className="mb-4 flex flex-col gap-1">
          <h3 className="font-semibold">Genel Hesap Özeti</h3>
          <p className="text-sm text-muted-foreground">Resmi ve gayri resmi hesapların toplam müşteri alacak görünümü.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Toplam Alacak" value={formatTRY(combinedAccountSummary.totalDue)} />
          <Stat label="Tahsil Edilen" value={formatTRY(combinedAccountSummary.totalPaid)} color="text-emerald-700" />
          <Stat label="Müşteri Bakiyesi" value={`${formatTRY(combinedAccountSummary.totalPaid)} / ${formatTRY(combinedAccountSummary.totalAmount)}`} color={combinedAccountSummary.balance > 0 ? "text-red-600" : "text-emerald-700"} />
          <Stat label="Vadesi Geçen Tutar" value={formatTRY(combinedAccountSummary.overdue)} color="text-red-600" />
          <Stat label="Yaklaşan Ödeme" value={formatTRY(combinedAccountSummary.upcoming)} color="text-amber-600" />
        </div>
        <div className="mt-5 rounded-md border border-border bg-muted/20 p-4">
          <div className="mb-3 text-sm font-semibold">Toplam Tahsilat ve Alacak Dağılımı</div>
          {(combinedAccountSummary.totalPaid + combinedAccountSummary.balance) > 0 ? (
            <ResponsiveContainer width="100%" height={92}>
              <BarChart data={combinedAccountSummary.chart} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <XAxis type="number" hide domain={[0, "dataMax"]} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip formatter={(value: any, name: any) => [formatTRY(value as number), name === "paid" ? "Tahsil Edilen" : name === "overdue" ? "Vadesi Geçen" : "Ödemesi Gelmemiş"]} />
                <Bar dataKey="paid" stackId="summary" fill="#15803d" radius={[6, 0, 0, 6]} />
                <Bar dataKey="overdue" stackId="summary" fill="#dc2626" />
                <Bar dataKey="remaining" stackId="summary" fill="#2563eb" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Bu müşteri için hesap özeti verisi bulunmuyor.</div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-700" /> Tahsil Edilen</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-600" /> Vadesi Geçen</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-600" /> Ödemesi Gelmemiş</span>
          </div>
        </div>
      </section>

      <Tabs defaultValue="resmi">
        <TabsList className="flex flex-wrap">
          {ALL_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm"
            >
              {tab.label}
              {tab.value === "hakedisler" && (govtPayments as GovernmentProgressPayment[]).length > 0 && (
                <span className="ml-1.5 rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold">
                  {(govtPayments as GovernmentProgressPayment[]).length}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {ACCOUNT_TABS.map((account) => {
          const summary = accountSummaries[account.value] || { totalDue: 0, totalPaid: 0, totalAmount: 0, balance: 0, overdue: 0, upcoming: 0, plans: [], accountSummaryPlans: [], futurePlans: [], chartFuturePlans: [], pays: [] };
          const accountPaymentChart = accountPaymentCharts[account.value] || [];
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
                <div className="lg:col-span-2">
                  <CardStatementTable
                    entries={(customerEntries as any[]).filter((e: any) => e.account_type === account.value)}
                    projects={allProjectsForEntries}
                    direction="income"
                    onAdd={handleEntryAdd}
                    onEdit={handleEntryEdit}
                    onDelete={handleEntryDelete}
                    onInflationSave={handleInflationSave}
                    title="Tahsilat Hareketleri"
                    showInflation
                    defaultAccountType={account.value}
                  />
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
                </div>
              </div>
            </TabsContent>
          );
        })}

        {/* ── Hakedişler tab ──────────────────────────────────────────── */}
        <TabsContent value="hakedisler" className="mt-4 space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Toplam Hakediş" value={formatTRY(gppSummary.planned)} />
            <Stat label="Ödenen" value={formatTRY(gppSummary.paid)} color="text-emerald-700" />
            <Stat label="Kalan" value={formatTRY(gppSummary.remaining)} color={gppSummary.remaining > 0 ? "text-amber-600" : "text-emerald-700"} />
          </div>

          <div className="rounded-md border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Devlet Hakediş Ödemeleri</h3>
              <Button
                size="sm"
                onClick={() => { setGppEditing(null); setGppDialogOpen(true); }}
              >
                <Plus className="h-4 w-4 mr-1" /> Hakediş Ekle
              </Button>
            </div>

            {(govtPayments as GovernmentProgressPayment[]).length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Bu müşteri için hakediş kaydı bulunmuyor.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[800px] w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="p-3">Başlık / Aşama</th>
                      <th className="p-3">Oran</th>
                      <th className="p-3">Vade</th>
                      <th className="p-3 text-right">Planlanan</th>
                      <th className="p-3 text-right">Ödenen</th>
                      <th className="p-3 text-right">Kalan</th>
                      <th className="p-3">Durum</th>
                      <th className="p-3">Proje</th>
                      <th className="p-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(govtPayments as GovernmentProgressPayment[]).map((gpp) => {
                      const planned = Number(gpp.planned_amount_try) || 0;
                      const paid = Number(gpp.paid_amount_try) || 0;
                      const remaining = Math.max(0, planned - paid);
                      const statusLabel = GPP_STATUS_LABELS[gpp.status] ?? gpp.status;
                      const statusColor = GPP_STATUS_COLOR[gpp.status] ?? "";
                      return (
                        <tr key={gpp.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <div className="font-medium">{gpp.title}</div>
                            {gpp.stage && <div className="text-xs text-muted-foreground">{GPP_STAGE_LABELS[gpp.stage] ?? gpp.stage}</div>}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {Number(gpp.stage_percentage) > 0 ? `%${Number(gpp.stage_percentage)}` : "—"}
                          </td>
                          <td className="p-3 text-muted-foreground">{gpp.due_date || "—"}</td>
                          <td className="p-3 text-right font-medium">{formatTRY(planned)}</td>
                          <td className="p-3 text-right text-emerald-700">{formatTRY(paid)}</td>
                          <td className={cn("p-3 text-right font-bold", remaining > 0 ? "text-amber-600" : "text-emerald-700")}>{formatTRY(remaining)}</td>
                          <td className="p-3">
                            <span className={cn("inline-block rounded border px-2 py-0.5 text-xs font-medium", statusColor)}>{statusLabel}</span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">{gpp.project_title || "—"}</td>
                          <td className="p-3">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" title="Düzenle" onClick={() => { setGppEditing(gpp); setGppDialogOpen(true); }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" title="Sil" onClick={() => handleGppDelete(gpp)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <GppDialog
        open={gppDialogOpen}
        onClose={() => { setGppDialogOpen(false); setGppEditing(null); }}
        onSave={handleGppSave}
        initial={gppInitial}
        projects={allProjectsForEntries}
      />
    </div>
  );
}
