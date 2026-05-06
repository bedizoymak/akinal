import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { FINANCE_COLORS, formatTRY, formatDate, customerDisplayName, statusBadgeClass, derivePlanStatus } from "@/lib/finance";
import { cn } from "@/lib/utils";

function Stat({ label, value, color }: any) {
  return (
    <div className="bg-card border border-border rounded-md p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold mt-1", color)}>{value}</div>
    </div>
  );
}

export default function AdminProjectFinance() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [pays, setPays] = useState<any[]>([]);
  const [exps, setExps] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  async function load() {
    const [pr, pl, py, ex, c] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).maybeSingle(),
      (supabase.from("payment_plans" as any).select("*").eq("project_id", id).order("due_date")) as any,
      (supabase.from("payments" as any).select("*").eq("project_id", id).order("payment_date", { ascending: false })) as any,
      (supabase.from("expenses" as any).select("*").eq("project_id", id).order("expense_date", { ascending: false })) as any,
      (supabase.from("customers" as any).select("*")) as any,
    ]);
    setProject(pr.data); setPlans((pl.data as any[]) || []); setPays((py.data as any[]) || []);
    setExps((ex.data as any[]) || []); setCustomers((c.data as any[]) || []);
  }
  useEffect(() => { load(); }, [id]);

  const stats = useMemo(() => {
    const totalDue = plans.reduce((s, p) => s + Number(p.amount), 0);
    const received = pays.reduce((s, p) => s + Number(p.amount), 0);
    const receivable = Math.max(0, totalDue - received);
    const expense = exps.reduce((s, e) => s + Number(e.amount), 0);
    return { totalDue, received, receivable, expense, net: received - expense };
  }, [plans, pays, exps]);

  const pie = [
    { name: "Alınan", value: stats.received, color: FINANCE_COLORS.received },
    { name: "Alınacak", value: stats.receivable, color: FINANCE_COLORS.receivable },
    { name: "Harcanan", value: stats.expense, color: FINANCE_COLORS.expense },
  ].filter((d) => d.value > 0);

  const customerBalances = useMemo(() => {
    const ids = Array.from(new Set([...plans.map((p) => p.customer_id), ...pays.map((p) => p.customer_id)]));
    return ids.map((cid) => {
      const c = customers.find((x) => x.id === cid);
      const due = plans.filter((p) => p.customer_id === cid).reduce((s, p) => s + Number(p.amount), 0);
      const paid = pays.filter((p) => p.customer_id === cid).reduce((s, p) => s + Number(p.amount), 0);
      return { id: cid, customer: c, due, paid, balance: due - paid };
    });
  }, [plans, pays, customers]);

  if (!project) return <div className="text-muted-foreground">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon"><Link to="/admin/finans-dashboard"><ArrowLeft className="h-5 w-5" /></Link></Button>
        <div>
          <h1 className="font-display text-3xl font-bold">{project.title}</h1>
          <p className="text-muted-foreground text-sm">Proje finans detayları</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Toplam Borç" value={formatTRY(stats.totalDue)} />
        <Stat label="Alınan" value={formatTRY(stats.received)} color="text-emerald-700" />
        <Stat label="Alınacak" value={formatTRY(stats.receivable)} color="text-amber-600" />
        <Stat label="Harcanan" value={formatTRY(stats.expense)} color="text-red-600" />
        <Stat label="Net Durum" value={formatTRY(stats.net)} color={stats.net >= 0 ? "text-emerald-700" : "text-red-600"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-md p-5">
          <h3 className="font-semibold mb-2">Proje Finans Dağılımı</h3>
          {pie.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={2}>{pie.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip formatter={(v: any) => formatTRY(v)} /><Legend /></PieChart>
            </ResponsiveContainer>
          ) : <div className="text-sm text-muted-foreground py-12 text-center">Veri yok.</div>}
        </div>

        <div className="bg-card border border-border rounded-md p-5">
          <h3 className="font-semibold mb-3">Müşteri Bakiyeleri</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {customerBalances.map((cb) => (
              <Link key={cb.id} to={`/admin/musteriler/${cb.id}`} className="flex items-center justify-between p-2 rounded-md hover:bg-muted text-sm">
                <span className="font-medium">{cb.customer ? customerDisplayName(cb.customer) : "—"}</span>
                <span className="flex gap-3 text-xs">
                  <span className="text-emerald-700">{formatTRY(cb.paid)}</span>
                  <span className={cn("font-bold", cb.balance > 0 ? "text-red-600" : "text-emerald-700")}>{formatTRY(cb.balance)}</span>
                </span>
              </Link>
            ))}
            {customerBalances.length === 0 && <div className="text-sm text-muted-foreground">Bağlı müşteri yok.</div>}
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-display text-xl font-bold mb-3">Ödeme Planı</h2>
        <div className="bg-card border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Müşteri</th><th className="p-3 text-left">Başlık</th><th className="p-3">Vade</th><th className="p-3 text-right">Tutar</th><th className="p-3">Durum</th></tr></thead>
            <tbody>
              {plans.map((p) => {
                const paid = pays.filter((x) => x.payment_plan_id === p.id).reduce((s, x) => s + Number(x.amount), 0);
                const computed = derivePlanStatus(p, paid);
                const c = customers.find((x) => x.id === p.customer_id);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">{c ? customerDisplayName(c) : "-"}</td>
                    <td className="p-3">{p.title}</td>
                    <td className="p-3">{formatDate(p.due_date)}</td>
                    <td className="p-3 text-right">{formatTRY(p.amount)}</td>
                    <td className="p-3"><span className={cn("px-2 py-0.5 rounded-md border text-xs", statusBadgeClass(computed))}>{computed}</span></td>
                  </tr>
                );
              })}
              {plans.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Ödeme planı yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold mb-3">Tahsilatlar</h2>
        <div className="bg-card border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-left">Müşteri</th><th className="p-3 text-right">Tutar</th><th className="p-3">Yöntem</th></tr></thead>
            <tbody>
              {pays.map((p) => {
                const c = customers.find((x) => x.id === p.customer_id);
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">{formatDate(p.payment_date)}</td>
                    <td className="p-3">{c ? customerDisplayName(c) : "-"}</td>
                    <td className="p-3 text-right text-emerald-700 font-medium">{formatTRY(p.amount)}</td>
                    <td className="p-3">{p.payment_method}</td>
                  </tr>
                );
              })}
              {pays.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Tahsilat yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl font-bold mb-3">Giderler</h2>
        <div className="bg-card border border-border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-left">Tarih</th><th className="p-3 text-left">Başlık</th><th className="p-3">Kategori</th><th className="p-3 text-right">Tutar</th></tr></thead>
            <tbody>
              {exps.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3">{formatDate(e.expense_date)}</td>
                  <td className="p-3">{e.title}</td>
                  <td className="p-3 text-xs">{e.category}</td>
                  <td className="p-3 text-right text-red-600 font-medium">{formatTRY(e.amount)}</td>
                </tr>
              ))}
              {exps.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Gider yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
