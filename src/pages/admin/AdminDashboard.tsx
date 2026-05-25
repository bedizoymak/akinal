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
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AdminEmptyState, AdminMetricCard, AdminPageHeader, AdminSection } from "@/components/admin/AdminPage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatTRY,
  formatDate,
  customerDisplayName,
  daysUntil,
  derivePlanStatus,
  isCanceledStatus,
  isPaidStatus,
  paymentPlanRemainingFromPayments,
  paidForPlan,
  realizedFinancialExpense,
  realizedFinancialIncome,
  safeNumber,
  sumBy,
} from "@/lib/finance";
import { statusBadgeVariant } from "@/lib/projects";
import { cn } from "@/lib/utils";

type DashboardData = {
  projects: any[];
  customers: any[];
  plans: any[];
  payments: any[];
  expenses: any[];
  financialEntries: any[];
  requests: any[];
};

const initialData: DashboardData = {
  projects: [],
  customers: [],
  plans: [],
  payments: [],
  expenses: [],
  financialEntries: [],
  requests: [],
};

const chartColors = {
  income: "hsl(142 48% 28%)",
  expenses: "hsl(0 72% 51%)",
  net: "hsl(38 92% 50%)",
};

function sumAmount(items: any[]) {
  return sumBy(items, (item) => item.amount);
}

function isThisMonth(date: string | null | undefined, monthStart: string, monthEnd: string) {
  if (!date) return false;
  return date >= monthStart && date <= monthEnd;
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthLabel(date: Date) {
  return date.toLocaleDateString("tr-TR", { month: "short" }).replace(".", "");
}

function lastSixMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return { key: toMonthKey(date), month: toMonthLabel(date) };
  });
}

function chartCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} mn`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} bin`;
  return value.toLocaleString("tr-TR");
}

function LoadingDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-4 shadow-card-soft">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 rounded-md" />
      <Skeleton className="h-72 rounded-md" />
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(initialData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [projects, customers, plans, payments, expenses, financialEntries, requests] = await Promise.all([
        supabase.from("projects").select("id,title,project_status,location,is_published,slug,sort_order").order("sort_order"),
        (supabase.from("customers" as any).select("*").order("created_at", { ascending: false })) as any,
        (supabase.from("payment_plans" as any).select("*").order("due_date")) as any,
        (supabase.from("payments" as any).select("*").order("payment_date", { ascending: false })) as any,
        (supabase.from("expenses" as any).select("*").order("expense_date", { ascending: false })) as any,
        (supabase.from("financial_entries").select("*").order("entry_date", { ascending: false })) as any,
        supabase.from("contact_requests").select("*").order("created_at", { ascending: false }),
      ]);

      setData({
        projects: projects.data || [],
        customers: (customers.data as any[]) || [],
        plans: (plans.data as any[]) || [],
        payments: (payments.data as any[]) || [],
        expenses: (expenses.data as any[]) || [],
        financialEntries: (financialEntries.data as any[]) || [],
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

    const totalIncome = sumAmount(data.payments) + realizedFinancialIncome(data.financialEntries);
    const totalExpenses = sumAmount(data.expenses) + realizedFinancialExpense(data.financialEntries);
    const monthIncome = sumAmount(data.payments.filter((payment) => isThisMonth(payment.payment_date, monthStart, monthEnd)))
      + realizedFinancialIncome(data.financialEntries.filter((entry) => isThisMonth(entry.entry_date, monthStart, monthEnd)));
    const monthExpenses = sumAmount(data.expenses.filter((expense) => isThisMonth(expense.expense_date, monthStart, monthEnd)))
      + realizedFinancialExpense(data.financialEntries.filter((entry) => isThisMonth(entry.entry_date, monthStart, monthEnd)));
    const activeProjects = data.projects.filter((project) => project.project_status !== "Tamamlandı");

    const planRows = data.plans.map((plan) => {
      const paid = paidForPlan(plan.id, data.payments);
      const remaining = paymentPlanRemainingFromPayments(plan, data.payments);
      const status = derivePlanStatus(plan, paid);
      const customer = data.customers.find((item) => item.id === plan.customer_id);
      const project = data.projects.find((item) => item.id === plan.project_id);
      const days = daysUntil(plan.due_date);
      return { ...plan, paid, remaining, status, customer, project, days };
    });

    const pendingCollections = planRows.reduce((sum, plan) => sum + plan.remaining, 0);
    const overduePlans = planRows.filter((plan) => plan.days < 0 && plan.remaining > 0 && !isPaidStatus(plan.status) && !isCanceledStatus(plan.status));
    const overdueCollections = overduePlans.reduce((sum, plan) => sum + plan.remaining, 0);
    const upcomingPlans = planRows
      .filter((plan) => plan.days >= 0 && plan.days <= 30 && plan.remaining > 0 && !isPaidStatus(plan.status) && !isCanceledStatus(plan.status))
      .sort((a, b) => a.days - b.days);

    const months = lastSixMonths();
    const monthlyFinancials = months.map((month) => {
      const entries = data.financialEntries.filter((entry) => String(entry.entry_date || "").startsWith(month.key));
      const income = sumAmount(data.payments.filter((payment) => String(payment.payment_date || "").startsWith(month.key))) + realizedFinancialIncome(entries);
      const expenses = sumAmount(data.expenses.filter((expense) => String(expense.expense_date || "").startsWith(month.key))) + realizedFinancialExpense(entries);
      return { month: month.month, income, expenses, net: income - expenses };
    });

    const recentMovements = [
      ...data.payments.map((payment) => ({
        id: `payment-${payment.id}`,
        type: "Tahsilat",
        date: payment.payment_date,
        amount: safeNumber(payment.amount),
        tone: "success" as const,
        customer: data.customers.find((item) => item.id === payment.customer_id),
        project: data.projects.find((item) => item.id === payment.project_id),
      })),
      ...data.expenses.map((expense) => ({
        id: `expense-${expense.id}`,
        type: "Gider",
        date: expense.expense_date,
        amount: safeNumber(expense.amount),
        tone: "danger" as const,
        title: expense.title,
        project: data.projects.find((item) => item.id === expense.project_id),
      })),
      ...data.financialEntries
        .filter((entry) => entry.currency_tag === "TRY")
        .map((entry) => ({
          id: `entry-${entry.id}`,
          type: entry.direction === "Gelir" ? "Finans Geliri" : "Finans Gideri",
          date: entry.entry_date,
          amount: safeNumber(entry.amount),
          tone: entry.direction === "Gelir" ? "success" as const : "danger" as const,
          title: entry.title,
          project: data.projects.find((item) => item.id === entry.project_id),
        })),
    ]
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 6);

    return {
      totalIncome,
      totalExpenses,
      netStatus: totalIncome - totalExpenses,
      monthIncome,
      monthExpenses,
      monthNet: monthIncome - monthExpenses,
      activeProjects,
      pendingCollections,
      overdueCollections,
      overduePlans,
      upcomingPlans,
      recentMovements,
      newRequests: data.requests.filter((request) => request.status === "Yeni"),
      monthlyFinancials,
      hasFinancialData: data.payments.length > 0 || data.expenses.length > 0 || data.financialEntries.length > 0,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Yönetim Özeti"
        title="Genel Bakış"
        description="Projeler, tahsilatlar, giderler ve net durumu tek ekrandan takip edin."
        actions={
          <>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent-glow">
              <Link to="/admin/projeler/yeni"><Plus className="h-4 w-4" /> Yeni Proje</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/tahsilatlar?yeni=1"><Wallet className="h-4 w-4" /> Tahsilat Ekle</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/raporlar"><BarChart3 className="h-4 w-4" /> Raporları Gör</Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <LoadingDashboard />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <AdminMetricCard label="Aktif Projeler" value={dashboard.activeProjects.length} description={`${data.projects.length} toplam proje`} icon={FolderKanban} tone="accent" />
            <AdminMetricCard label="Toplam Tahsilat" value={formatTRY(dashboard.totalIncome)} description="Gelen ödemeler" icon={Wallet} tone="success" />
            <AdminMetricCard label="Toplam Gider" value={formatTRY(dashboard.totalExpenses)} description="Kayıtlı masraflar" icon={Receipt} tone="danger" />
            <AdminMetricCard label="Net Durum" value={formatTRY(dashboard.netStatus)} description="Tahsilat eksi gider" icon={dashboard.netStatus >= 0 ? TrendingUp : TrendingDown} tone={dashboard.netStatus >= 0 ? "success" : "danger"} />
            <AdminMetricCard label="Bekleyen Tahsilat" value={formatTRY(dashboard.pendingCollections)} description="Ödeme planlarında kalan" icon={CalendarClock} tone="warning" />
            <AdminMetricCard label="Vadesi Geçen Alacak" value={formatTRY(dashboard.overdueCollections)} description={`${dashboard.overduePlans.length} geciken plan`} icon={AlertTriangle} tone={dashboard.overdueCollections > 0 ? "danger" : "success"} />
          </div>

          <AdminSection title="Bu Ayın Özeti" description="İçinde bulunduğumuz ayın tahsilat, gider ve net durumu.">
            <div className="grid gap-3 md:grid-cols-3">
              <AdminMetricCard label="Bu Ay Tahsilat" value={formatTRY(dashboard.monthIncome)} icon={Wallet} tone="success" />
              <AdminMetricCard label="Bu Ay Gider" value={formatTRY(dashboard.monthExpenses)} icon={Receipt} tone="danger" />
              <AdminMetricCard label="Bu Ay Net Durum" value={formatTRY(dashboard.monthNet)} icon={dashboard.monthNet >= 0 ? TrendingUp : TrendingDown} tone={dashboard.monthNet >= 0 ? "success" : "danger"} />
            </div>
          </AdminSection>

          <div className="grid gap-6 xl:grid-cols-3">
            <AdminSection title="Takip Gerektirenler" description="Bugün bakılması faydalı olan kısa liste." className="xl:col-span-1" contentClassName="space-y-3">
              <Link to="/admin/odeme-planlari" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Vadesi Geçen Alacak</div>
                <div className={cn("mt-1 text-lg font-bold", dashboard.overdueCollections > 0 ? "text-red-700" : "text-emerald-700")}>{formatTRY(dashboard.overdueCollections)}</div>
                <div className="mt-1 text-xs text-muted-foreground">{dashboard.overduePlans.length} ödeme planı takip bekliyor.</div>
              </Link>
              <Link to="/admin/odeme-planlari" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Yaklaşan Tahsilatlar</div>
                <div className="mt-1 text-lg font-bold text-amber-700">{dashboard.upcomingPlans.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">Önümüzdeki 30 gün içinde.</div>
              </Link>
              <Link to="/admin/talepler" className="block rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                <div className="text-sm font-semibold">Yeni İletişim Talepleri</div>
                <div className="mt-1 text-lg font-bold text-accent">{dashboard.newRequests.length}</div>
                <div className="mt-1 text-xs text-muted-foreground">Web sitesinden gelen yeni talepler.</div>
              </Link>
            </AdminSection>

            <AdminSection title="Son Hareketler" description="Son tahsilat, gider ve finans kayıtları." className="xl:col-span-2" contentClassName="space-y-2">
              {dashboard.recentMovements.length === 0 ? (
                <AdminEmptyState title="Henüz finansal hareket yok" description="Kayıt eklendikçe bu alan otomatik güncellenecek." icon={Wallet} />
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
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AdminSection title="Proje Durumu" description="Devam eden projeler ve hızlı erişim." contentClassName="space-y-2">
              {dashboard.activeProjects.length === 0 ? (
                <AdminEmptyState
                  title="Aktif proje bulunmuyor"
                  description="Yeni proje eklediğinizde proje durumu burada görünecek."
                  icon={FolderKanban}
                  action={<Button asChild><Link to="/admin/projeler/yeni">Yeni Proje Ekle</Link></Button>}
                />
              ) : (
                dashboard.activeProjects.slice(0, 6).map((project) => (
                  <Link key={project.id} to={`/admin/projeler/${project.id}/finans`} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:border-accent/50 hover:bg-accent/5">
                    <div className="min-w-0">
                      <div className="font-semibold">{project.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{project.location || "Konum girilmemiş"}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn("rounded-md border px-2 py-1 text-xs font-medium", statusBadgeVariant(project.project_status))}>{project.project_status}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))
              )}
            </AdminSection>

            <AdminSection title="Aylık Finans Özeti" description="Son 6 ayın tahsilat, gider ve net durumu.">
              {dashboard.hasFinancialData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dashboard.monthlyFinancials} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={chartCurrency} tick={{ fontSize: 12 }} width={56} />
                    <Tooltip formatter={(value: number) => formatTRY(value)} />
                    <Legend />
                    <Bar dataKey="income" name="Tahsilat" fill={chartColors.income} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Gider" fill={chartColors.expenses} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net Durum" fill={chartColors.net} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <AdminEmptyState title="Henüz finansal hareket yok" description="Tahsilat veya gider kaydı eklendikçe grafik otomatik oluşacak." icon={BarChart3} />
              )}
            </AdminSection>
          </div>
        </>
      )}
    </div>
  );
}
