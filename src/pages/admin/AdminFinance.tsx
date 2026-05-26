import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, MessageCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import {
  FINANCE_COLORS,
  formatTRY,
  formatDate,
  customerDisplayName,
  daysUntil,
  exportCSV,
  whatsappLink,
  statusBadgeClass,
  derivePlanStatus,
  isCanceledStatus,
  isPaidStatus,
  paymentPlanRemainingFromPayments,
  paidForPlan,
  summarizeLedgerFinance,
} from "@/lib/finance";
import { cn } from "@/lib/utils";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/AdminPage";

function Stat({ label, value, color, sub }: any) {
  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-card-soft">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className={cn("mt-2 break-words text-2xl font-extrabold leading-tight tabular-nums", color || "text-foreground")}>{value}</div>
      {sub && <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PieCard({ title, data }: any) {
  const filtered = data.filter((d: any) => d.value > 0);
  return (
    <div className="bg-card border border-border rounded-md p-5">
      <h3 className="font-semibold mb-2">{title}</h3>
      {filtered.length ? (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={2}>
              {filtered.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v: any) => formatTRY(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : <div className="flex min-h-[260px] items-center justify-center rounded-md bg-surface-light px-6 text-center text-sm text-muted-foreground">Bu grafik için finans kaydı bulunmuyor. Finansal hareket eklendiğinde dağılım otomatik oluşacak.</div>}
    </div>
  );
}

export default function AdminFinance() {
  const [plans, setPlans] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [financialEntries, setFinancialEntries] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    const [pl, py, ex, fe, c, pr] = await Promise.all([
      (supabase.from("payment_plans" as any).select("*")) as any,
      (supabase.from("payments" as any).select("*")) as any,
      (supabase.from("expenses" as any).select("*")) as any,
      (supabase.from("financial_entries").select("*")) as any,
      (supabase.from("customers" as any).select("*")) as any,
      supabase.from("projects").select("id,title,slug").order("sort_order"),
    ]);
    const firstError = [pl.error, py.error, ex.error, fe.error, c.error, pr.error].find(Boolean);
    if (firstError) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setPlans((pl.data as any[]) || []); setPays((py.data as any[]) || []);
    setExps((ex.data as any[]) || []); setFinancialEntries((fe.data as any[]) || []);
    setCustomers((c.data as any[]) || []); setProjects((pr.data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    const overall = summarizeLedgerFinance({ financialEntries });
    const month = summarizeLedgerFinance({ financialEntries, from: monthStart, to: monthEnd });

    return {
      totalReceived: overall.totalIncome,
      totalReceivable: overall.receivable,
      totalExpense: overall.totalExpense,
      totalPayable: overall.payable,
      net: overall.netBalance,
      expectedThisMonth: month.receivable,
      receivedThisMonth: month.totalIncome,
      expenseThisMonth: month.totalExpense,
    };
  }, [financialEntries]);

  const overallPie = [
    { name: "Gerçekleşen Gelir", value: stats.totalReceived, color: FINANCE_COLORS.received },
    { name: "Planlanan Gelir", value: stats.totalReceivable, color: FINANCE_COLORS.receivable },
    { name: "Gerçekleşen Gider", value: stats.totalExpense, color: FINANCE_COLORS.expense },
    { name: "Planlanan Gider", value: stats.totalPayable, color: FINANCE_COLORS.pending },
  ];

  const statusPie = useMemo(() => {
    const counts = { "Ödendi": 0, "Bekliyor": 0, "Kısmi Ödendi": 0, "Gecikti": 0 } as Record<string, number>;
    plans.forEach((p) => {
      const paid = paidForPlan(p.id, pays);
      const computed = derivePlanStatus(p, paid);
      if (counts[computed] !== undefined) counts[computed] += paymentPlanRemainingFromPayments(p, pays) || Number(p.amount);
    });
    return [
      { name: "Ödendi", value: counts["Ödendi"], color: FINANCE_COLORS.paid },
      { name: "Bekliyor", value: counts["Bekliyor"], color: FINANCE_COLORS.pending },
      { name: "Kısmi Ödendi", value: counts["Kısmi Ödendi"], color: FINANCE_COLORS.partial },
      { name: "Gecikti", value: counts["Gecikti"], color: FINANCE_COLORS.overdue },
    ];
  }, [plans, pays]);

  const projectStats = useMemo(() => projects.map((pr) => {
    const projEntries = financialEntries.filter((entry) => entry.project_id === pr.id);
    const summary = summarizeLedgerFinance({ financialEntries: projEntries });
    const received = summary.totalIncome;
    const receivable = summary.receivable;
    const expense = summary.totalExpense;
    const payable = summary.payable;
    return { ...pr, received, receivable, expense, payable, net: summary.netBalance };
  }), [projects, financialEntries]);

  const upcoming = useMemo(() => {
    return plans.map((p) => {
      const paid = paidForPlan(p.id, pays);
      const remain = paymentPlanRemainingFromPayments(p, pays);
      const computed = derivePlanStatus(p, paid);
      const customer = customers.find((c) => c.id === p.customer_id);
      const project = projects.find((pr) => pr.id === p.project_id);
      const days = daysUntil(p.due_date);
      return { ...p, remain, computed, customer, project, days };
    }).filter((p) => p.computed !== "Ödendi" && p.computed !== "İptal" && p.remain > 0);
  }, [plans, pays, customers, projects]);

  const upcoming30 = upcoming.filter((p) => p.days >= 0 && p.days <= 30).sort((a, b) => a.days - b.days);
  const overdueList = upcoming.filter((p) => p.days < 0).sort((a, b) => a.days - b.days);

  function downloadSummary() {
    exportCSV("finans-ozeti.csv", [
      { "Kalem": "Gerçekleşen Gelir", "Tutar": stats.totalReceived },
      { "Kalem": "Planlanan Gelir", "Tutar": stats.totalReceivable },
      { "Kalem": "Gerçekleşen Gider", "Tutar": stats.totalExpense },
      { "Kalem": "Planlanan Gider", "Tutar": stats.totalPayable },
      { "Kalem": "Net Durum", "Tutar": stats.net },
      { "Kalem": "Bu Ay Beklenen Tahsilat", "Tutar": stats.expectedThisMonth },
      { "Kalem": "Bu Ay Gerçekleşen Gelir", "Tutar": stats.receivedThisMonth },
      { "Kalem": "Bu Ay Gerçekleşen Gider", "Tutar": stats.expenseThisMonth },
    ]);
  }

  if (loading) return <div className="rounded-md border border-border bg-card py-12 text-center text-sm text-muted-foreground shadow-card-soft">Finans verileri hazırlanıyor...</div>;
  if (loadError) return <AdminEmptyState title="Finans verileri alınamadı" description="Finans verileri alınırken bir problem oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyin." icon={AlertTriangle} />;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Finans"
        title="Finans Özeti"
        description="Tahsilat, ödeme planı, gider ve finans hareketlerini sade bir özet halinde izleyin."
        actions={<Button variant="outline" onClick={downloadSummary}><Download className="h-4 w-4 mr-1" /> Raporu İndir</Button>}
      />

      <div className="grid gap-3 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
        <div><span className="font-semibold text-foreground">Tahsilatlar:</span> gerçekleşen gelen ödemeler.</div>
        <div><span className="font-semibold text-foreground">Ödeme Planları:</span> beklenen veya vadeli alacaklar.</div>
        <div><span className="font-semibold text-foreground">Giderler:</span> yapılan masraflar.</div>
        <div><span className="font-semibold text-foreground">Finans Hareketleri:</span> gelir/gider detayları.</div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Gerçekleşen Gelir" value={formatTRY(stats.totalReceived)} color="text-emerald-700" />
        <Stat label="Planlanan Gelir" value={formatTRY(stats.totalReceivable)} color="text-amber-600" />
        <Stat label="Gerçekleşen Gider" value={formatTRY(stats.totalExpense)} color="text-red-600" />
        <Stat label="Planlanan Gider" value={formatTRY(stats.totalPayable)} color="text-slate-700" />
        <Stat label="Net Durum" value={formatTRY(stats.net)} color={stats.net >= 0 ? "text-emerald-700" : "text-red-600"} />
        <Stat label="Bu Ay Beklenen Tahsilat" value={formatTRY(stats.expectedThisMonth)} />
        <Stat label="Bu Ay Gerçekleşen Gelir" value={formatTRY(stats.receivedThisMonth)} color="text-emerald-700" />
        <Stat label="Bu Ay Gerçekleşen Gider" value={formatTRY(stats.expenseThisMonth)} color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PieCard title="Genel Finans Dağılımı" data={overallPie} />
        <PieCard title="Ödeme Durumu Dağılımı" data={statusPie} />
      </div>

      <section>
        <h2 className="font-display text-2xl font-bold mb-3">Proje Bazlı Finans Durumu</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projectStats.map((p) => {
            const data = [
              { name: "Gerçekleşen Gelir", value: p.received, color: FINANCE_COLORS.received },
              { name: "Planlanan Gelir", value: p.receivable, color: FINANCE_COLORS.receivable },
              { name: "Gerçekleşen Gider", value: p.expense, color: FINANCE_COLORS.expense },
              { name: "Planlanan Gider", value: p.payable, color: FINANCE_COLORS.pending },
            ].filter((d) => d.value > 0);
            return (
              <div key={p.id} className="bg-card border border-border rounded-md p-4">
                <h3 className="font-semibold truncate">{p.title}</h3>
                <div className="flex gap-3 items-center mt-2">
                  <div className="w-32 h-32">
                    {data.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={28} outerRadius={50} paddingAngle={2}>{data.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip formatter={(v: any) => formatTRY(v)} /></PieChart>
                      </ResponsiveContainer>
                    ) : <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Finans kaydı yok</div>}
                  </div>
                  <div className="flex-1 text-xs space-y-1">
                    <div className="flex justify-between"><span>Gerçekleşen Gelir</span><span className="text-emerald-700 font-medium">{formatTRY(p.received)}</span></div>
                    <div className="flex justify-between"><span>Planlanan Gelir</span><span className="text-amber-600 font-medium">{formatTRY(p.receivable)}</span></div>
                    <div className="flex justify-between"><span>Gerçekleşen Gider</span><span className="text-red-600 font-medium">{formatTRY(p.expense)}</span></div>
                    <div className="flex justify-between"><span>Planlanan Gider</span><span className="text-slate-700 font-medium">{formatTRY(p.payable)}</span></div>
                    <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="font-semibold">Net</span><span className={cn("font-bold", p.net >= 0 ? "text-emerald-700" : "text-red-600")}>{formatTRY(p.net)}</span></div>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full mt-3"><Link to={`/admin/projeler/${p.id}/finans`}>Detayları Gör</Link></Button>
              </div>
            );
          })}
          {projectStats.length === 0 && <div className="text-muted-foreground">Henüz proje kaydı yok. Proje eklendiğinde finans özeti burada görünecek.</div>}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold mb-3">Yaklaşan Ödemeler (30 Gün)</h2>
        <div className="bg-card border border-border rounded-md overflow-x-auto">
          <table className="min-w-[780px] w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Müşteri</th><th className="p-3 text-left">Proje</th><th className="p-3 text-right">Tutar</th><th className="p-3">Vade</th><th className="p-3">Kalan Gün</th><th className="p-3">Durum</th><th className="p-3 text-right">Hatırlat</th></tr></thead>
            <tbody>
              {upcoming30.slice(0, 15).map((p) => {
                const label = p.days === 0 ? "Bugün Ödenecek" : p.days <= 7 ? "Yaklaşıyor" : "Yaklaşıyor";
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">{p.customer ? customerDisplayName(p.customer) : "-"}</td>
                    <td className="p-3 text-xs">{p.project?.title || "-"}</td>
                    <td className="p-3 text-right font-medium">{formatTRY(p.remain)}</td>
                    <td className="p-3">{formatDate(p.due_date)}</td>
                    <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md text-xs", p.days === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700")}>{p.days} gün</span></td>
                    <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass(label))}>{label}</span></td>
                    <td className="p-3 text-right">
                      {p.customer?.whatsapp && <Button asChild size="sm" variant="outline"><a href={whatsappLink(p.customer.whatsapp, `Merhaba, Akınal İnşaat ödeme planınıza göre ${formatDate(p.due_date)} tarihli ${formatTRY(p.remain)} ödemeniz bulunmaktadır. Bilginize sunarız.`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1 text-emerald-700" /> WhatsApp ile Hatırlat</a></Button>}
                    </td>
                  </tr>
                );
              })}
              {upcoming30.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Önümüzdeki 30 gün için yaklaşan ödeme bulunmuyor.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold mb-3">Geciken Ödemeler</h2>
        <div className="bg-card border border-border rounded-md overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-red-50 text-xs uppercase text-red-700"><tr><th className="p-3 text-left">Müşteri</th><th className="p-3 text-left">Proje</th><th className="p-3">Vade</th><th className="p-3">Geciken Gün</th><th className="p-3 text-right">Tutar</th><th className="p-3">Durum</th><th className="p-3 text-right">İletişim</th></tr></thead>
            <tbody>
              {overdueList.slice(0, 15).map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3">{p.customer ? customerDisplayName(p.customer) : "-"}</td>
                  <td className="p-3 text-xs">{p.project?.title || "-"}</td>
                  <td className="p-3">{formatDate(p.due_date)}</td>
                  <td className="p-3 text-red-600 font-bold">{Math.abs(p.days)} gün</td>
                  <td className="p-3 text-right font-medium">{formatTRY(p.remain)}</td>
                  <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass("Gecikti"))}>Vadesi Geçti</span></td>
                  <td className="p-3 text-right">
                    {p.customer?.whatsapp && <Button asChild size="sm" variant="outline"><a href={whatsappLink(p.customer.whatsapp, `Merhaba, Akınal İnşaat ödeme planınıza göre ${formatDate(p.due_date)} tarihli ${formatTRY(p.remain)} ödemeniz bulunmaktadır. Bilginize sunarız.`)} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1 text-emerald-700" /> WhatsApp</a></Button>}
                  </td>
                </tr>
              ))}
              {overdueList.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Geciken ödeme bulunmuyor.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
