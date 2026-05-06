import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, MessageCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { FINANCE_COLORS, formatTRY, formatDate, customerDisplayName, daysUntil, exportCSV, whatsappLink, statusBadgeClass, derivePlanStatus } from "@/lib/finance";
import { cn } from "@/lib/utils";

function Stat({ label, value, color, sub }: any) {
  return (
    <div className="bg-card border border-border rounded-md p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold mt-1", color)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
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
      ) : <div className="text-sm text-muted-foreground py-12 text-center">Veri yok.</div>}
    </div>
  );
}

export default function AdminFinance() {
  const [plans, setPlans] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [pl, py, ex, c, pr] = await Promise.all([
      (supabase.from("payment_plans" as any).select("*")) as any,
      (supabase.from("payments" as any).select("*")) as any,
      (supabase.from("expenses" as any).select("*")) as any,
      (supabase.from("customers" as any).select("*")) as any,
      supabase.from("projects").select("id,title,slug").order("sort_order"),
    ]);
    setPlans((pl.data as any[]) || []); setPays((py.data as any[]) || []);
    setExps((ex.data as any[]) || []); setCustomers((c.data as any[]) || []); setProjects((pr.data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const totalReceived = pays.reduce((s, p) => s + Number(p.amount), 0);
    const totalDue = plans.reduce((s, p) => s + Number(p.amount), 0);
    const totalReceivable = Math.max(0, totalDue - totalReceived);
    const totalExpense = exps.reduce((s, e) => s + Number(e.amount), 0);
    const net = totalReceived - totalExpense;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const overdue = plans.reduce((s, p) => {
      if (p.status === "Ödendi" || p.status === "İptal") return s;
      if (daysUntil(p.due_date) >= 0) return s;
      const paid = pays.filter((x) => x.payment_plan_id === p.id).reduce((a, x) => a + Number(x.amount), 0);
      return s + Math.max(0, Number(p.amount) - paid);
    }, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
    const expectedThisMonth = plans.filter((p) => p.due_date >= monthStart && p.due_date <= monthEnd && p.status !== "Ödendi" && p.status !== "İptal")
      .reduce((s, p) => {
        const paid = pays.filter((x) => x.payment_plan_id === p.id).reduce((a, x) => a + Number(x.amount), 0);
        return s + Math.max(0, Number(p.amount) - paid);
      }, 0);
    const receivedThisMonth = pays.filter((p) => p.payment_date >= monthStart && p.payment_date <= monthEnd).reduce((s, p) => s + Number(p.amount), 0);
    const expenseThisMonth = exps.filter((e) => e.expense_date >= monthStart && e.expense_date <= monthEnd).reduce((s, e) => s + Number(e.amount), 0);
    return { totalReceived, totalReceivable, totalExpense, net, overdue, expectedThisMonth, receivedThisMonth, expenseThisMonth };
  }, [plans, pays, exps]);

  const overallPie = [
    { name: "Alınan", value: stats.totalReceived, color: FINANCE_COLORS.received },
    { name: "Alınacak", value: stats.totalReceivable, color: FINANCE_COLORS.receivable },
    { name: "Harcanan", value: stats.totalExpense, color: FINANCE_COLORS.expense },
  ];

  const statusPie = useMemo(() => {
    const counts = { "Ödendi": 0, "Bekliyor": 0, "Kısmi Ödendi": 0, "Gecikti": 0 } as Record<string, number>;
    plans.forEach((p) => {
      const paid = pays.filter((x) => x.payment_plan_id === p.id).reduce((a, x) => a + Number(x.amount), 0);
      const computed = derivePlanStatus(p, paid);
      if (counts[computed] !== undefined) counts[computed] += Number(p.amount);
    });
    return [
      { name: "Ödendi", value: counts["Ödendi"], color: FINANCE_COLORS.paid },
      { name: "Bekliyor", value: counts["Bekliyor"], color: FINANCE_COLORS.pending },
      { name: "Kısmi Ödendi", value: counts["Kısmi Ödendi"], color: FINANCE_COLORS.partial },
      { name: "Gecikti", value: counts["Gecikti"], color: FINANCE_COLORS.overdue },
    ];
  }, [plans, pays]);

  const projectStats = useMemo(() => projects.map((pr) => {
    const projPlans = plans.filter((p) => p.project_id === pr.id);
    const projPays = pays.filter((p) => p.project_id === pr.id);
    const projExps = exps.filter((e) => e.project_id === pr.id);
    const totalDue = projPlans.reduce((s, p) => s + Number(p.amount), 0);
    const received = projPays.reduce((s, p) => s + Number(p.amount), 0);
    const receivable = Math.max(0, totalDue - received);
    const expense = projExps.reduce((s, e) => s + Number(e.amount), 0);
    return { ...pr, received, receivable, expense, net: received - expense };
  }), [projects, plans, pays, exps]);

  const upcoming = useMemo(() => {
    return plans.map((p) => {
      const paid = pays.filter((x) => x.payment_plan_id === p.id).reduce((a, x) => a + Number(x.amount), 0);
      const remain = Math.max(0, Number(p.amount) - paid);
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
      { "Kalem": "Toplam Alınan", "Tutar": stats.totalReceived },
      { "Kalem": "Toplam Alınacak", "Tutar": stats.totalReceivable },
      { "Kalem": "Toplam Harcanan", "Tutar": stats.totalExpense },
      { "Kalem": "Net Durum", "Tutar": stats.net },
      { "Kalem": "Vadesi Geçen Alacak", "Tutar": stats.overdue },
      { "Kalem": "Bu Ay Beklenen Tahsilat", "Tutar": stats.expectedThisMonth },
      { "Kalem": "Bu Ay Yapılan Tahsilat", "Tutar": stats.receivedThisMonth },
      { "Kalem": "Bu Ay Yapılan Harcama", "Tutar": stats.expenseThisMonth },
    ]);
  }

  if (loading) return <div className="text-center text-muted-foreground py-12">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="font-display text-3xl font-bold">Finans Dashboard</h1><p className="text-muted-foreground text-sm">Genel finansal durum ve proje bazlı özet.</p></div>
        <Button variant="outline" onClick={downloadSummary}><Download className="h-4 w-4 mr-1" /> Raporu İndir</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Toplam Alınan" value={formatTRY(stats.totalReceived)} color="text-emerald-700" />
        <Stat label="Toplam Alınacak" value={formatTRY(stats.totalReceivable)} color="text-amber-600" />
        <Stat label="Toplam Harcanan" value={formatTRY(stats.totalExpense)} color="text-red-600" />
        <Stat label="Net Durum" value={formatTRY(stats.net)} color={stats.net >= 0 ? "text-emerald-700" : "text-red-600"} />
        <Stat label="Vadesi Geçen Alacak" value={formatTRY(stats.overdue)} color="text-red-600" />
        <Stat label="Bu Ay Beklenen Tahsilat" value={formatTRY(stats.expectedThisMonth)} />
        <Stat label="Bu Ay Yapılan Tahsilat" value={formatTRY(stats.receivedThisMonth)} color="text-emerald-700" />
        <Stat label="Bu Ay Yapılan Harcama" value={formatTRY(stats.expenseThisMonth)} color="text-red-600" />
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
              { name: "Alınan", value: p.received, color: FINANCE_COLORS.received },
              { name: "Alınacak", value: p.receivable, color: FINANCE_COLORS.receivable },
              { name: "Harcanan", value: p.expense, color: FINANCE_COLORS.expense },
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
                    ) : <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Veri yok</div>}
                  </div>
                  <div className="flex-1 text-xs space-y-1">
                    <div className="flex justify-between"><span>Alınan</span><span className="text-emerald-700 font-medium">{formatTRY(p.received)}</span></div>
                    <div className="flex justify-between"><span>Alınacak</span><span className="text-amber-600 font-medium">{formatTRY(p.receivable)}</span></div>
                    <div className="flex justify-between"><span>Harcanan</span><span className="text-red-600 font-medium">{formatTRY(p.expense)}</span></div>
                    <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="font-semibold">Net</span><span className={cn("font-bold", p.net >= 0 ? "text-emerald-700" : "text-red-600")}>{formatTRY(p.net)}</span></div>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full mt-3"><Link to={`/admin/projeler/${p.id}/finans`}>Detayları Gör</Link></Button>
              </div>
            );
          })}
          {projectStats.length === 0 && <div className="text-muted-foreground">Proje yok.</div>}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold mb-3">Yaklaşan Ödemeler (30 Gün)</h2>
        <div className="bg-card border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
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
              {upcoming30.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Yaklaşan ödeme yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold mb-3">Geciken Ödemeler</h2>
        <div className="bg-card border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
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
              {overdueList.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Geciken ödeme yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
