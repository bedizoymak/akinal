import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  FolderKanban,
  Inbox,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { formatTRY, formatDate, customerDisplayName, daysUntil, derivePlanStatus } from "@/lib/finance";
import { statusBadgeVariant } from "@/lib/projects";
import { cn } from "@/lib/utils";

type DashboardData = {
  projects: any[];
  customers: any[];
  plans: any[];
  payments: any[];
  expenses: any[];
  requests: any[];
};

const initialData: DashboardData = {
  projects: [],
  customers: [],
  plans: [],
  payments: [],
  expenses: [],
  requests: [],
};

function sumAmount(items: any[]) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function isThisMonth(date: string | null | undefined, monthStart: string, monthEnd: string) {
  if (!date) return false;
  return date >= monthStart && date <= monthEnd;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [projects, customers, plans, payments, expenses, requests] = await Promise.all([
        supabase.from("projects").select("id,title,project_status,location,is_published,slug,sort_order").order("sort_order"),
        (supabase.from("customers" as any).select("*").order("created_at", { ascending: false })) as any,
        (supabase.from("payment_plans" as any).select("*").order("due_date")) as any,
        (supabase.from("payments" as any).select("*").order("payment_date", { ascending: false })) as any,
        (supabase.from("expenses" as any).select("*").order("expense_date", { ascending: false })) as any,
        supabase.from("contact_requests").select("*").order("created_at", { ascending: false }),
      ]);

      setData({
        projects: projects.data || [],
        customers: (customers.data as any[]) || [],
        plans: (plans.data as any[]) || [],
        payments: (payments.data as any[]) || [],
        expenses: (expenses.data as any[]) || [],
        requests: requests.data || [],
      });
      setLoading(false);
    })();
  }, []);

  const dashboard = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

    const totalIncome = sumAmount(data.payments);
    const totalExpenses = sumAmount(data.expenses);
    const monthIncome = sumAmount(data.payments.filter((payment) => isThisMonth(payment.payment_date, monthStart, monthEnd)));
    const monthExpenses = sumAmount(data.expenses.filter((expense) => isThisMonth(expense.expense_date, monthStart, monthEnd)));
    const activeProjects = data.projects.filter((project) => project.project_status !== "Tamamlandı");

    const planRows = data.plans.map((plan) => {
      const paid = sumAmount(data.payments.filter((payment) => payment.payment_plan_id === plan.id));
      const remaining = Math.max(0, Number(plan.amount || 0) - paid);
      const status = derivePlanStatus(plan, paid);
      const customer = data.customers.find((item) => item.id === plan.customer_id);
      const project = data.projects.find((item) => item.id === plan.project_id);
      const days = daysUntil(plan.due_date);
      return { ...plan, paid, remaining, status, customer, project, days };
    });

    const pendingCollections = planRows.reduce((sum, plan) => sum + plan.remaining, 0);
    const overdueCollections = planRows
      .filter((plan) => plan.days < 0 && plan.remaining > 0 && plan.status !== "Ödendi" && plan.status !== "İptal")
      .reduce((sum, plan) => sum + plan.remaining, 0);
    const upcomingPlans = planRows
      .filter((plan) => plan.days >= 0 && plan.days <= 30 && plan.remaining > 0 && plan.status !== "Ödendi" && plan.status !== "İptal")
      .sort((a, b) => a.days - b.days);

    const projectProfitability = data.projects
      .map((project) => {
        const projectPayments = data.payments.filter((payment) => payment.project_id === project.id);
        const projectExpenses = data.expenses.filter((expense) => expense.project_id === project.id);
        const income = sumAmount(projectPayments);
        const expense = sumAmount(projectExpenses);
        return {
          ...project,
          income,
          expense,
          net: income - expense,
        };
      })
      .sort((a, b) => b.net - a.net);

    const recentMovements = [
      ...data.payments.map((payment) => ({
        id: `payment-${payment.id}`,
        type: "Tahsilat",
        date: payment.payment_date,
        amount: Number(payment.amount || 0),
        tone: "success" as const,
        customer: data.customers.find((item) => item.id === payment.customer_id),
        project: data.projects.find((item) => item.id === payment.project_id),
      })),
      ...data.expenses.map((expense) => ({
        id: `expense-${expense.id}`,
        type: "Gider",
        date: expense.expense_date,
        amount: Number(expense.amount || 0),
        tone: "danger" as const,
        title: expense.title,
        project: data.projects.find((item) => item.id === expense.project_id),
      })),
    ]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 8);

    return {
      totalIncome,
      totalExpenses,
      netProfit: totalIncome - totalExpenses,
      monthIncome,
      monthExpenses,
      monthNet: monthIncome - monthExpenses,
      activeProjects,
      pendingCollections,
      overdueCollections,
      upcomingPlans,
      projectProfitability,
      recentMovements,
      newRequests: data.requests.filter((request) => request.status === "Yeni"),
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Genel Durum"
        title="Genel Bakış"
        description="Şirketin proje, tahsilat, gider ve kârlılık durumunu tek ekranda izleyin."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/raporlar">
                <BarChart3 className="h-4 w-4" />
                Raporları Gör
              </Link>
            </Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent-glow">
              <Link to="/admin/projeler/yeni">
                <Plus className="h-4 w-4" />
                Yeni Proje
              </Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">Genel durum hazırlanıyor...</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard label="Aktif Projeler" value={dashboard.activeProjects.length} description={`${data.projects.length} toplam proje içinde`} icon={FolderKanban} tone="accent" />
            <AdminMetricCard label="Toplam Müşteri" value={data.customers.length} description="Cari ilişkiler ve proje bağlantıları" icon={Users} tone="default" />
            <AdminMetricCard label="Toplam Tahsilat" value={formatTRY(dashboard.totalIncome)} description="Kayıtlı tahsilat toplamı" icon={Wallet} tone="success" />
            <AdminMetricCard label="Toplam Gider" value={formatTRY(dashboard.totalExpenses)} description="Kayıtlı proje ve genel giderler" icon={Receipt} tone="danger" />
            <AdminMetricCard label="Net Kâr" value={formatTRY(dashboard.netProfit)} description="Tahsilat eksi gider" icon={dashboard.netProfit >= 0 ? TrendingUp : TrendingDown} tone={dashboard.netProfit >= 0 ? "success" : "danger"} />
            <AdminMetricCard label="Bekleyen Tahsilatlar" value={formatTRY(dashboard.pendingCollections)} description="Ödeme planlarında kalan tutar" icon={CalendarClock} tone="warning" />
            <AdminMetricCard label="Vadesi Geçen Alacak" value={formatTRY(dashboard.overdueCollections)} description="Aksiyon gerektiren tahsilatlar" icon={AlertTriangle} tone={dashboard.overdueCollections > 0 ? "danger" : "success"} />
            <AdminMetricCard label="Bu Ayın Özeti" value={formatTRY(dashboard.monthNet)} description={`Tahsilat ${formatTRY(dashboard.monthIncome)} / Gider ${formatTRY(dashboard.monthExpenses)}`} icon={BarChart3} tone={dashboard.monthNet >= 0 ? "success" : "danger"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <AdminSection title="Aktif Projeler" description="Devam eden proje portföyü" className="xl:col-span-2" contentClassName="space-y-3">
              {dashboard.activeProjects.length === 0 ? (
                <AdminEmptyState title="Aktif proje bulunmuyor" description="Yeni proje ekleyerek proje portföyünü takip etmeye başlayabilirsiniz." icon={FolderKanban} />
              ) : (
                dashboard.activeProjects.slice(0, 6).map((project) => (
                  <Link key={project.id} to={`/admin/projeler/${project.id}/finans`} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 transition-colors hover:border-accent hover:bg-accent/5">
                    <div className="min-w-0">
                      <div className="font-semibold">{project.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{project.location || "Konum girilmemiş"}</div>
                    </div>
                    <span className={cn("shrink-0 rounded-md border px-2 py-1 text-xs font-medium", statusBadgeVariant(project.project_status))}>{project.project_status}</span>
                  </Link>
                ))
              )}
            </AdminSection>

            <AdminSection title="Hızlı İşlemler" description="Sık kullanılan yönetim adımları" contentClassName="space-y-2">
              {[
                { to: "/admin/projeler/yeni", label: "Yeni Proje Ekle" },
                { to: "/admin/musteriler/yeni", label: "Yeni Müşteri Ekle" },
                { to: "/admin/tahsilatlar", label: "Tahsilat Kaydet" },
                { to: "/admin/giderler", label: "Gider Kaydet" },
              ].map((item) => (
                <Button key={item.to} asChild variant="outline" className="w-full justify-between">
                  <Link to={item.to}>
                    {item.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ))}
            </AdminSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AdminSection title="Proje Kârlılığı" description="Tahsilat ve giderlere göre proje net durumu" contentClassName="p-0">
              {dashboard.projectProfitability.length === 0 ? (
                <div className="p-5">
                  <AdminEmptyState title="Proje finans verisi yok" description="Tahsilat ve gider kayıtları oluştuğunda proje kârlılığı burada görünür." icon={BarChart3} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3 text-left">Proje</th>
                        <th className="p-3 text-right">Gelir</th>
                        <th className="p-3 text-right">Gider</th>
                        <th className="p-3 text-right">Net Kâr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.projectProfitability.slice(0, 6).map((project) => (
                        <tr key={project.id} className="border-t border-border">
                          <td className="p-3 font-medium">{project.title}</td>
                          <td className="p-3 text-right text-emerald-700">{formatTRY(project.income)}</td>
                          <td className="p-3 text-right text-red-600">{formatTRY(project.expense)}</td>
                          <td className={cn("p-3 text-right font-bold", project.net >= 0 ? "text-emerald-700" : "text-red-600")}>{formatTRY(project.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminSection>

            <AdminSection title="Yaklaşan İşlemler" description="Önümüzdeki 30 gün içinde takip edilmesi gereken tahsilatlar" contentClassName="space-y-3">
              {dashboard.upcomingPlans.length === 0 ? (
                <AdminEmptyState title="Yaklaşan tahsilat yok" description="Önümüzdeki 30 gün için açık tahsilat bulunmuyor." icon={CalendarClock} />
              ) : (
                dashboard.upcomingPlans.slice(0, 6).map((plan) => (
                  <Link key={plan.id} to="/admin/odeme-planlari" className="flex items-center justify-between gap-3 rounded-md border border-border p-3 transition-colors hover:border-accent hover:bg-accent/5">
                    <div className="min-w-0">
                      <div className="font-semibold">{plan.customer ? customerDisplayName(plan.customer) : "Müşteri seçilmemiş"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{plan.project?.title || "Proje seçilmemiş"} · {formatDate(plan.due_date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-amber-700">{formatTRY(plan.remaining)}</div>
                      <div className="text-xs text-muted-foreground">{plan.days === 0 ? "Bugün" : `${plan.days} gün`}</div>
                    </div>
                  </Link>
                ))
              )}
            </AdminSection>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AdminSection title="Son Finansal Hareketler" description="Tahsilat ve gider akışının son kayıtları" contentClassName="space-y-3">
              {dashboard.recentMovements.length === 0 ? (
                <AdminEmptyState title="Finansal hareket yok" description="Tahsilat veya gider kaydı oluşturulduğunda burada listelenir." icon={Wallet} />
              ) : (
                dashboard.recentMovements.map((movement) => (
                  <div key={movement.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{movement.type}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {movement.customer ? customerDisplayName(movement.customer) : movement.title || "Kayıt"} · {movement.project?.title || "Proje yok"} · {formatDate(movement.date)}
                      </div>
                    </div>
                    <div className={cn("font-bold", movement.tone === "success" ? "text-emerald-700" : "text-red-600")}>{formatTRY(movement.amount)}</div>
                  </div>
                ))
              )}
            </AdminSection>

            <AdminSection title="Riskli Alanlar" description="Öncelik verilmesi gereken operasyon sinyalleri" contentClassName="space-y-3">
              <div className={cn("rounded-md border p-4", dashboard.overdueCollections > 0 ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
                <div className="font-semibold">Tahsilat Riski</div>
                <div className="mt-1 text-sm">{dashboard.overdueCollections > 0 ? `${formatTRY(dashboard.overdueCollections)} vadesi geçmiş alacak var.` : "Vadesi geçmiş alacak görünmüyor."}</div>
              </div>
              <div className="rounded-md border border-border bg-surface-light p-4">
                <div className="font-semibold text-foreground">Bekleyen Ödemeler</div>
                <div className="mt-1 text-sm text-muted-foreground">Tedarikçi/personel ödeme takibi için ayrı tablo bulunmuyor. ERP kapsamına alınması önerilir.</div>
              </div>
              <Link to="/admin/talepler" className="block rounded-md border border-border p-4 transition-colors hover:border-accent hover:bg-accent/5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Yeni İletişim Talepleri</div>
                    <div className="mt-1 text-sm text-muted-foreground">Web sitesinden gelen yeni talepler</div>
                  </div>
                  <div className="text-2xl font-bold text-accent">{dashboard.newRequests.length}</div>
                </div>
              </Link>
            </AdminSection>
          </div>
        </>
      )}
    </div>
  );
}
